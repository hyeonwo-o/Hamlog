export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

export type AuthMode = 'password' | 'cloudflare-access';
let authMode: AuthMode = 'password';

export const configureAuthMode = (mode: AuthMode) => {
  if (mode === 'cloudflare-access' && new URL(API_BASE_URL, window.location.origin).origin !== window.location.origin) {
    throw new Error('Cloudflare Access 모드에서는 관리자와 API를 같은 도메인에서 제공해야 합니다.');
  }
  authMode = mode;
};

const resolveRequest = (options?: RequestInit, publicEndpoint = false) => {
  const useAccess = !publicEndpoint && authMode === 'cloudflare-access'
    && /^\/admin(?:\/|$)/.test(window.location.pathname);
  const headers = new Headers(options?.headers);
  // Ask Access for a 401 on expired AJAX sessions instead of a cross-origin login redirect.
  if (useAccess) headers.set('X-Requested-With', 'XMLHttpRequest');
  return {
    base: useAccess ? '/admin/api' : API_BASE_URL,
    options: { ...options, headers, credentials: 'include' as const }
  };
};

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const readErrorMessage = async (response: Response) => {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const payload = (await response.json()) as { message?: string };
    return payload.message;
  }
  return response.text();
};

const handleError = async (response: Response) => {
  const message = await readErrorMessage(response);
  throw new ApiError(response.status, message || `Request failed with status ${response.status}`);
};

export const isAuthenticationError = (error: unknown) => (
  error instanceof ApiError && (error.status === 401 || error.status === 403)
);

export const requestJson = async <T>(
  path: string,
  options?: RequestInit,
  publicEndpoint = false
): Promise<T> => {
  const request = resolveRequest(options, publicEndpoint);
  const response = await fetch(`${request.base}${path}`, request.options);
  if (!response.ok) {
    await handleError(response);
  }
  return response.json() as Promise<T>;
};

export const requestVoid = async (path: string, options?: RequestInit): Promise<void> => {
  const request = resolveRequest(options);
  const response = await fetch(`${request.base}${path}`, request.options);
  if (response.status === 204) return;
  if (!response.ok) {
    await handleError(response);
    return;
  }
};
