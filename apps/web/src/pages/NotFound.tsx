import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="page not-found-page">
      <div className="not-found-content">
        <h1 className="not-found-code">404</h1>
        <p className="not-found-message">页面未找到</p>
        <p className="not-found-desc">
          你访问的页面不存在，请检查 URL 是否正确。
        </p>
        <Link to="/" className="btn btn-primary">
          返回首页
        </Link>
      </div>
    </div>
  );
}
