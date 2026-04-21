import { ref, onUnmounted } from "vue";
import type { WSMessage } from "@/types";

export function useWebSocket() {
  const connected = ref(false);
  const lastMessage = ref<WSMessage | null>(null);
  const error = ref("");
  let ws: WebSocket | null = null;
  const listeners: Array<(msg: WSMessage) => void> = [];

  function connect(path: string, sessionId: string) {
    disconnect();

    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${location.host}${path}?sessionId=${sessionId}`;

    ws = new WebSocket(url);

    ws.onopen = () => {
      connected.value = true;
      error.value = "";
    };

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        lastMessage.value = msg;
        listeners.forEach((fn) => fn(msg));
      } catch {
        // ignore non-JSON messages
      }
    };

    ws.onerror = () => {
      error.value = "WebSocket 连接失败";
    };

    ws.onclose = () => {
      connected.value = false;
    };
  }

  function disconnect() {
    if (ws) {
      ws.close();
      ws = null;
      connected.value = false;
    }
  }

  function send(msg: WSMessage) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  function onMessage(fn: (msg: WSMessage) => void) {
    listeners.push(fn);
    return () => {
      const idx = listeners.indexOf(fn);
      if (idx > -1) listeners.splice(idx, 1);
    };
  }

  onUnmounted(() => disconnect());

  return {
    connected,
    lastMessage,
    error,
    connect,
    disconnect,
    send,
    onMessage,
  };
}
