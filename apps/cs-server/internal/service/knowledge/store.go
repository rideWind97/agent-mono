package knowledge

import (
	"context"
	"math"
	"sort"
	"strings"
	"sync"

	"github.com/agent-mono/cs-server/internal/model"
	"github.com/agent-mono/cs-server/pkg/llm"
	"github.com/google/uuid"
)

// Store is an in-memory vector store for knowledge base documents.
// In production, replace with a proper vector DB (Milvus, Qdrant, etc.).
type Store struct {
	mu     sync.RWMutex
	docs   map[string]*model.KnowledgeDoc
	chunks []model.KnowledgeChunk
	llm    *llm.Client
}

func NewStore(llmClient *llm.Client) *Store {
	return &Store{
		docs:   make(map[string]*model.KnowledgeDoc),
		chunks: make([]model.KnowledgeChunk, 0),
		llm:    llmClient,
	}
}

func (s *Store) AddDocument(ctx context.Context, doc model.KnowledgeDoc) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if doc.ID == "" {
		doc.ID = uuid.New().String()
	}
	s.docs[doc.ID] = &doc

	paragraphs := splitIntoParagraphs(doc.Content, 500)
	for _, p := range paragraphs {
		emb, err := s.llm.Embedding(ctx, p)
		if err != nil {
			emb = nil // fallback: keyword search only
		}
		s.chunks = append(s.chunks, model.KnowledgeChunk{
			DocID:     doc.ID,
			Content:   p,
			Embedding: emb,
		})
	}
	return nil
}

func (s *Store) Search(ctx context.Context, query string, topK int) ([]model.KnowledgeChunk, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if topK <= 0 {
		topK = 3
	}

	queryEmb, err := s.llm.Embedding(ctx, query)

	type scored struct {
		chunk model.KnowledgeChunk
		score float64
	}
	var results []scored

	for _, chunk := range s.chunks {
		var score float64
		if err == nil && len(queryEmb) > 0 && len(chunk.Embedding) > 0 {
			score = cosineSimilarity(queryEmb, chunk.Embedding)
		} else {
			score = keywordScore(query, chunk.Content)
		}
		results = append(results, scored{chunk: chunk, score: score})
	}

	sort.Slice(results, func(i, j int) bool {
		return results[i].score > results[j].score
	})

	out := make([]model.KnowledgeChunk, 0, topK)
	for i := 0; i < len(results) && i < topK; i++ {
		c := results[i].chunk
		c.Score = results[i].score
		out = append(out, c)
	}
	return out, nil
}

func (s *Store) ListDocs() []model.KnowledgeDoc {
	s.mu.RLock()
	defer s.mu.RUnlock()
	docs := make([]model.KnowledgeDoc, 0, len(s.docs))
	for _, d := range s.docs {
		docs = append(docs, *d)
	}
	return docs
}

func (s *Store) GetDoc(id string) *model.KnowledgeDoc {
	s.mu.RLock()
	defer s.mu.RUnlock()
	d := s.docs[id]
	return d
}

func (s *Store) DeleteDoc(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.docs, id)
	filtered := s.chunks[:0]
	for _, c := range s.chunks {
		if c.DocID != id {
			filtered = append(filtered, c)
		}
	}
	s.chunks = filtered
}

func cosineSimilarity(a, b []float64) float64 {
	if len(a) != len(b) {
		return 0
	}
	var dot, normA, normB float64
	for i := range a {
		dot += a[i] * b[i]
		normA += a[i] * a[i]
		normB += b[i] * b[i]
	}
	if normA == 0 || normB == 0 {
		return 0
	}
	return dot / (math.Sqrt(normA) * math.Sqrt(normB))
}

func keywordScore(query, text string) float64 {
	qWords := strings.Fields(strings.ToLower(query))
	tLower := strings.ToLower(text)
	matched := 0
	for _, w := range qWords {
		if strings.Contains(tLower, w) {
			matched++
		}
	}
	if len(qWords) == 0 {
		return 0
	}
	return float64(matched) / float64(len(qWords))
}

func splitIntoParagraphs(text string, maxLen int) []string {
	paragraphs := strings.Split(text, "\n\n")
	var result []string
	for _, p := range paragraphs {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		if len(p) <= maxLen {
			result = append(result, p)
		} else {
			for i := 0; i < len(p); i += maxLen {
				end := i + maxLen
				if end > len(p) {
					end = len(p)
				}
				result = append(result, p[i:end])
			}
		}
	}
	return result
}
