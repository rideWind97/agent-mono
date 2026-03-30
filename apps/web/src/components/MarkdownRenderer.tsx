import {
  memo,
  useState,
  useCallback,
  isValidElement,
  Children,
  type ReactNode,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import type { Components } from "react-markdown";

interface MarkdownRendererProps {
  content: string;
}

/**
 * 递归提取 ReactNode 树中的纯文本（用于复制代码）
 */
function extractText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (isValidElement(node)) {
    const props = node.props as { children?: ReactNode };
    return extractText(props.children);
  }
  return "";
}

/**
 * 从 className 中提取编程语言名称
 * 例如 "language-typescript hljs" → "typescript"
 */
function extractLanguage(className?: string): string {
  if (!className) return "";
  const match = className.match(/language-(\S+)/);
  if (!match?.[1]) return "";
  // 过滤掉 hljs 本身
  return match[1] === "hljs" ? "" : match[1];
}

/**
 * 代码块组件 — 支持语言标签 + 一键复制
 */
function CodeBlock({
  language,
  children,
}: {
  language: string;
  children: ReactNode;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    const text = extractText(children).replace(/\n$/, "");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [children]);

  return (
    <div className="md-code-block">
      <div className="md-code-header">
        <span className="md-code-lang">{language || "code"}</span>
        <button className="md-code-copy" onClick={handleCopy}>
          {copied ? "✅ 已复制" : "📋 复制"}
        </button>
      </div>
      <pre>
        <code>{children}</code>
      </pre>
    </div>
  );
}

/**
 * 自定义 react-markdown 组件映射
 */
const components: Components = {
  /**
   * pre — 代码块容器
   * react-markdown 将 ``` 代码块渲染为 <pre><code>...</code></pre>
   * 我们在 pre 层拦截，提取 code 子元素的信息，包装为 CodeBlock
   */
  pre({ children }) {
    // 找到 <code> 子元素
    const codeChild = Children.toArray(children).find(
      (child) => isValidElement(child) && child.type === "code"
    );

    if (codeChild && isValidElement(codeChild)) {
      const codeProps = codeChild.props as {
        className?: string;
        children?: ReactNode;
      };
      const language = extractLanguage(codeProps.className);
      return <CodeBlock language={language}>{codeProps.children}</CodeBlock>;
    }

    // 兜底：直接渲染 children（可能是自定义 code 组件的输出）
    return <>{children}</>;
  },

  /**
   * code — 行内代码 & 代码块内的 code
   * 在 react-markdown v10 中，代码块的 code 已经被 pre 组件拦截处理，
   * 这里只处理行内代码 `code`
   */
  code({ className, children, ...props }) {
    // 如果有 language- 或 hljs class，说明是代码块内的 code
    // 正常情况下不会走到这里（已被 pre 拦截），但作为兜底
    if (className?.includes("language-") || className?.includes("hljs")) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }

    // 行内代码
    return (
      <code className="md-inline-code" {...props}>
        {children}
      </code>
    );
  },

  // 链接 — 新窗口打开
  a({ href, children, ...props }) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    );
  },

  // 表格 — 可横向滚动
  table({ children, ...props }) {
    return (
      <div className="md-table-wrapper">
        <table {...props}>{children}</table>
      </div>
    );
  },
};

/**
 * Markdown 渲染器 — 用于渲染 AI 返回的 Markdown 内容
 *
 * 支持的 Markdown 语法：
 * - 标题 (h1-h6)
 * - 粗体、斜体、删除线
 * - 有序/无序列表（含嵌套）
 * - 任务列表 (GFM)
 * - 代码块（语法高亮 + 一键复制）
 * - 行内代码
 * - 引用块
 * - 表格
 * - 链接（新窗口打开）
 * - 图片
 * - 分割线
 */
export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
}: MarkdownRendererProps) {
  return (
    <div className="md-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
