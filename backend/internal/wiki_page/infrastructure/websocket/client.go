package websocket

import (
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type Client struct {
	ID          string
	Name        string
	RoomID      string
	Conn        *websocket.Conn
	Send        chan []byte
	ConnectedAt time.Time
	LastSeenAt  time.Time
	mu          sync.RWMutex
}

// NewClient создает нового клиента
func NewClient(id, name, roomID string, conn *websocket.Conn) *Client {
	now := time.Now()
	return &Client{
		ID:          id,
		Name:        name,
		RoomID:      roomID,
		Conn:        conn,
		Send:        make(chan []byte, 256),
		ConnectedAt: now,
		LastSeenAt:  now,
	}
}

// SendMessage отправляет сообщение клиенту
func (c *Client) SendMessage(message []byte) {
	c.mu.Lock()
	defer c.mu.Unlock()

	select {
	case c.Send <- message:
		c.LastSeenAt = time.Now()
	default:
		// Пропуск, если буфер переполнен
	}
}

// Close закрывает соединение клиента
func (c *Client) Close() {
	close(c.Send)
	c.Conn.Close()
}
