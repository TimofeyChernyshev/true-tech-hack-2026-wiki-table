package websocket

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"sync"
	"time"
	"true-tech-hack2026-wikilive/team-8d29b6bb/task-repo/internal/wiki_page/domain"

	"github.com/gorilla/websocket"
)

type TableClient interface {
	UpdateRecords(ctx context.Context, dstID, viewID string, records []domain.RecordUpdate) ([]domain.TableRecord, error)
	UpdatePage(ctx context.Context, pageID, content string) error
}

// Hub управляет всеми WebSocket соединениями
type Hub struct {
	rooms       map[string]*RoomState
	tableClient TableClient
	mu          sync.RWMutex
	stopCh      chan struct{}
	upgrader    websocket.Upgrader
}

// Room с состоянием комнаты
type RoomState struct {
	*Room
	state   []byte
	clients map[*Client]bool
}

func NewHub(tableClient TableClient) *Hub {
	h := &Hub{
		rooms:       make(map[string]*RoomState),
		tableClient: tableClient,
		stopCh:      make(chan struct{}),
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true
			},
			ReadBufferSize:    1024,
			WriteBufferSize:   1024,
			EnableCompression: true,
		},
	}

	// автосохранение
	go h.autoSaveWorker()

	// очистка пустых комнат
	go h.cleanupWorker()

	return h
}

// GetOrCreateRoom возвращает существующую комнату или создает новую
func (h *Hub) GetOrCreateRoom(id string, roomType RoomType, spaceID string) *RoomState {
	h.mu.Lock()
	defer h.mu.Unlock()

	if room, ok := h.rooms[id]; ok {
		return room
	}

	room := &RoomState{
		Room:    NewRoom(id, roomType, spaceID),
		state:   nil,
		clients: make(map[*Client]bool),
	}

	h.rooms[id] = room

	slog.Info("created new room", "id", id, "type", roomType)

	return room
}

// HandleWebSocket обрабатывает WebSocket соединение
func (h *Hub) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	roomID := r.URL.Query().Get("room")
	roomType := RoomType(r.URL.Query().Get("type"))
	spaceID := r.URL.Query().Get("spaceId")
	userID := r.URL.Query().Get("userId")
	userName := r.URL.Query().Get("userName")

	if roomID == "" {
		http.Error(w, "room parameter is required", http.StatusBadRequest)
		return
	}

	if userID == "" {
		userID = "anonymous"
	}
	if userName == "" {
		userName = userID
	}

	conn, err := h.upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Error("Failed to upgrade connection", "error", err)
		return
	}

	room := h.GetOrCreateRoom(roomID, roomType, spaceID)
	client := NewClient(userID, userName, roomID, conn)

	room.AddClient(client)
	room.clients[client] = true

	slog.Info("Client connected", "client", client.ID, "room", roomID, "total", room.GetClientsCount())

	if len(room.state) > 0 {
		client.SendMessage(room.state)
	}

	go h.readPump(client, room)
	go h.writePump(client)
}

// readPump читает сообщения от клиента
func (h *Hub) readPump(client *Client, room *RoomState) {
	defer func() {
		room.RemoveClient(client)
		client.Close()

		slog.Info("Client disconnected", "client", client.ID, "room", room.ID, "remaining", room.GetClientsCount())
	}()

	for {
		_, message, err := client.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				slog.Error("WebSocket error", "client", client.ID, "error", err)
			}
			break
		}

		room.state = message
		room.Touch()

		room.Broadcast(message, client)

		client.LastSeenAt = time.Now()
	}
}

// writePump отправляет сообщения клиенту
func (h *Hub) writePump(client *Client) {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		client.Close()
	}()

	for {
		select {
		case message, ok := <-client.Send:
			if !ok {
				client.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := client.Conn.WriteMessage(websocket.BinaryMessage, message); err != nil {
				return
			}

		case <-ticker.C:
			if err := client.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// autoSaveWorker периодически сохраняет состояние комнат
func (h *Hub) autoSaveWorker() {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			h.saveAllRooms()
		case <-h.stopCh:
			h.saveAllRooms()
			return
		}
	}
}

// saveAllRooms сохраняет все активные комнаты
func (h *Hub) saveAllRooms() {
	h.mu.RLock()
	defer h.mu.RUnlock()

	ctx := context.Background()

	for id, room := range h.rooms {
		if room.GetClientsCount() == 0 {
			continue
		}

		h.saveRoom(ctx, room)

		slog.Debug("Auto-saved room", "id", id)
	}
}

// saveRoom сохраняет состояние комнаты
func (h *Hub) saveRoom(ctx context.Context, room *RoomState) {
	switch room.Type {
	case RoomTypeRecords:
		var records []domain.RecordUpdate
		if err := json.Unmarshal(room.state, &records); err == nil && len(records) > 0 {
			h.tableClient.UpdateRecords(ctx, room.ID, "", records)
		}

	case RoomTypePage:
		content := string(room.state)
		h.tableClient.UpdatePage(ctx, room.ID, content)
	}
}

// cleanupWorker удаляет пустые комнаты
func (h *Hub) cleanupWorker() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			h.cleanupEmptyRooms()
		case <-h.stopCh:
			return
		}
	}
}

// cleanupEmptyRooms удаляет комнаты без клиентов
func (h *Hub) cleanupEmptyRooms() {
	h.mu.Lock()
	defer h.mu.Unlock()

	for id, room := range h.rooms {
		if room.IsEmpty() && time.Since(room.LastUpdateAt) > 5*time.Minute {
			delete(h.rooms, id)
			slog.Info("Removed empty room", "id", id)
		}
	}
}

// Shutdown останавливает хаб
func (h *Hub) Shutdown() {
	close(h.stopCh)

	h.mu.Lock()
	defer h.mu.Unlock()

	for _, room := range h.rooms {
		for client := range room.Clients {
			client.Close()
		}
	}
}
