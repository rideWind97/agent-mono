package rag

import (
	"context"
	"fmt"
	"strings"

	"github.com/agent-mono/cs-server/internal/model"
	"github.com/agent-mono/cs-server/internal/service/knowledge"
	"github.com/agent-mono/cs-server/pkg/llm"
)

type Service struct {
	llm   *llm.Client
	store *knowledge.Store
}

func NewService(llmClient *llm.Client, store *knowledge.Store) *Service {
	return &Service{llm: llmClient, store: store}
}

func (s *Service) buildSystemPrompt(ctx context.Context, query string) (string, error) {
	chunks, err := s.store.Search(ctx, query, 3)
	if err != nil {
		return s.defaultSystemPrompt(), nil
	}

	if len(chunks) == 0 || chunks[0].Score < 0.3 {
		return s.defaultSystemPrompt(), nil
	}

	var contextParts []string
	for i, c := range chunks {
		contextParts = append(contextParts, fmt.Sprintf("[参考文档%d] (相关度: %.2f)\n%s", i+1, c.Score, c.Content))
	}

	return fmt.Sprintf(`你是一个专业的智能客服助手。请基于以下知识库内容回答用户问题。

%s

回答要求:
1. 优先使用知识库中的信息回答
2. 如果知识库中没有相关信息，坦诚告知并提供通用建议
3. 保持友好、专业的语气
4. 回答要简洁明了，重点突出
5. 如果问题涉及敏感操作（退款、投诉等），建议转接人工客服`, strings.Join(contextParts, "\n\n")), nil
}

func (s *Service) Answer(ctx context.Context, query string, history []model.Message) (string, error) {
	sysPrompt, err := s.buildSystemPrompt(ctx, query)
	if err != nil {
		sysPrompt = s.defaultSystemPrompt()
	}

	messages := []llm.ChatMessage{{Role: "system", Content: sysPrompt}}

	start := len(history) - 10
	if start < 0 {
		start = 0
	}
	for _, m := range history[start:] {
		messages = append(messages, llm.ChatMessage{Role: string(m.Role), Content: m.Content})
	}

	messages = append(messages, llm.ChatMessage{Role: "user", Content: query})
	return s.llm.Chat(ctx, messages)
}

func (s *Service) AnswerStream(ctx context.Context, query string, history []model.Message, handler llm.StreamHandler) error {
	sysPrompt, err := s.buildSystemPrompt(ctx, query)
	if err != nil {
		sysPrompt = s.defaultSystemPrompt()
	}

	messages := []llm.ChatMessage{{Role: "system", Content: sysPrompt}}

	start := len(history) - 10
	if start < 0 {
		start = 0
	}
	for _, m := range history[start:] {
		messages = append(messages, llm.ChatMessage{Role: string(m.Role), Content: m.Content})
	}

	messages = append(messages, llm.ChatMessage{Role: "user", Content: query})
	return s.llm.ChatStream(ctx, messages, handler)
}

func (s *Service) defaultSystemPrompt() string {
	return `你是一个专业的智能客服助手。请遵循以下原则:
1. 保持友好、专业的语气
2. 回答要简洁明了，重点突出
3. 如果不确定答案，坦诚告知并建议转人工客服
4. 对于投诉、退款等敏感操作，建议转接人工处理`
}
