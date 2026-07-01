import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";

import { createChatModel } from "../llm.js";

const sessions = new Map<string, InMemoryChatMessageHistory>();

function getHistory(sessionId: string) {
  let history = sessions.get(sessionId);
  if (!history) {
    history = new InMemoryChatMessageHistory();
    sessions.set(sessionId, history);
  }
  return history;
}

const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    "你是学习助手。记住用户在对话中提到的名字、偏好和事实，并在后续回答中自然引用。回答简洁。",
  ],
  new MessagesPlaceholder("history"),
  ["human", "{input}"],
]);

const model = createChatModel({ temperature: 0.5 });
const chain = prompt.pipe(model);

const chainWithHistory = new RunnableWithMessageHistory({
  runnable: chain,
  getMessageHistory: async (sessionId) => getHistory(sessionId),
  inputMessagesKey: "input",
  historyMessagesKey: "history",
});

export async function runMemoryChat(sessionId: string, input: string) {
  const response = await chainWithHistory.invoke(
    { input },
    { configurable: { sessionId } },
  );

  const reply =
    typeof response.content === "string"
      ? response.content
      : JSON.stringify(response.content);

  const history = getHistory(sessionId);
  const count = (await history.getMessages()).length;

  return { reply, messageCount: count };
}

export function resetMemorySession(sessionId: string) {
  sessions.delete(sessionId);
}
