import { config } from "dotenv";
import { createInterface } from "node:readline/promises";
import { resolve } from "node:path";

// 优先加载仓库根目录 .env
config({ path: resolve(import.meta.dirname, "../../../.env") });

const apiKey = process.env.OPENAI_API_KEY;
const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

if (!apiKey || apiKey === "sk-your-key-here") {
  console.error("请先在仓库根目录 .env 中配置 OPENAI_API_KEY");
  process.exit(1);
}

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

async function chat(messages: ChatMessage[], temperature = 0.7) {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, temperature }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API ${res.status}: ${err}`);
  }

  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  };

  return {
    content: data.choices[0]?.message.content ?? "",
    usage: data.usage,
  };
}

async function main() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const messages: ChatMessage[] = [
    { role: "system", content: "你是一个简洁友好的学习助手。" },
  ];

  console.log("Week 1 对话练习（输入 exit 退出）\n");

  while (true) {
    const input = (await rl.question("你: ")).trim();
    if (!input || input === "exit") break;

    messages.push({ role: "user", content: input });
    const { content, usage } = await chat(messages);
    messages.push({ role: "assistant", content });

    console.log(`\nAI: ${content}\n`);
    if (usage) {
      console.log(
        `tokens — input: ${usage.prompt_tokens}, output: ${usage.completion_tokens}, total: ${usage.total_tokens}\n`,
      );
    }
  }

  rl.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
