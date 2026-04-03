const HIGH_RISK_PATTERNS = [/删除/i, /drop\s+table/i, /转账/i, /production/i];

export function guardInput(task: string): { blocked: boolean; reason?: string } {
  if (task.length > 500) {
    return { blocked: true, reason: "输入过长，已阻断。" };
  }
  if (HIGH_RISK_PATTERNS.some((r) => r.test(task))) {
    return { blocked: true, reason: "检测到高风险操作，需人工审批（HITL）。" };
  }
  return { blocked: false };
}

export function humanApproval(task: string): { approved: boolean; message: string } {
  // 教学模拟：高风险默认拒绝，可改成真实审批流程。
  if (/删除|drop\s+table|转账|production/i.test(task)) {
    return { approved: false, message: `人工审批未通过：${task}` };
  }
  return { approved: true, message: "人工审批通过" };
}
