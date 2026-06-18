import React, { Component } from 'react';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error Boundary caught an error:', error, errorInfo);

    if (import.meta.env.PROD) {
      // Send to an error tracking service in production.
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-screen items-center justify-center px-4 text-[var(--text)]">
          <div className="w-full max-w-md rounded-3xl border border-[color:var(--border)] bg-[var(--surface)] p-8 text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--surface-muted)] text-[var(--accent-strong)]">
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.664-.833-2.464 0L4.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>

            <h2 className="font-display text-2xl font-semibold">
              문제가 발생했습니다
            </h2>

            <p className="mt-3 text-sm text-[var(--text-muted)]">
              예상치 못한 오류가 발생했습니다. 잠시 후 다시 시도하거나 페이지를 새로고침해 주세요.
            </p>

            {import.meta.env.DEV && this.state.error && (
              <details className="mt-6 text-left">
                <summary className="cursor-pointer text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  개발자 정보
                </summary>
                <pre className="mt-3 max-h-40 overflow-auto rounded-2xl bg-[var(--surface-muted)] p-3 text-xs text-[var(--text)]">
                  {this.state.error.stack}
                </pre>
              </details>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white"
              >
                페이지 새로고침
              </button>
              <button
                onClick={() => window.history.back()}
                className="flex-1 rounded-full border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text)]"
              >
                이전 페이지
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
