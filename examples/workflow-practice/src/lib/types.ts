// Workflow 的重点是“状态在固定节点之间流动”。
// 这个文件定义内容创作工作流里的状态、节点和执行结果。

export type WorkflowNode =
  | "brief"
  | "research"
  | "draft"
  | "qualityReview"
  | "revise"
  | "humanApproval"
  | "publish"
  | "end";

export type WorkflowStatus = "running" | "interrupted" | "completed";

export interface WorkflowStep {
  node: WorkflowNode;
  detail: string;
}

export interface HumanReview {
  approved: boolean;
  feedback: string;
}

export interface ContentWorkflowState {
  threadId: string;
  topic: string;
  audience: string;
  brief?: string;
  researchNotes?: string[];
  draft?: string;
  qualityScore?: number;
  revisionCount: number;
  humanReview?: HumanReview;
  publishedUrl?: string;
  nextNode: WorkflowNode;
  status: WorkflowStatus;
  steps: WorkflowStep[];
}

export interface WorkflowRunResult {
  state: ContentWorkflowState;
  interrupted: boolean;
  message: string;
}

export interface ResumeInput {
  approved: boolean;
  feedback: string;
}
