import { Link } from "react-router-dom";

export function HomePage() {
  return (
    <div className="page home-page">
      <section className="hero">
        <h1>
          欢迎来到 <span className="gradient-text">Agent Mono</span>
        </h1>
        <p className="subtitle">
          基于 pnpm + Turborepo 的现代化 Monorepo 工程模板
        </p>
        <div className="hero-actions">
          <Link to="/about" className="btn btn-primary">
            了解更多
          </Link>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline"
          >
            GitHub
          </a>
        </div>
      </section>

      <section className="features">
        <div className="feature-card">
          <div className="feature-icon">⚡</div>
          <h3>Vite 驱动</h3>
          <p>极速的 HMR 热更新，毫秒级启动开发服务器</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">⚛️</div>
          <h3>React 19</h3>
          <p>使用最新的 React 特性，搭配 TypeScript 类型安全</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">🛣️</div>
          <h3>React Router</h3>
          <p>声明式路由，支持嵌套布局和代码分割</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">📦</div>
          <h3>Monorepo</h3>
          <p>pnpm workspace + Turborepo 高效管理多包项目</p>
        </div>
      </section>
    </div>
  );
}
