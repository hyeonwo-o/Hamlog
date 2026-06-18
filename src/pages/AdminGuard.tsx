import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as authApi from '../api/authApi';
import LoadingSpinner from '../components/LoadingSpinner';
import { ApiError } from '../api/client';

interface AdminGuardProps {
  children: React.ReactNode;
}

const wait = (ms: number) => new Promise<void>((resolve) => {
  window.setTimeout(resolve, ms);
});

const AdminGuard: React.FC<AdminGuardProps> = ({ children }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isAuthed, setIsAuthed] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string>('');

  const authReason = searchParams.get('auth');

  const confirmSession = useCallback(async (retryDelays: number[] = [0]) => {
    for (const delay of retryDelays) {
      if (delay > 0) {
        await wait(delay);
      }

      try {
        await authApi.getMe();
        setIsAuthed(true);
        return true;
      } catch {
        // Retry a few times because some browsers apply Set-Cookie asynchronously.
      }
    }

    setIsAuthed(false);
    return false;
  }, []);

  const checkAuth = useCallback(async () => {
    try {
      await confirmSession();
    } finally {
      setIsLoading(false);
    }
  }, [confirmSession]);

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isAuthed || authReason !== 'required') return;
    setError('세션이 만료되었거나 인증 쿠키가 저장되지 않았습니다. 다시 로그인해주세요.');
  }, [authReason, isAuthed]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      await authApi.login(password);
    } catch (loginError) {
      if (loginError instanceof ApiError && loginError.status === 401) {
        setError('비밀번호가 올바르지 않습니다.');
      } else {
        setError('로그인 요청을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.');
      }
      setIsSubmitting(false);
      return;
    }

    try {
      const isSessionConfirmed = await confirmSession([0, 150, 400, 900]);
      if (!isSessionConfirmed) {
        setError('로그인은 성공했지만 세션을 확인하지 못했습니다. 브라우저 쿠키 또는 서버 HTTPS 설정을 확인해주세요.');
        return;
      }

      setPassword('');
      if (searchParams.has('auth')) {
        const next = new URLSearchParams(searchParams);
        next.delete('auth');
        setSearchParams(next, { replace: true });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4 text-[var(--text)]">
        <div className="w-full max-w-sm rounded-xl border border-[color:var(--border)] bg-[var(--surface)] p-6">
          <LoadingSpinner message="관리자 인증 확인 중..." />
        </div>
      </div>
    );
  }

  if (isAuthed) return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center px-4 text-[var(--text)]">
      <div className="w-full max-w-sm rounded-xl border border-[color:var(--border)] bg-[var(--surface)] p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">
          관리자 접근
        </p>
        <h1 className="mt-2 font-display text-xl font-semibold">비밀번호 입력</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          서버에 설정된 관리자 비밀번호를 입력해주세요.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
            비밀번호
            <input
              type="password"
              autoFocus
              value={password}
              disabled={isSubmitting}
              onChange={(event) => {
                setPassword(event.target.value);
                if (error) {
                  setError('');
                }
              }}
              className="mt-2 w-full rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-soft)]"
              placeholder="••••••••"
              aria-label="관리자 비밀번호"
            />
          </label>
          {error && <p className="text-sm text-[var(--accent-strong)]">{error}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-[var(--accent)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white"
          >
            {isSubmitting ? '로그인 중...' : '로그인'}
          </button>
        </form>
        <div className="mt-4 text-center">
          <a
            href="/"
            className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] hover:text-[var(--accent-strong)]"
          >
            홈으로 돌아가기
          </a>
        </div>
      </div>
    </div>
  );
};

export default AdminGuard;
