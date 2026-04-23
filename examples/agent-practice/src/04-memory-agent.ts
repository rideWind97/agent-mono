/**
 * ============================================================
 * Part 4: Agent 记忆系统 —— 短期记忆 + 长期记忆
 * ============================================================
 *
 * Agent 记忆系统的两种类型：
 *
 * 1. 短期记忆（Working Memory / Short-Term）
 *    - 当前会话的消息历史（对话上下文）
 *    - 存在于 LangGraph 的 state.messages 中
 *    - 会话结束即丢失
 *    - 类比：人类的「工作记忆」，正在思考的内容
 *
 * 2. 长期记忆（Long-Term Memory）
 *    - 跨会话持久化的信息（用户偏好、历史摘要）
 *    - 需要外部存储（数据库、文件、向量数据库）
 *    - 会话结束后仍然保留
 *    - 类比：人类的「长期记忆」，过去的经验和知识
 *
 * 本文件演示：
 *   1. LangGraph 的 MemorySaver —— 使 Agent 具备跨轮对话的短期记忆
 *   2. 手动实现的长期记忆系统 —— 提取用户偏好并持久化
 *   3. 记忆摘要压缩 —— 当对话过长时自动总结
 *
 * 为什么记忆很重要？
 *   - 没有记忆的 Agent 每轮对话都是「失忆」的，无法维持连贯的对话
 *   - 短期记忆让 Agent 记住「刚才聊了什么」
 *   - 长期记忆让 Agent 记住「用户是谁、喜欢什么」
 */

import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

import { createLLM, printSection, printStep } from "./config.js";
import { basicTools } from "./tools.js";

// ============================================================
// 第一部分：短期记忆 —— MemorySaver
// ============================================================

/**
 * MemorySaver 是 LangGraph 内置的检查点机制
 *
 * 工作原理：
 * - 每次 Agent 执行后，MemorySaver 自动保存完整状态（包括所有消息历史）
 * - 下次以相同 thread_id 调用时，自动恢复之前的状态
 * - 这样 Agent 就能「记住」之前的对话内容
 *
 * thread_id 的作用：
 * - 唯一标识一个对话会话
 * - 不同 thread_id = 不同的对话上下文 = 互不干扰的记忆空间
 * - 类比：聊天软件的不同聊天窗口
 */
async function demoShortTermMemory() {
  printSection("短期记忆: MemorySaver（跨轮对话）");

  const llm = createLLM();

  // MemorySaver 使用内存存储（生产环境可替换为数据库后端）
  const checkpointer = new MemorySaver();

  const agent = createReactAgent({
    llm,
    tools: basicTools,
    // checkpointer 让 Agent 具备状态持久化能力
    checkpointer,
  });

  // 模拟同一个用户的多轮对话（相同 thread_id）
  const threadId = "user-session-001";
  const config = { configurable: { thread_id: threadId } };

  // 第 1 轮：告诉 Agent 一些信息
  printStep("observe", "第 1 轮对话: 用户自我介绍");
  const response1 = await agent.invoke(
    { messages: [new HumanMessage("我叫小明，我是一个前端开发者，最近在学 AI Agent")] },
    config
  );
  const lastMsg1 = response1.messages[response1.messages.length - 1];
  printStep("result", `Agent 回复: ${typeof lastMsg1?.content === "string" ? lastMsg1.content.slice(0, 150) : "..."}...`);

  // 第 2 轮：测试 Agent 是否记住了之前的信息
  printStep("observe", "第 2 轮对话: 测试记忆（Agent 应该记得名字和职业）");
  const response2 = await agent.invoke(
    { messages: [new HumanMessage("你还记得我叫什么名字吗？我在学什么？")] },
    config
  );
  const lastMsg2 = response2.messages[response2.messages.length - 1];
  printStep("result", `Agent 回复: ${typeof lastMsg2?.content === "string" ? lastMsg2.content.slice(0, 150) : "..."}...`);

  // 第 3 轮：结合工具和记忆
  printStep("observe", "第 3 轮对话: 结合记忆 + 工具调用");
  const response3 = await agent.invoke(
    { messages: [new HumanMessage("帮我查一下北京天气，我周末想出去逛逛")] },
    config
  );
  const lastMsg3 = response3.messages[response3.messages.length - 1];
  printStep("result", `Agent 回复: ${typeof lastMsg3?.content === "string" ? lastMsg3.content.slice(0, 200) : "..."}...`);

  // 验证：用不同的 thread_id，Agent 应该不记得之前的对话
  printStep("observe", "新会话 (不同 thread_id): Agent 应该不记得小明");
  const response4 = await agent.invoke(
    { messages: [new HumanMessage("你知道我叫什么名字吗？")] },
    { configurable: { thread_id: "new-session-999" } }
  );
  const lastMsg4 = response4.messages[response4.messages.length - 1];
  printStep("result", `Agent 回复: ${typeof lastMsg4?.content === "string" ? lastMsg4.content.slice(0, 150) : "..."}...`);

  // 打印消息计数以验证记忆
  console.log(`\n📊 session-001 总消息数: ${response3.messages.length}`);
  console.log(`📊 new-session 总消息数: ${response4.messages.length}`);
}

// ============================================================
// 第二部分：长期记忆 —— 用户偏好提取与持久化
// ============================================================

/**
 * 简单的长期记忆存储
 *
 * 在真实场景中，这应该是：
 * - 向量数据库（用于语义检索历史信息）
 * - 关系数据库（用于结构化用户数据）
 * - Redis/KV 存储（用于快速访问用户偏好）
 *
 * 这里用 Map 模拟，重点展示记忆的存储/检索/更新流程
 */
class LongTermMemoryStore {
  private store = new Map<string, Map<string, string>>();

  /** 获取某个用户的所有记忆 */
  getUserMemory(userId: string): Map<string, string> {
    if (!this.store.has(userId)) {
      this.store.set(userId, new Map());
    }
    return this.store.get(userId)!;
  }

  /** 保存一条记忆 */
  save(userId: string, key: string, value: string) {
    this.getUserMemory(userId).set(key, value);
  }

  /** 读取一条记忆 */
  get(userId: string, key: string): string | undefined {
    return this.getUserMemory(userId).get(key);
  }

  /** 获取用户的所有记忆，格式化为文本（注入到 Prompt 中） */
  formatForPrompt(userId: string): string {
    const memory = this.getUserMemory(userId);
    if (memory.size === 0) return "暂无历史记忆";
    return Array.from(memory.entries())
      .map(([k, v]) => `- ${k}: ${v}`)
      .join("\n");
  }
}

/**
 * 从对话中提取用户偏好，存入长期记忆
 *
 * 使用 LLM 做信息提取（IE）：
 * - 输入：用户说的话
 * - 输出：JSON 格式的偏好信息
 *
 * 这是 LLM 的一个重要应用模式：结构化信息提取
 */
async function extractAndSavePreferences(
  memoryStore: LongTermMemoryStore,
  userId: string,
  userMessage: string
) {
  const llm = createLLM();

  const prompt = ChatPromptTemplate.fromTemplate(
    `从以下用户消息中提取可以记住的偏好或个人信息。
如果没有可提取的信息，返回空 JSON。
只输出 JSON，不要其他内容。

格式示例：
{{"name": "小明", "occupation": "前端开发者", "interest": "AI Agent"}}

用户消息：{message}`
  );

  const chain = prompt.pipe(llm).pipe(new StringOutputParser());
  const extracted = await chain.invoke({ message: userMessage });

  try {
    const prefs = JSON.parse(extracted.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
    for (const [key, value] of Object.entries(prefs)) {
      if (typeof value === "string" && value.trim()) {
        memoryStore.save(userId, key, value);
        printStep("observe", `提取偏好: ${key} = ${value}`);
      }
    }
  } catch {
    // JSON 解析失败说明没有可提取的信息
  }
}

/**
 * 演示长期记忆的完整流程
 */
async function demoLongTermMemory() {
  printSection("长期记忆: 用户偏好提取与个性化回复");

  const memoryStore = new LongTermMemoryStore();
  const userId = "user_xiaoming";
  const llm = createLLM();

  // 模拟多次对话，每次都提取偏好
  const conversations = [
    "我叫小明，是上海的一名前端开发者",
    "我最近在学习 AI Agent 和 LangGraph，特别感兴趣多 Agent 协作",
    "我喜欢用 TypeScript，不太喜欢写 Python",
  ];

  for (const msg of conversations) {
    printStep("observe", `用户说: ${msg}`);
    await extractAndSavePreferences(memoryStore, userId, msg);
  }

  // 查看累积的长期记忆
  console.log(`\n📋 ${userId} 的长期记忆:`);
  console.log(memoryStore.formatForPrompt(userId));

  // 使用长期记忆生成个性化回复
  printStep("think", "基于长期记忆生成个性化推荐...");

  const prompt = ChatPromptTemplate.fromTemplate(
    `你是一个学习助手。根据用户的历史偏好，推荐适合的学习内容。

用户档案：
{userProfile}

用户问题：推荐下一步该学什么？

请给出 3 条个性化的学习建议：`
  );

  const chain = prompt.pipe(llm).pipe(new StringOutputParser());
  const recommendation = await chain.invoke({
    userProfile: memoryStore.formatForPrompt(userId),
  });

  printStep("result", `个性化推荐:\n${recommendation}`);
}

// ============================================================
// 第三部分：记忆摘要压缩
// ============================================================

/**
 * 对话摘要压缩
 *
 * 当对话历史过长时（超过模型的上下文窗口），需要压缩：
 * - 将早期对话总结为一段摘要
 * - 保留最近几轮完整对话
 * - 摘要 + 最近对话 = 压缩后的上下文
 *
 * 这是生产环境中非常重要的技术：
 * - GPT-4o 的上下文窗口是 128K token，看起来很大
 * - 但长对话、多工具调用很容易超出限制
 * - 而且 token 越多，成本越高，延迟越大
 */
async function demoMemorySummarization() {
  printSection("记忆摘要: 对话压缩");

  const llm = createLLM();

  // 模拟一段很长的对话历史
  const longConversation = [
    { role: "user", content: "你好，我想了解 React 和 Vue 的区别" },
    { role: "assistant", content: "React 和 Vue 都是主流前端框架。React 使用 JSX 和虚拟 DOM，Vue 使用模板语法和响应式数据绑定..." },
    { role: "user", content: "那 React 的 Hooks 和 Vue 的 Composition API 有什么异同？" },
    { role: "assistant", content: "两者理念相似：都是为了解决代码复用和逻辑组织问题。React Hooks 使用 useState/useEffect，Vue 使用 ref/reactive/watch..." },
    { role: "user", content: "TypeScript 在两个框架中的支持如何？" },
    { role: "assistant", content: "Vue 3 原生 TypeScript 支持很好，模板中也有类型推导。React + TypeScript 生态更成熟..." },
    { role: "user", content: "哪个框架的性能更好？" },
    { role: "assistant", content: "性能取决于具体场景。Vue 的响应式系统在细粒度更新上有优势，React 的并发模式（Concurrent Mode）在大型应用中表现更好..." },
    { role: "user", content: "那状态管理方面呢？Redux vs Pinia？" },
    { role: "assistant", content: "Redux 功能强大但模板代码多，Redux Toolkit 改善了很多。Pinia 是 Vue 官方推荐的状态管理，API 简洁..." },
  ];

  printStep("observe", `原始对话: ${longConversation.length} 条消息`);

  // 用 LLM 压缩对话历史为摘要
  const conversationText = longConversation
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const summaryPrompt = ChatPromptTemplate.fromTemplate(
    `请将以下对话历史压缩为一段简洁的摘要（不超过 100 字）。
保留关键信息点和用户的关注点。

对话历史：
{conversation}

摘要：`
  );

  const chain = summaryPrompt.pipe(llm).pipe(new StringOutputParser());
  const summary = await chain.invoke({ conversation: conversationText });

  printStep("result", `压缩摘要: ${summary}`);

  // 使用摘要 + 最新问题继续对话
  const followUpPrompt = ChatPromptTemplate.fromTemplate(
    `之前的对话摘要：{summary}

用户的新问题：根据我们之前的讨论，你觉得 2025 年新项目应该选 React 还是 Vue？

请结合之前的讨论给出建议：`
  );

  const followUpChain = followUpPrompt.pipe(llm).pipe(new StringOutputParser());
  const answer = await followUpChain.invoke({ summary });

  printStep("result", `基于摘要的回答:\n${answer}`);
}

// ============================================================
// 主函数
// ============================================================

async function main() {
  console.log("🧠 Agent 实战 Part 4: 记忆系统\n");
  console.log("记忆让 Agent 从「失忆的工具」变为「有记忆的助手」\n");

  await demoShortTermMemory();
  await demoLongTermMemory();
  await demoMemorySummarization();
}

main().catch((error) => {
  console.error("❌ 执行出错:", error.message || error);
  process.exit(1);
});
