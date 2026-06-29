import { createInterface } from "node:readline/promises";

import { chatCompletion, formatUsage, type ChatMessage } from "./lib/chat-api.js";
import { assertLlmEnv } from "./lib/env.js";

assertLlmEnv();

async function main() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const messages: ChatMessage[] = [
    { role: "system", content: "你是一个简洁友好的学习助手。回答尽量简短。" },
  ];

  console.log("Week 1 对话练习（输入 exit 退出）\n");

  let round = 0;
  while (true) {
    const input = (await rl.question("你: ")).trim();
    if (!input || input === "exit") break;

    round += 1;
    messages.push({ role: "user", content: input });
    const { content, usage } = await chatCompletion(messages);
    messages.push({ role: "assistant", content });

    console.log(`\nAI: ${content}`);
    console.log(`tokens — ${formatUsage(usage)}\n`);
  }

  rl.close();
  console.log(`本次共对话 ${round} 轮`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
