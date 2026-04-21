package chat

import (
	"sync"
	"time"

	"github.com/agent-mono/cs-server/internal/model"
	"github.com/google/uuid"
)

// SessionManager provides in-memory multi-turn conversation management.
// In production, back this with Redis or a database.
type SessionManager struct {
	mu       sync.RWMutex
	sessions map[string]*model.Session
}

func NewSessionManager() *SessionManager {
	return &SessionManager{
		sessions: make(map[string]*model.Session),
	}
}

func (m *SessionManager) Create() *model.Session {
	m.mu.Lock()
	defer m.mu.Unlock()

	s := &model.Session{
		ID:        uuid.New().String(),
		Messages:  make([]model.Message, 0),
		Status:    "ai",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
		Metadata:  make(map[string]any),
	}
	m.sessions[s.ID] = s
	return s
}

func (m *SessionManager) Get(id string) *model.Session {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.sessions[id]
}

func (m *SessionManager) GetOrCreate(id string) *model.Session {
	if id != "" {
		if s := m.Get(id); s != nil {
			return s
		}
	}
	return m.Create()
}

func (m *SessionManager) AddMessage(sessionID string, msg model.Message) {
	m.mu.Lock()
	defer m.mu.Unlock()

	s, ok := m.sessions[sessionID]
	if !ok {
		return
	}
	if msg.ID == "" {
		msg.ID = uuid.New().String()
	}
	if msg.Timestamp.IsZero() {
		msg.Timestamp = time.Now()
	}
	s.Messages = append(s.Messages, msg)
	s.UpdatedAt = time.Now()
}

func (m *SessionManager) SetStatus(sessionID, status string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if s, ok := m.sessions[sessionID]; ok {
		s.Status = status
		s.UpdatedAt = time.Now()
	}
}

func (m *SessionManager) SetIntent(sessionID, intent string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if s, ok := m.sessions[sessionID]; ok {
		s.Intent = intent
		s.UpdatedAt = time.Now()
	}
}

func (m *SessionManager) SetAgent(sessionID, agentID string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if s, ok := m.sessions[sessionID]; ok {
		s.AgentID = agentID
		s.UpdatedAt = time.Now()
	}
}

func (m *SessionManager) List() []*model.Session {
	m.mu.RLock()
	defer m.mu.RUnlock()

	list := make([]*model.Session, 0, len(m.sessions))
	for _, s := range m.sessions {
		list = append(list, s)
	}
	return list
}

func (m *SessionManager) ListByStatus(status string) []*model.Session {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var list []*model.Session
	for _, s := range m.sessions {
		if s.Status == status {
			list = append(list, s)
		}
	}
	return list
}
