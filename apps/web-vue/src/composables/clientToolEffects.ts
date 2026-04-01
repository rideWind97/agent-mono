/**
 * Client-side tool effect registry.
 *
 * When the LangChain agent finishes executing a tool whose output should
 * trigger a browser-side side-effect (DOM manipulation, notifications, …),
 * register a handler here.
 *
 * Usage:
 *   1. Write a handler function that matches `ToolEffectHandler`.
 *   2. Call `registerToolEffect(toolName, handler)` — typically at module
 *      top-level so it runs once on import.
 *   3. In the SSE stream consumer (`useAgent.ts`) call
 *      `dispatchToolEffect(toolName, output)` when a `tool_end` event
 *      arrives.  That's it — no switch/if-else chain needed.
 */

// ─── Types ───────────────────────────────────────────────────────────

/** Parsed tool output that every handler receives. */
export interface ToolEffectPayload {
  action?: string;
  color?: string;
  success?: boolean;
  message?: string;
  accept?: string;
  multiple?: boolean;
  hint?: string;
  /** Allow arbitrary extra fields from future tools. */
  [key: string]: unknown;
}

export interface ToolEffectContext {
  addImagePreview?: (params: { name: string; url: string }) => void;
  appendAssistantText?: (text: string) => void;
}

/**
 * A handler that performs a client-side effect.
 * Return `true` if the effect was applied successfully (for logging / testing).
 */
export type ToolEffectHandler = (
  payload: ToolEffectPayload,
  context: ToolEffectContext,
) => boolean | Promise<boolean>;

// ─── Registry ────────────────────────────────────────────────────────

const registry = new Map<string, ToolEffectHandler>();

/**
 * Register a client-side effect handler for a given tool name.
 * If a handler already exists for that name it will be replaced.
 */
export function registerToolEffect(toolName: string, handler: ToolEffectHandler): void {
  registry.set(toolName, handler);
}

/**
 * Remove a previously registered handler (useful in tests / HMR).
 */
export function unregisterToolEffect(toolName: string): void {
  registry.delete(toolName);
}

/**
 * Dispatch a tool effect.
 *
 * Call this from the SSE stream consumer when a `tool_end` event is received.
 * It parses the raw JSON output, looks up the matching handler, and invokes it.
 *
 * Returns `true` if a handler was found **and** executed successfully.
 */
export async function dispatchToolEffect(
  toolName: string,
  rawOutput?: string,
  context: ToolEffectContext = {},
): Promise<boolean> {
  if (!rawOutput) return false;

  const handler = registry.get(toolName);
  if (!handler) return false;

  try {
    const payload: ToolEffectPayload = JSON.parse(rawOutput);
    return await handler(payload, context);
  } catch {
    // malformed JSON — silently ignore
    return false;
  }
}

function pickImageFile(accept: string, multiple: boolean): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept || "image/*";
    input.multiple = multiple;
    input.style.display = "none";
    document.body.appendChild(input);

    input.addEventListener(
      "change",
      () => {
        const file = input.files?.[0] ?? null;
        input.remove();
        resolve(file);
      },
      { once: true },
    );

    input.click();
  });
}

// ─── Built-in effects ────────────────────────────────────────────────
// Each effect is self-registering: importing this module is enough.

/** 🎨 set_page_background_color */
registerToolEffect("set_page_background_color", (payload) => {
  if (payload.action !== "set_page_background_color") return false;
  if (!payload.success || !payload.color) return false;

  const el = document.querySelector<HTMLElement>(".chat-messages");
  if (!el) return false;

  el.style.background = payload.color as string;
  return true;
});

/** 📷 request_image_upload */
registerToolEffect("request_image_upload", async (payload, context) => {
  if (payload.action !== "request_image_upload") return false;
  if (!payload.success) return false;

  const file = await pickImageFile(
    typeof payload.accept === "string" ? payload.accept : "image/*",
    Boolean(payload.multiple),
  );
  if (!file) {
    context.appendAssistantText?.("\n\n⚠️ 你取消了图片上传。");
    return false;
  }

  const objectUrl = URL.createObjectURL(file);
  context.addImagePreview?.({ name: file.name, url: objectUrl });
  context.appendAssistantText?.(`\n\n✅ 已选择图片：${file.name}`);
  return true;
});
