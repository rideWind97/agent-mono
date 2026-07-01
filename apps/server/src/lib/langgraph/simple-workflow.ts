import type {
  LangGraphRouterResponse,
  LangGraphWorkflowResponse,
  WorkflowStep,
} from "@agent-mono/shared";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";

type Classification = "math" | "chat";

const arithmeticPattern = /^[\d\s()+\-*/.]+$/;

function isMathExpression(input: string) {
  return arithmeticPattern.test(input.trim());
}

function solveArithmeticExpression(input: string) {
  if (!isMathExpression(input)) {
    throw new Error("只支持数字、括号与 + - * / 的数学表达式");
  }

  // Demo only: regex 已限制输入字符，避免执行任意 JS 代码。
  const value = Function(`"use strict"; return (${input});`)() as unknown;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("表达式结果不是有效数字");
  }
  return value;
}

const WorkflowAnnotation = Annotation.Root({
  input: Annotation<string>(),
  classification: Annotation<Classification>(),
  plan: Annotation<string>(),
  result: Annotation<string>(),
  steps: Annotation<WorkflowStep[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
});

export async function runMathWorkflow(input: string): Promise<LangGraphWorkflowResponse> {
  const graph = new StateGraph(WorkflowAnnotation)
    .addNode("classify", async (state) => {
      const classification: Classification = isMathExpression(state.input) ? "math" : "chat";
      return {
        classification,
        steps: [
          {
            node: "classify",
            detail: classification === "math" ? "识别为数学表达式" : "识别为普通聊天",
          },
        ],
      };
    })
    .addNode("planStep", async (state) => {
      const plan =
        state.classification === "math"
          ? "先保留输入表达式，再调用 solveMath 节点计算，最后整理答案。"
          : "直接走普通回答分支。";

      return {
        plan,
        steps: [{ node: "plan", detail: plan }],
      };
    })
    .addNode("solveMath", async (state) => {
      const value = solveArithmeticExpression(state.input);
      return {
        result: `${state.input} = ${value}`,
        steps: [{ node: "solveMath", detail: `计算结果为 ${value}` }],
      };
    })
    .addNode("answerChat", async (state) => ({
      result: `这是普通消息：${state.input}`,
      steps: [{ node: "answerChat", detail: "非数学输入，生成普通回复" }],
    }))
    .addNode("finalize", async (state) => ({
      steps: [{ node: "finalize", detail: `最终输出：${state.result}` }],
    }))
    .addEdge(START, "classify")
    .addEdge("classify", "planStep")
    .addConditionalEdges("planStep", (state) =>
      state.classification === "math" ? "solveMath" : "answerChat",
    )
    .addEdge("solveMath", "finalize")
    .addEdge("answerChat", "finalize")
    .addEdge("finalize", END);

  const app = graph.compile();
  const result = await app.invoke({ input });

  return {
    input: result.input,
    classification: result.classification,
    plan: result.plan,
    result: result.result,
    steps: result.steps,
  };
}

const RouterAnnotation = Annotation.Root({
  input: Annotation<string>(),
  classification: Annotation<Classification>(),
  answer: Annotation<string>(),
  steps: Annotation<WorkflowStep[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
});

export async function runThreeNodeRouter(input: string): Promise<LangGraphRouterResponse> {
  const graph = new StateGraph(RouterAnnotation)
    .addNode("classify", async (state) => {
      const classification: Classification = isMathExpression(state.input) ? "math" : "chat";
      return {
        classification,
        steps: [{ node: "classify", detail: `分类结果：${classification}` }],
      };
    })
    .addNode("answerStep", async (state) => {
      const answer =
        state.classification === "math"
          ? `${state.input} = ${solveArithmeticExpression(state.input)}`
          : `收到：${state.input}`;

      return {
        answer,
        steps: [{ node: "answer", detail: `根据 ${state.classification} 分支生成回答` }],
      };
    })
    .addNode("finalize", async (state) => ({
      steps: [{ node: "finalize", detail: `返回答案：${state.answer}` }],
    }))
    .addEdge(START, "classify")
    .addEdge("classify", "answerStep")
    .addEdge("answerStep", "finalize")
    .addEdge("finalize", END);

  const app = graph.compile();
  const result = await app.invoke({ input });

  return {
    input: result.input,
    classification: result.classification,
    answer: result.answer,
    steps: result.steps,
  };
}
