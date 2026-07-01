import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../app.js';

const adminPassword = process.env.ADMIN_PASSWORD ?? 'test-password';
const TRUSTED_ORIGIN = 'https://tech.hamwoo.co.kr';

const loginAsAdmin = async () => {
    const response = await request(app)
        .post('/api/auth/login')
        .send({ password: adminPassword });

    assert.equal(response.status, 200);
    assert.ok(Array.isArray(response.headers['set-cookie']));

    return response.headers['set-cookie'];
};

const withTrustedOrigin = (requestBuilder, origin = TRUSTED_ORIGIN) => {
    const parsed = new URL(origin);
    return requestBuilder
        .set('Origin', origin)
        .set('X-Forwarded-Host', parsed.host)
        .set('X-Forwarded-Proto', parsed.protocol.replace(':', ''));
};

test('GET /api/preview should require admin authentication', async () => {
    const response = await request(app).get('/api/preview');

    assert.equal(response.status, 401);
    assert.equal(response.body.message, '인증이 필요합니다.');
});

test('GET /api/preview should require trusted request origin', async () => {
    const cookies = await loginAsAdmin();

    const response = await request(app)
        .get('/api/preview?url=https%3A%2F%2Fexample.com')
        .set('Cookie', cookies);

    assert.equal(response.status, 403);
    assert.equal(response.body.message, '유효하지 않은 요청 출처입니다.');
});

test('GET /api/preview should require url query for trusted admin requests', async () => {
    const cookies = await loginAsAdmin();

    const response = await withTrustedOrigin(
        request(app)
            .get('/api/preview')
            .set('Cookie', cookies)
    );

    assert.equal(response.status, 400);
    assert.equal(response.body.error, 'URL is required');
});

test('GET /api/preview should accept trusted referer for same-origin editor fetches', async () => {
    const cookies = await loginAsAdmin();

    const response = await request(app)
        .get('/api/preview')
        .set('Cookie', cookies)
        .set('Referer', `${TRUSTED_ORIGIN}/admin?section=posts`)
        .set('X-Forwarded-Host', 'tech.hamwoo.co.kr')
        .set('X-Forwarded-Proto', 'https');

    assert.equal(response.status, 400);
    assert.equal(response.body.error, 'URL is required');
});

test('GET /api/preview should block private network destinations', async () => {
    const cookies = await loginAsAdmin();

    const response = await withTrustedOrigin(
        request(app)
            .get('/api/preview?url=http%3A%2F%2F127.0.0.1%2F')
            .set('Cookie', cookies)
    );

    assert.equal(response.status, 403);
    assert.equal(response.body.error, 'Blocked URL');
});
