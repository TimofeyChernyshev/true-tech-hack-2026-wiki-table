package websocket

import (
	"sync"
	"time"
)

type RoomType string

const (
	RoomTypeRecords RoomType = "records" // редактирование записей таблицы
	RoomTypeFields  RoomType = "fields"  // редактирование полей таблицы
	RoomTypePage    RoomType = "page"    // редактирование вики-страницы
)

// Room представляет комнату для совместного редактирования
type Room struct {
	ID           string
	Type         RoomType
	SpaceID      string
	Clients      map[*Client]bool
	LastUpdateAt time.Time
	mu           sync.RWMutex
}

// NewRoom создает новую комнату
func NewRoom(id string, roomType RoomType, spaceID string) *Room {
	return &Room{
		ID:      id,
		Type:    roomType,
		SpaceID: spaceID,
		Clients: make(map[*Client]bool),
	}
}

// AddClient добавляет клиента в комнату
func (r *Room) AddClient(client *Client) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.Clients[client] = true
}

// RemoveClient удаляет клиента из комнаты
func (r *Room) RemoveClient(client *Client) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.Clients, client)
}

// GetClientsCount возвращает количество клиентов
func (r *Room) GetClientsCount() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.Clients)
}

// IsEmpty возвращает true если в комнате нет клиентов
func (r *Room) IsEmpty() bool {
	return r.GetClientsCount() == 0
}

// Broadcast рассылает сообщение всем клиентам кроме указанного
func (r *Room) Broadcast(message []byte, exclude *Client) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for client := range r.Clients {
		if client != exclude {
			client.SendMessage(message)
		}
	}
}

// Touch обновляет время последней активности
func (r *Room) Touch() {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.LastUpdateAt = time.Now()
}
