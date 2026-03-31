import { ref } from "vue";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls?: ToolCallEvent[];
  timestamp: number;
}

export interface ToolCallEvent {
  type: "tool_start" | "tool_end";
  tool: string;
  input?: unknown;
  output?: string;
}

export interface AgentConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

const DEFAULT_CONFIG: AgentConfig = {
  apiKey: "",
  baseUrl: "https://api.openai.com",
  model: "gpt-4o-mini",
  temperature: 0.7,
  maxTokens: 2048,
};

export function useAgent() {
  const messages = ref<ChatMessage[]>([]);
  const isLoading = ref(false);
  const agentConfig = ref<AgentConfig>({ ...DEFAULT_CONFIG });
  const currentToolCalls = ref<ToolCallEvent[]>([]);

  // Load config from localStorage
  const savedConfig = localStorage.getItem("agent-config");
  if (savedConfig) {
    try {
      Object.assign(agentConfig.value, JSON.parse(savedConfig));
    } catch {
      // ignore
    }
  }

  function saveConfig() {
    localStorage.setItem("agent-config", JSON.stringify(agentConfig.value));
  }

  function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function applyClientToolEffect(tool: string, output?: string) {
    if (tool !== "set_page_background_color" || !output) return;

    try {
      const parsed = JSON.parse(output) as { action?: string; color?: string; success?: boolean };
      if (parsed.action !== "set_page_background_color" || !parsed.success || !parsed.color) return;

      // Apply background color to chat message container.
      const chatMessages = document.querySelector<HTMLElement>(".chat-messages");
      if (chatMessages) {
        chatMessages.style.background = parsed.color;
      }
    } catch {
      // ignore malformed tool output
    }
  }

  async function sendMessage(content: string) {
    if (!content.trim() || isLoading.value) return;

    // Add user message
    const userMsg: ChatMessage = {
      id: generateId(),
      role: "user",
      content: content.trim(),
      timestamp: Date.now(),
    };
    messages.value.push(userMsg);

    // Prepare assistant message placeholder
    messages.value = [
      ...messages.value,
      {
        id: generateId(),
        role: "assistant",
        content: "",
        toolCalls: [],
        timestamp: Date.now(),
      },
    ];

    isLoading.value = true;
    currentToolCalls.value = [];

    // Helper: get the last (assistant) message by index to avoid stale references
    const lastIdx = () => messages.value.length - 1;
    const updateLast = (updater: (msg: ChatMessage) => ChatMessage) => {
      const idx = lastIdx();
      const updated = updater({ ...messages.value[idx] });
      messages.value = [
        ...messages.value.slice(0, idx),
        updated,
      ];
    };

    try {
      // Build chat history (exclude the empty assistant placeholder)
      const chatHistory = messages.value.slice(0, -1);
      const body = {
        messages: chatHistory
          .filter((m) => m.role !== "assistant" || m.content)
          .map((m) => ({ role: m.role, content: m.content })),
        model: agentConfig.value.model,
        apiKey: agentConfig.value.apiKey,
        baseUrl: agentConfig.value.baseUrl,
        temperature: agentConfig.value.temperature,
        maxTokens: agentConfig.value.maxTokens,
      };

      const response = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;

          const data = trimmed.slice(6);
          if (data === "[DONE]") {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(data);

            if (parsed.type === "token") {
              updateLast((msg) => ({
                ...msg,
                content: msg.content + (parsed.content || ""),
              }));
            }

            if (parsed.type === "tool_start") {
              const toolEvent: ToolCallEvent = {
                type: "tool_start",
                tool: parsed.tool,
                input: parsed.input,
              };
              currentToolCalls.value.push(toolEvent);
              updateLast((msg) => ({
                ...msg,
                toolCalls: [...currentToolCalls.value],
              }));
            }

            if (parsed.type === "tool_end") {
              const toolEvent: ToolCallEvent = {
                type: "tool_end",
                tool: parsed.tool,
                output: parsed.output,
              };
              applyClientToolEffect(parsed.tool, parsed.output);
              currentToolCalls.value.push(toolEvent);
              updateLast((msg) => ({
                ...msg,
                toolCalls: [...currentToolCalls.value],
              }));
            }

            if (parsed.type === "error") {
              updateLast((msg) => ({
                ...msg,
                content: msg.content + `\n\n⚠️ ${parsed.message}`,
              }));
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      updateLast((msg) => ({
        ...msg,
        content: `❌ 请求失败: ${errMsg}`,
      }));
    } finally {
      isLoading.value = false;
    }
  }

  function clearMessages() {
    messages.value = [];
    currentToolCalls.value = [];
  }

  return {
    messages,
    isLoading,
    agentConfig,
    currentToolCalls,
    sendMessage,
    clearMessages,
    saveConfig,
  };
}
