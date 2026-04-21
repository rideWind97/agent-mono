package handler

import (
	"net/http"

	"github.com/agent-mono/cs-server/internal/ws"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

type WSHandler struct {
	hub *ws.Hub
}

func NewWSHandler(hub *ws.Hub) *WSHandler {
	return &WSHandler{hub: hub}
}

// CustomerWS handles WebSocket connections from customers
func (h *WSHandler) CustomerWS(c *gin.Context) {
	sessionID := c.Query("sessionId")
	if sessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "sessionId is required"})
		return
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}

	client := ws.NewClient(conn, ws.ClientCustomer, sessionID, h.hub)
	h.hub.Register <- client

	go client.WritePump()
	go client.ReadPump()
}

// AgentWS handles WebSocket connections from human agents
func (h *WSHandler) AgentWS(c *gin.Context) {
	sessionID := c.Query("sessionId")
	if sessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "sessionId is required"})
		return
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}

	client := ws.NewClient(conn, ws.ClientAgent, sessionID, h.hub)
	h.hub.Register <- client

	go client.WritePump()
	go client.ReadPump()
}
