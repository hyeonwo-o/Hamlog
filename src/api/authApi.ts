import { requestJson, requestVoid } from './client';

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

export const logout = async (): Promise<void> => {
    return requestVoid('/auth/logout', {
        method: 'POST',
    });
};

export const getMe = async (): Promise<{ user: User }> => {
    return requestJson<{ user: User }>('/auth/me');
};
