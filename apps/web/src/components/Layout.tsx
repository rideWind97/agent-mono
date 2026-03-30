import { NavLink, Outlet } from "react-router-dom";

export function Layout() {
  return (
    <div className="app-layout">
      <header className="header">
        <div className="header-inner">
          <NavLink to="/" className="logo">
            🚀 Agent Mono
          </NavLink>
          <nav className="nav">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `nav-link ${isActive ? "active" : ""}`
              }
            >
              首页
            </NavLink>
            <NavLink
              to="/chat"
              className={({ isActive }) =>
                `nav-link ${isActive ? "active" : ""}`
              }
            >
              AI 对话
            </NavLink>
            <NavLink
              to="/about"
              className={({ isActive }) =>
                `nav-link ${isActive ? "active" : ""}`
              }
            >
              关于
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="main">
        <Outlet />
      </main>

      <footer className="footer">
        <p>
          © {new Date().getFullYear()} Agent Mono · Built with Vite + React +
          TypeScript
        </p>
      </footer>
    </div>
  );
}
