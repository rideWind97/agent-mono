package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"

	"github.com/agent-mono/cs-server/internal/model"
	"github.com/agent-mono/cs-server/internal/service/chat"
	"github.com/agent-mono/cs-server/internal/service/intent"
	"github.com/agent-mono/cs-server/internal/service/rag"
	"github.com/agent-mono/cs-server/internal/ws"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type ChatHandler struct {
	sessions   *chat.SessionManager
	rag        *rag.Service
	intent     *intent.Recognizer
	hub        *ws.Hub
}

func NewChatHandler(sessions *chat.SessionManager, ragSvc *rag.Service, intentSvc *intent.Recognizer, hub *ws.Hub) *ChatHandler {
	return &ChatHandler{
		sessions: sessions,
		rag:      ragSvc,
		intent:   intentSvc,
		hub:      hub,
	}
}

func (h *ChatHandler) CreateSession(c *gin.Context) {
	session := h.sessions.Create()
	c.JSON(http.StatusOK, gin.H{"session": session})
}

func (h *ChatHandler) GetSession(c *gin.Context) {
	id := c.Param("id")
	session := h.sessions.Get(id)
	if session == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "session not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"session": session})
}

func (h *ChatHandler) ListSessions(c *gin.Context) {
	status := c.Query("status")
	var sessions []*model.Session
	if status != "" {
		sessions = h.sessions.ListByStatus(status)
	} else {
		sessions = h.sessions.List()
	}
	c.JSON(http.StatusOK, gin.H{"sessions": sessions})
}

// Chat handles a regular (non-streaming) message
func (h *ChatHandler) Chat(c *gin.Context) {
	var req model.ChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	session := h.sessions.GetOrCreate(req.SessionID)

	// If session is in human mode, forward via WebSocket
	if session.Status == "human" {
		h.sessions.AddMessage(session.ID, model.Message{
			ID:   uuid.New().String(),
			Role: model.RoleUser,
			Content: req.Message,
		})
		h.hub.SendToSession(session.ID, &model.WSMessage{
			Type:      "customer_message",
			SessionID: session.ID,
			Content:   req.Message,
		})
		c.JSON(http.StatusOK, model.ChatResponse{
			SessionID: session.ID,
			Message:   "您的消息已转达人工客服，请稍候...",
			Status:    "human",
		})
		return
	}

	// Intent recognition
	recognized, _ := h.intent.Recognize(c.Request.Context(), req.Message, session.Messages)
	if recognized != nil {
		h.sessions.SetIntent(session.ID, recognized.Name)
	}

	// Check if intent requires human handoff
	if recognized != nil && h.intent.NeedsHuman(recognized.Name) {
		h.sessions.SetStatus(session.ID, "human")
		h.sessions.AddMessage(session.ID, model.Message{
			Role:    model.RoleUser,
			Content: req.Message,
		})
		h.sessions.AddMessage(session.ID, model.Message{
			Role:    model.RoleAssistant,
			Content: "正在为您转接人工客服，请稍候...",
		})

		h.hub.Broadcast <- &model.WSMessage{
			Type:      "transfer_request",
			SessionID: session.ID,
			Content:   fmt.Sprintf("用户请求人工服务 [意图: %s]", recognized.Name),
		}

		c.JSON(http.StatusOK, model.ChatResponse{
			SessionID: session.ID,
			Message:   "正在为您转接人工客服，请稍候...",
			Intent:    recognized,
			Status:    "human",
		})
		return
	}

	// RAG answer
	h.sessions.AddMessage(session.ID, model.Message{
		Role:    model.RoleUser,
		Content: req.Message,
	})

	answer, err := h.rag.Answer(c.Request.Context(), req.Message, session.Messages)
	if err != nil {
		log.Printf("RAG error: %v", err)
		answer = "抱歉，我暂时无法处理您的问题，请稍后再试或转接人工客服。"
	}

	h.sessions.AddMessage(session.ID, model.Message{
		Role:    model.RoleAssistant,
		Content: answer,
	})

	c.JSON(http.StatusOK, model.ChatResponse{
		SessionID: session.ID,
		Message:   answer,
		Intent:    recognized,
		Status:    session.Status,
	})
}

// ChatStream handles SSE streaming response
func (h *ChatHandler) ChatStream(c *gin.Context) {
	var req model.ChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	session := h.sessions.GetOrCreate(req.SessionID)

	if session.Status == "human" {
		h.sessions.AddMessage(session.ID, model.Message{
			Role:    model.RoleUser,
			Content: req.Message,
		})
		h.hub.SendToSession(session.ID, &model.WSMessage{
			Type:      "customer_message",
			SessionID: session.ID,
			Content:   req.Message,
		})
		c.Header("Content-Type", "text/event-stream")
		c.Header("Cache-Control", "no-cache")
		c.Header("Connection", "keep-alive")
		writeSSE(c.Writer, "message", map[string]any{
			"sessionId": session.ID,
			"content":   "您的消息已转达人工客服，请稍候...",
			"status":    "human",
		})
		writeSSE(c.Writer, "done", map[string]any{"sessionId": session.ID})
		return
	}

	// Intent recognition
	recognized, _ := h.intent.Recognize(c.Request.Context(), req.Message, session.Messages)
	if recognized != nil {
		h.sessions.SetIntent(session.ID, recognized.Name)
	}

	if recognized != nil && h.intent.NeedsHuman(recognized.Name) {
		h.sessions.SetStatus(session.ID, "human")
		h.sessions.AddMessage(session.ID, model.Message{Role: model.RoleUser, Content: req.Message})

		transferMsg := "正在为您转接人工客服，请稍候..."
		h.sessions.AddMessage(session.ID, model.Message{Role: model.RoleAssistant, Content: transferMsg})

		h.hub.Broadcast <- &model.WSMessage{
			Type:      "transfer_request",
			SessionID: session.ID,
			Content:   fmt.Sprintf("用户请求人工服务 [意图: %s]", recognized.Name),
		}

		c.Header("Content-Type", "text/event-stream")
		c.Header("Cache-Control", "no-cache")
		c.Header("Connection", "keep-alive")
		writeSSE(c.Writer, "intent", map[string]any{"intent": recognized})
		writeSSE(c.Writer, "message", map[string]any{"content": transferMsg, "status": "human"})
		writeSSE(c.Writer, "done", map[string]any{"sessionId": session.ID})
		return
	}

	h.sessions.AddMessage(session.ID, model.Message{Role: model.RoleUser, Content: req.Message})

	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")

	if recognized != nil {
		writeSSE(c.Writer, "intent", map[string]any{"intent": recognized})
	}

	writeSSE(c.Writer, "session", map[string]any{"sessionId": session.ID, "status": session.Status})

	var fullAnswer string
	err := h.rag.AnswerStream(c.Request.Context(), req.Message, session.Messages, func(chunk string) error {
		fullAnswer += chunk
		writeSSE(c.Writer, "delta", map[string]any{"content": chunk})
		c.Writer.(http.Flusher).Flush()
		return nil
	})

	if err != nil {
		log.Printf("RAG stream error: %v", err)
		errMsg := "抱歉，处理出现问题，请稍后再试。"
		writeSSE(c.Writer, "error", map[string]any{"message": errMsg})
		fullAnswer = errMsg
	}

	h.sessions.AddMessage(session.ID, model.Message{
		Role:    model.RoleAssistant,
		Content: fullAnswer,
	})

	writeSSE(c.Writer, "done", map[string]any{"sessionId": session.ID})
	c.Writer.(http.Flusher).Flush()
}

// TransferToHuman manually transfers a session to human agent
func (h *ChatHandler) TransferToHuman(c *gin.Context) {
	sessionID := c.Param("id")
	session := h.sessions.Get(sessionID)
	if session == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "session not found"})
		return
	}

	h.sessions.SetStatus(sessionID, "human")

	h.hub.Broadcast <- &model.WSMessage{
		Type:      "transfer_request",
		SessionID: sessionID,
		Content:   "会话已手动转接人工客服",
	}

	c.JSON(http.StatusOK, gin.H{"status": "transferred", "sessionId": sessionID})
}

// TransferToAI transfers a session back to AI
func (h *ChatHandler) TransferToAI(c *gin.Context) {
	sessionID := c.Param("id")
	session := h.sessions.Get(sessionID)
	if session == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "session not found"})
		return
	}

	h.sessions.SetStatus(sessionID, "ai")
	h.sessions.SetAgent(sessionID, "")

	h.hub.SendToSession(sessionID, &model.WSMessage{
		Type:      "transfer_to_ai",
		SessionID: sessionID,
		Content:   "会话已转回 AI 客服",
	})

	c.JSON(http.StatusOK, gin.H{"status": "ai", "sessionId": sessionID})
}

func writeSSE(w io.Writer, event string, data any) {
	jsonData, _ := json.Marshal(data)
	fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event, jsonData)
}
