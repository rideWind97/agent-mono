package ws

import (
	"encoding/json"
	"log"
	"sync"

	"github.com/agent-mono/cs-server/internal/model"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

type ClientType string

const (
	ClientCustomer ClientType = "customer"
	ClientAgent    ClientType = "agent"
)

type Client struct {
	ID         string
	Type       ClientType
	SessionID  string
	Conn       *websocket.Conn
	Send       chan []byte
	Hub        *Hub
}

type Hub struct {
	mu         sync.RWMutex
	clients    map[string]*Client
	sessions   map[string]map[string]*Client // sessionID -> clientID -> client
	Register   chan *Client
	Unregister chan *Client
	Broadcast  chan *model.WSMessage
	OnMessage  func(client *Client, msg *model.WSMessage)
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[string]*Client),
		sessions:   make(map[string]map[string]*Client),
		Register:   make(chan *Client),
		Unregister: make(chan *Client),
		Broadcast:  make(chan *model.WSMessage, 256),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			h.mu.Lock()
			h.clients[client.ID] = client
			if _, ok := h.sessions[client.SessionID]; !ok {
				h.sessions[client.SessionID] = make(map[string]*Client)
			}
			h.sessions[client.SessionID][client.ID] = client
			h.mu.Unlock()

			log.Printf("[WS] client %s (%s) joined session %s", client.ID, client.Type, client.SessionID)

		case client := <-h.Unregister:
			h.mu.Lock()
			if _, ok := h.clients[client.ID]; ok {
				delete(h.clients, client.ID)
				if sess, ok := h.sessions[client.SessionID]; ok {
					delete(sess, client.ID)
					if len(sess) == 0 {
						delete(h.sessions, client.SessionID)
					}
				}
				close(client.Send)
			}
			h.mu.Unlock()

			log.Printf("[WS] client %s (%s) left session %s", client.ID, client.Type, client.SessionID)

		case msg := <-h.Broadcast:
			h.sendToSession(msg.SessionID, msg)
		}
	}
}

func (h *Hub) sendToSession(sessionID string, msg *model.WSMessage) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	data, err := json.Marshal(msg)
	if err != nil {
		return
	}

	if clients, ok := h.sessions[sessionID]; ok {
		for _, client := range clients {
			select {
			case client.Send <- data:
			default:
				go func(c *Client) { h.Unregister <- c }(client)
			}
		}
	}
}

func (h *Hub) SendToSession(sessionID string, msg *model.WSMessage) {
	h.sendToSession(sessionID, msg)
}

func (h *Hub) GetSessionAgents(sessionID string) []*Client {
	h.mu.RLock()
	defer h.mu.RUnlock()

	var agents []*Client
	if clients, ok := h.sessions[sessionID]; ok {
		for _, c := range clients {
			if c.Type == ClientAgent {
				agents = append(agents, c)
			}
		}
	}
	return agents
}

func NewClient(conn *websocket.Conn, clientType ClientType, sessionID string, hub *Hub) *Client {
	return &Client{
		ID:        uuid.New().String(),
		Type:      clientType,
		SessionID: sessionID,
		Conn:      conn,
		Send:      make(chan []byte, 256),
		Hub:       hub,
	}
}

func (c *Client) ReadPump() {
	defer func() {
		c.Hub.Unregister <- c
		c.Conn.Close()
	}()

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			break
		}

		var msg model.WSMessage
		if err := json.Unmarshal(message, &msg); err != nil {
			continue
		}
		msg.SessionID = c.SessionID
		msg.From = c.ID

		if c.Hub.OnMessage != nil {
			c.Hub.OnMessage(c, &msg)
		}
	}
}

func (c *Client) WritePump() {
	defer c.Conn.Close()

	for message := range c.Send {
		if err := c.Conn.WriteMessage(websocket.TextMessage, message); err != nil {
			break
		}
	}
}
