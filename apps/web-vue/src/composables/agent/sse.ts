import type { AgentServerEvent } from "./types";

function parseSseLine(line: string): AgentServerEvent | null {
  const trimmed = line.trim();
  if (!trimmed || !trimmed.startsWith("data: ")) return null;

  const data = trimmed.slice(6);
  if (data === "[DONE]") return null;

  try {
    return JSON.parse(data) as AgentServerEvent;
  } catch {
    return null;
  }
}

export async function* streamAgentEvents(response: Response): AsyncGenerator<AgentServerEvent> {
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

      const event = parseSseLine(line);
      if (event) {
        yield event;
      }
    }
  }
}
