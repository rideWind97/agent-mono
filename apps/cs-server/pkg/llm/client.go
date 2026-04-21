package llm

import (
	"context"
	"errors"
	"io"

	openai "github.com/sashabaranov/go-openai"
)

type Client struct {
	client *openai.Client
	model  string
}

func NewClient(apiKey, baseURL, model string) *Client {
	cfg := openai.DefaultConfig(apiKey)
	if baseURL != "" {
		cfg.BaseURL = baseURL
	}
	return &Client{
		client: openai.NewClientWithConfig(cfg),
		model:  model,
	}
}

type ChatMessage struct {
	Role    string
	Content string
}

func (c *Client) Chat(ctx context.Context, messages []ChatMessage) (string, error) {
	msgs := make([]openai.ChatCompletionMessage, len(messages))
	for i, m := range messages {
		msgs[i] = openai.ChatCompletionMessage{Role: m.Role, Content: m.Content}
	}

	resp, err := c.client.CreateChatCompletion(ctx, openai.ChatCompletionRequest{
		Model:    c.model,
		Messages: msgs,
	})
	if err != nil {
		return "", err
	}
	if len(resp.Choices) == 0 {
		return "", errors.New("no choices returned")
	}
	return resp.Choices[0].Message.Content, nil
}

type StreamHandler func(chunk string) error

func (c *Client) ChatStream(ctx context.Context, messages []ChatMessage, handler StreamHandler) error {
	msgs := make([]openai.ChatCompletionMessage, len(messages))
	for i, m := range messages {
		msgs[i] = openai.ChatCompletionMessage{Role: m.Role, Content: m.Content}
	}

	stream, err := c.client.CreateChatCompletionStream(ctx, openai.ChatCompletionRequest{
		Model:    c.model,
		Messages: msgs,
		Stream:   true,
	})
	if err != nil {
		return err
	}
	defer stream.Close()

	for {
		resp, err := stream.Recv()
		if errors.Is(err, io.EOF) {
			return nil
		}
		if err != nil {
			return err
		}
		if len(resp.Choices) > 0 && resp.Choices[0].Delta.Content != "" {
			if err := handler(resp.Choices[0].Delta.Content); err != nil {
				return err
			}
		}
	}
}

// Embedding tries to generate an embedding vector.
// DeepSeek and some other providers don't support embeddings —
// callers should handle the error and fall back to keyword search.
func (c *Client) Embedding(ctx context.Context, text string) ([]float64, error) {
	resp, err := c.client.CreateEmbeddings(ctx, openai.EmbeddingRequest{
		Input: []string{text},
		Model: openai.SmallEmbedding3,
	})
	if err != nil {
		return nil, err
	}
	if len(resp.Data) == 0 {
		return nil, errors.New("no embedding returned")
	}
	result := make([]float64, len(resp.Data[0].Embedding))
	for i, v := range resp.Data[0].Embedding {
		result[i] = float64(v)
	}
	return result, nil
}
