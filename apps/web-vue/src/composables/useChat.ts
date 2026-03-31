import OpenAI from "openai";
import { ref } from "vue";

export interface SimpleChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface ChatConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

const DEFAULT_CONFIG: ChatConfig = {
  apiKey: "",
  baseUrl: "https://api.deepseek.com",
  model: "deepseek-chat",
  temperature: 0.7,
  maxTokens: 2048,
};

export function useChat() {
  const messages = ref<SimpleChatMessage[]>([]);
  const isLoading = ref(false);
  const chatConfig = ref<ChatConfig>({ ...DEFAULT_CONFIG });

  // Load config from localStorage
  const savedConfig = localStorage.getItem("chat-config");
  if (savedConfig) {
    try {
      Object.assign(chatConfig.value, JSON.parse(savedConfig));
    } catch {
      // ignore
    }
  }

  function saveConfig() {
    localStorage.setItem("chat-config", JSON.stringify(chatConfig.value));
  }

  function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  async function sendMessage(content: string) {
    if (!content.trim() || isLoading.value) return;

    // Add user message
    const userMsg: SimpleChatMessage = {
      id: generateId(),
      role: "user",
      content: content.trim(),
      timestamp: Date.now(),
    };
    messages.value.push(userMsg);

    // Prepare assistant message placeholder
    messages.value.push({
      id: generateId(),
      role: "assistant",
      content: "",
      timestamp: Date.now(),
    });

    // Index of the assistant message we'll be updating
    const assistantIdx = messages.value.length - 1;

    isLoading.value = true;

    try {
      // Create OpenAI client with current config
      const openai = new OpenAI({
        baseURL: chatConfig.value.baseUrl,
        apiKey: chatConfig.value.apiKey,
        dangerouslyAllowBrowser: true,
      });

      // Build message history (exclude the empty assistant placeholder)
      const chatHistory = messages.value.slice(0, -1);
      const apiMessages: OpenAI.ChatCompletionMessageParam[] = [
        { role: "system", content: "You are a helpful assistant." },
        ...chatHistory
          .filter((m) => m.role !== "assistant" || m.content)
          .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      ];

      // Stream response using OpenAI SDK
      const stream = await openai.chat.completions.create({
        model: chatConfig.value.model,
        messages: apiMessages,
        temperature: chatConfig.value.temperature,
        max_tokens: chatConfig.value.maxTokens,
        stream: true,
      });

      let accumulated = "";
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          accumulated += delta;
          // Update via index so Vue reactivity picks up the change
          messages.value[assistantIdx] = {
            ...messages.value[assistantIdx],
            content: accumulated,
          };
        }
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      messages.value[assistantIdx] = {
        ...messages.value[assistantIdx],
        content: `❌ 请求失败: ${errMsg}`,
      };
    } finally {
      isLoading.value = false;
    }
  }

  function clearMessages() {
    messages.value = [];
  }

  return {
    messages,
    isLoading,
    chatConfig,
    sendMessage,
    clearMessages,
    saveConfig,
  };
}
