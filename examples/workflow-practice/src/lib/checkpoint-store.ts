import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { ContentWorkflowState } from "./types.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(currentDir, "../..");
const checkpointDir = path.join(packageRoot, ".checkpoints");

function checkpointPath(threadId: string) {
  return path.join(checkpointDir, `${threadId}.json`);
}

export async function saveCheckpoint(state: ContentWorkflowState) {
  // 持久化的核心：每次关键节点执行后，把完整 state 写入磁盘。
  // 这样即使进程退出，resume 也可以从 threadId 找回之前的状态。
  await mkdir(checkpointDir, { recursive: true });
  await writeFile(checkpointPath(state.threadId), JSON.stringify(state, null, 2), "utf8");
}

export async function loadCheckpoint(threadId: string) {
  const text = await readFile(checkpointPath(threadId), "utf8");
  return JSON.parse(text) as ContentWorkflowState;
}

export async function deleteCheckpoint(threadId: string) {
  await rm(checkpointPath(threadId), { force: true });
}

export async function findLatestCheckpoint() {
  await mkdir(checkpointDir, { recursive: true });
  const files = (await readdir(checkpointDir))
    .filter((file) => file.endsWith(".json"))
    .sort()
    .reverse();

  return files[0]?.replace(/\.json$/, "") ?? null;
}
