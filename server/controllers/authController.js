import jwt from 'jsonwebtoken';
import { ADMIN_PASSWORD, JWT_SECRET } from '../config/auth.js';
import { buildClearCookieOptions, buildCookieOptions } from '../config/cookies.js';

const AUTH_COOKIE_MAX_AGE = 24 * 60 * 60 * 1000;

export const login = (req, res) => {
    const { password } = req.body;

    if (password !== ADMIN_PASSWORD) {
        return res.status(401).json({ message: '비밀번호가 올바르지 않습니다.' });
    }

    // Role is simple: 'admin'
    const user = { role: 'admin' };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '24h' });
    const cookieOptions = buildCookieOptions(req, AUTH_COOKIE_MAX_AGE);

    res.cookie('token', token, cookieOptions);

    res.json({ message: '로그인 성공', user });
};

export const logout = (req, res) => {
    res.clearCookie('token', buildClearCookieOptions(req));
    res.json({ message: '로그아웃 성공' });
};

export const me = (req, res) => {
    // If request reached here, middleware passed, so user is authenticated
    res.json({ user: req.user });
};
