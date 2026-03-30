export function AboutPage() {
  return (
    <div className="page about-page">
      <h1>关于项目</h1>
      <div className="about-content">
        <section className="about-section">
          <h2>🏗️ 技术栈</h2>
          <ul className="tech-list">
            <li>
              <strong>Vite</strong> — 下一代前端构建工具
            </li>
            <li>
              <strong>React 19</strong> — 用于构建用户界面的 JavaScript 库
            </li>
            <li>
              <strong>TypeScript</strong> — 带类型的 JavaScript 超集
            </li>
            <li>
              <strong>React Router</strong> — React 声明式路由
            </li>
            <li>
              <strong>pnpm</strong> — 快速、节省磁盘空间的包管理器
            </li>
            <li>
              <strong>Turborepo</strong> — 高性能 Monorepo 构建系统
            </li>
          </ul>
        </section>

        <section className="about-section">
          <h2>📁 项目结构</h2>
          <pre className="code-block">
{`agent-mono/
├── apps/
│   ├── web/              ← 当前应用
│   └── web-summarizer/   ← 网页总结官
├── packages/
│   ├── shared/           ← 共享工具库
│   └── ui/               ← UI 组件库
└── tooling/
    ├── eslint-config/    ← ESLint 配置
    └── typescript-config/ ← TypeScript 配置`}
          </pre>
        </section>

        <section className="about-section">
          <h2>🚀 快速开始</h2>
          <pre className="code-block">
{`# 安装依赖
pnpm install

# 启动开发服务器
pnpm --filter @agent-mono/web dev

# 构建生产版本
pnpm --filter @agent-mono/web build`}
          </pre>
        </section>
      </div>
    </div>
  );
}
