import jwt from 'jsonwebtoken';
import { AUTH_MODE, JWT_SECRET } from '../config/auth.js';
import { verifyAccessToken } from '../services/accessAuth.js';

export async function authenticateToken(req, res, next) {
    res.set('Cache-Control', 'no-store');
    if (AUTH_MODE === 'cloudflare-access') {
        const token = req.get('Cf-Access-Jwt-Assertion');
        if (!token) return res.status(401).json({ message: 'Cloudflare Access 인증이 필요합니다.' });
        try {
            req.user = await verifyAccessToken(token);
            return next();
        } catch {
            return res.status(401).json({ message: 'Cloudflare Access 인증이 만료되었거나 유효하지 않습니다.' });
        }
    }
    const token = req.cookies?.token;

    if (!token) {
        return res.status(401).json({ message: '인증이 필요합니다.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: '토큰이 유효하지 않습니다.' });
        }
        req.user = user;
        next();
    });
}

export async function attachOptionalUser(req, res, next) {
    res.vary('Cookie');
    res.vary('Cf-Access-Jwt-Assertion');
    if (AUTH_MODE === 'cloudflare-access') {
        const token = req.get('Cf-Access-Jwt-Assertion');
        if (!token) return next();
        res.set('Cache-Control', 'no-store');
        try {
            req.user = await verifyAccessToken(token);
        } catch {
            // Invalid optional credentials never grant access to private posts.
        }
        return next();
    }
    const token = req.cookies?.token;

    if (!token) {
        return next();
    }

    res.set('Cache-Control', 'no-store');

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (!err) {
            req.user = user;
        }
        next();
    });
}
