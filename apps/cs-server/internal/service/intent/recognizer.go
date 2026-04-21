package intent

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/agent-mono/cs-server/internal/model"
	"github.com/agent-mono/cs-server/pkg/llm"
)

var DefaultIntents = []model.IntentDefinition{
	{
		Name:        "product_inquiry",
		Description: "用户咨询产品信息、功能、价格",
		Examples:    []string{"你们有什么产品", "这个产品多少钱", "功能介绍一下"},
	},
	{
		Name:        "order_query",
		Description: "用户查询订单状态、物流信息",
		Examples:    []string{"我的订单到哪了", "查一下订单状态", "物流信息"},
	},
	{
		Name:        "tech_support",
		Description: "技术问题、故障排查、使用帮助",
		Examples:    []string{"系统报错了", "怎么设置", "无法登录"},
	},
	{
		Name:        "complaint",
		Description: "用户投诉、不满、要求赔偿",
		Examples:    []string{"我要投诉", "太差了", "要求退款"},
		RequireHuman: true,
	},
	{
		Name:        "human_agent",
		Description: "用户主动要求转人工服务",
		Examples:    []string{"转人工", "我要找人工客服", "让人来处理"},
		RequireHuman: true,
	},
	{
		Name:        "greeting",
		Description: "打招呼、寒暄",
		Examples:    []string{"你好", "在吗", "hi"},
	},
	{
		Name:        "other",
		Description: "其他无法归类的意图",
		Examples:    []string{},
	},
}

type Recognizer struct {
	llm     *llm.Client
	intents []model.IntentDefinition
}

func NewRecognizer(llmClient *llm.Client) *Recognizer {
	return &Recognizer{
		llm:     llmClient,
		intents: DefaultIntents,
	}
}

func (r *Recognizer) Recognize(ctx context.Context, message string, history []model.Message) (*model.Intent, error) {
	intentDescs := make([]string, 0, len(r.intents))
	for _, def := range r.intents {
		examples := strings.Join(def.Examples, "、")
		intentDescs = append(intentDescs, fmt.Sprintf("- %s: %s (示例: %s)", def.Name, def.Description, examples))
	}

	historyStr := ""
	if len(history) > 0 {
		start := len(history) - 6
		if start < 0 {
			start = 0
		}
		for _, m := range history[start:] {
			historyStr += fmt.Sprintf("%s: %s\n", m.Role, m.Content)
		}
	}

	prompt := fmt.Sprintf(`你是一个意图识别引擎。根据用户消息和对话历史，识别用户意图。

可选意图列表:
%s

对话历史:
%s

用户最新消息: %s

请以JSON格式返回，包含以下字段:
- name: 意图名称 (必须是上述列表中的一个)
- confidence: 置信度 (0-1之间的浮点数)
- slots: 提取的关键信息 (对象，如订单号、产品名等)

只返回JSON，不要其他内容。`, strings.Join(intentDescs, "\n"), historyStr, message)

	resp, err := r.llm.Chat(ctx, []llm.ChatMessage{
		{Role: "system", Content: "You are an intent recognition engine. Always respond with valid JSON only."},
		{Role: "user", Content: prompt},
	})
	if err != nil {
		return r.fallbackRecognize(message), nil
	}

	resp = strings.TrimSpace(resp)
	resp = strings.TrimPrefix(resp, "```json")
	resp = strings.TrimPrefix(resp, "```")
	resp = strings.TrimSuffix(resp, "```")
	resp = strings.TrimSpace(resp)

	var intent model.Intent
	if err := json.Unmarshal([]byte(resp), &intent); err != nil {
		return r.fallbackRecognize(message), nil
	}
	return &intent, nil
}

func (r *Recognizer) fallbackRecognize(message string) *model.Intent {
	msg := strings.ToLower(message)

	if strings.Contains(msg, "转人工") || strings.Contains(msg, "人工客服") {
		return &model.Intent{Name: "human_agent", Confidence: 0.95}
	}
	if strings.Contains(msg, "投诉") || strings.Contains(msg, "退款") {
		return &model.Intent{Name: "complaint", Confidence: 0.8}
	}
	if strings.Contains(msg, "订单") || strings.Contains(msg, "物流") || strings.Contains(msg, "快递") {
		return &model.Intent{Name: "order_query", Confidence: 0.8}
	}
	if strings.Contains(msg, "价格") || strings.Contains(msg, "产品") || strings.Contains(msg, "多少钱") {
		return &model.Intent{Name: "product_inquiry", Confidence: 0.8}
	}
	if strings.Contains(msg, "报错") || strings.Contains(msg, "故障") || strings.Contains(msg, "怎么") {
		return &model.Intent{Name: "tech_support", Confidence: 0.7}
	}
	if strings.Contains(msg, "你好") || strings.Contains(msg, "hi") || strings.Contains(msg, "hello") {
		return &model.Intent{Name: "greeting", Confidence: 0.9}
	}
	return &model.Intent{Name: "other", Confidence: 0.5}
}

func (r *Recognizer) NeedsHuman(intentName string) bool {
	for _, def := range r.intents {
		if def.Name == intentName {
			return def.RequireHuman
		}
	}
	return false
}

func (r *Recognizer) GetIntents() []model.IntentDefinition {
	return r.intents
}
