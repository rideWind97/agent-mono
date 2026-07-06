import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { QaCase, SourceDocument } from "./types.js";

// 下面这两行是为了拿到当前包的根目录。
// import.meta.url 是当前文件路径，逐级向上 ../.. 就能回到 examples/rag-learning。
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(currentDir, "../..");

// 知识库目录：里面放 3-5 篇 Markdown 文档。
// RAG 的“私有知识”就来自这里。
export const knowledgeBaseDir = path.join(packageRoot, "knowledge-base");

// QA 测试集路径：eval.ts 会读取它来计算命中率。
export const qaSetPath = path.join(packageRoot, "qa/test-set.json");

function titleFromMarkdown(fileName: string, text: string) {
  // 优先读取 Markdown 一级标题作为文档标题。
  // 例如 "# RAG 概览" 会得到 "RAG 概览"。
  const heading = text.match(/^#\s+(.+)$/m)?.[1];

  // 如果没有一级标题，就退回用文件名当标题。
  return heading ?? fileName.replace(/\.md$/, "");
}

export async function loadMarkdownDocuments(): Promise<SourceDocument[]> {
  // 读取 knowledge-base 目录下所有 .md 文件。
  // sort() 是为了让每次运行顺序稳定，方便调试和对比结果。
  const fileNames = (await readdir(knowledgeBaseDir))
    .filter((fileName) => fileName.endsWith(".md"))
    .sort();

  return Promise.all(
    fileNames.map(async (fileName) => {
      const filePath = path.join(knowledgeBaseDir, fileName);

      // 这里真正把 Markdown 文件读成字符串。
      // 到这一步为止，还没有分块、没有 embedding，只是“加载原文”。
      const text = await readFile(filePath, "utf8");

      // Loader 的职责是把不同来源的资料统一成同一种 Document 结构。
      // 真实项目里这里可能会接 PDF loader、网页 loader、Notion loader 等。
      return {
        id: fileName,
        title: titleFromMarkdown(fileName, text),
        path: fileName,
        text,
      };
    }),
  );
}

export async function loadQaSet(): Promise<QaCase[]> {
  // 测试集是普通 JSON，所以直接 readFile + JSON.parse。
  // 真实项目里也可以把测试集放进数据库或表格。
  const text = await readFile(qaSetPath, "utf8");
  return JSON.parse(text) as QaCase[];
}
