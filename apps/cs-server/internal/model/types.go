package model

import "time"

type Role string

const (
	RoleUser      Role = "user"
	RoleAssistant Role = "assistant"
	RoleSystem    Role = "system"
)

type Message struct {
	ID        string    `json:"id"`
	Role      Role      `json:"role"`
	Content   string    `json:"content"`
	Timestamp time.Time `json:"timestamp"`
}

type Session struct {
	ID        string    `json:"id"`
	Messages  []Message `json:"messages"`
	Intent    string    `json:"intent"`
	Status    string    `json:"status"` // "ai" | "human" | "closed"
	AgentID   string    `json:"agentId,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
	Metadata  map[string]any `json:"metadata,omitempty"`
}

type Intent struct {
	Name       string  `json:"name"`
	Confidence float64 `json:"confidence"`
	Slots      map[string]string `json:"slots,omitempty"`
}

type IntentDefinition struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Examples    []string `json:"examples"`
	RequireHuman bool    `json:"requireHuman"`
}

type KnowledgeDoc struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Content  string `json:"content"`
	Category string `json:"category"`
}

type KnowledgeChunk struct {
	DocID    string    `json:"docId"`
	Content  string    `json:"content"`
	Embedding []float64 `json:"embedding,omitempty"`
	Score    float64   `json:"score,omitempty"`
}

type ChatRequest struct {
	SessionID string `json:"sessionId"`
	Message   string `json:"message"`
}

type ChatResponse struct {
	SessionID string  `json:"sessionId"`
	Message   string  `json:"message"`
	Intent    *Intent `json:"intent,omitempty"`
	Status    string  `json:"status"`
}

type SSEEvent struct {
	Event string `json:"event"`
	Data  any    `json:"data"`
}

type WSMessage struct {
	Type      string `json:"type"`
	SessionID string `json:"sessionId"`
	Content   string `json:"content,omitempty"`
	From      string `json:"from,omitempty"`
}
