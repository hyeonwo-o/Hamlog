import rateLimit from 'express-rate-limit';

const parsePositiveInt = (value, fallback) => {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const commonOptions = {
    standardHeaders: true,
    legacyHeaders: false
};

export const loginRateLimiter = rateLimit({
    ...commonOptions,
    windowMs: 15 * 60 * 1000,
    max: parsePositiveInt(process.env.RATE_LIMIT_LOGIN_MAX, 10),
    skipSuccessfulRequests: true,
    message: { message: '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.' }
});

export const uploadRateLimiter = rateLimit({
    ...commonOptions,
    windowMs: 10 * 60 * 1000,
    max: parsePositiveInt(process.env.RATE_LIMIT_UPLOAD_MAX, 30),
    message: { message: '업로드 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' }
});

export const previewRateLimiter = rateLimit({
    ...commonOptions,
    windowMs: 10 * 60 * 1000,
    max: parsePositiveInt(process.env.RATE_LIMIT_PREVIEW_MAX, 120),
    message: { message: '미리보기 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' }
});

export const commentRateLimiter = rateLimit({
    ...commonOptions,
    windowMs: 10 * 60 * 1000,
    max: parsePositiveInt(process.env.RATE_LIMIT_COMMENT_MAX, 20),
    message: { message: '댓글 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' }
});
