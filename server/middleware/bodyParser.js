import express from 'express';

const createBodyParsers = (limit) => [
    express.json({ limit }),
    express.urlencoded({ limit, extended: true })
];

// Public event payloads contain only a few short strings. Keeping their parser
// limit small prevents unauthenticated clients from making the process allocate
// memory for editor-sized request bodies.
export const publicBodyParsers = createBodyParsers('32kb');

// Post documents can contain a sizeable editor JSON tree. This parser is only
// installed after authentication and origin checks on the relevant routes.
export const adminContentBodyParsers = createBodyParsers('10mb');

// Images are transported as base64 JSON and may expand beyond the 8 MiB decoded
// upload limit enforced by uploadService.
export const imageUploadBodyParsers = createBodyParsers('12mb');

const bodyParserClientErrorTypes = new Set([
    'charset.unsupported',
    'encoding.unsupported',
    'entity.parse.failed',
    'entity.verify.failed',
    'parameters.too.many',
    'request.aborted',
    'request.size.invalid'
]);

export function handleBodyParserError(error, _req, res, next) {
    if (error?.type === 'entity.too.large') {
        return res.status(413).json({ message: '요청 본문이 너무 큽니다.' });
    }

    if (bodyParserClientErrorTypes.has(error?.type)) {
        const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 500
            ? error.status
            : 400;
        const message = status === 413
            ? '요청 본문이 너무 큽니다.'
            : status === 415
                ? '지원하지 않는 요청 본문 형식입니다.'
                : '요청 본문을 해석할 수 없습니다.';

        return res.status(status).json({ message });
    }

    return next(error);
}
