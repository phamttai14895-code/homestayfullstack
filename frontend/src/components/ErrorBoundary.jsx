import React from "react";
import { Link } from "react-router-dom";

/** Fallback UI khi ErrorBoundary bắt lỗi (dùng i18n qua prop t). */
export function ErrorFallback({ t, retry }) {
  const msg = t?.("common.error_boundary_msg") ?? "Trang tạm thời không tải được. Bạn có thể thử lại hoặc quay về trang chủ.";
  const tryAgain = t?.("common.try_again") ?? "Thử lại";
  const backHome = t?.("common.back_home") ?? "Về trang chủ";
  const title = t?.("common.error_boundary_title") ?? "Đã xảy ra lỗi";
  return (
    <div className="container" style={{ padding: "2rem 0" }}>
      <div className="card2">
        <h2 style={{ marginTop: 0 }}>{title}</h2>
        <p className="muted">{msg}</p>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button type="button" className="btn btn-primary" onClick={retry}>{tryAgain}</button>
          <Link to="/" className="btn btn-secondary">{backHome}</Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Error Boundary bọc route/lazy component để tránh crash trắng trang.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const fallback = this.props.fallback;
      if (typeof fallback === "function") return fallback({ retry: this.handleRetry });
      if (fallback) return fallback;
      return <ErrorFallback retry={this.handleRetry} />;
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
