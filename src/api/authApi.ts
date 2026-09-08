import { configureAuthMode, requestJson, type AuthMode } from './client';

export interface User {
    role: string;
}

export interface AuthResponse {
    message: string;
    user: User;
}

export const login = async (password: string): Promise<AuthResponse> => {
    return requestJson<AuthResponse>('/auth/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
    });
};

export const logout = async (): Promise<{ message: string; redirectTo?: string }> => {
    return requestJson('/auth/logout', {
        method: 'POST',
    }, true);
};

export const getAuthConfig = async (): Promise<{ mode: AuthMode }> => {
    const config = await requestJson<{ mode: AuthMode }>('/auth/config', { cache: 'no-store' }, true);
    if (!['password', 'cloudflare-access'].includes(config.mode)) {
        throw new Error('지원하지 않는 관리자 인증 설정입니다.');
    }
    configureAuthMode(config.mode);
    return config;
};

export const getMe = async (): Promise<{ user: User }> => {
    return requestJson<{ user: User }>('/auth/me');
};
