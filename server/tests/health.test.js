import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../app.js';

test('GET /api/health should return ok', async () => {
    const response = await request(app).get('/api/health');

    assert.equal(response.status, 200);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.deepEqual(response.body, { status: 'ok' });
});

test('GET /api/health exposes the deployed application version when configured', async () => {
    const previousVersion = process.env.APP_VERSION;
    process.env.APP_VERSION = 'abc1234';

    try {
        const response = await request(app).get('/api/health');

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, { status: 'ok', version: 'abc1234' });
    } finally {
        if (previousVersion === undefined) {
            delete process.env.APP_VERSION;
        } else {
            process.env.APP_VERSION = previousVersion;
        }
    }
});

test('unknown API routes should return a JSON 404 instead of the SPA shell', async () => {
    const response = await request(app).get('/api/does-not-exist');

    assert.equal(response.status, 404);
    assert.match(response.headers['content-type'], /application\/json/);
    assert.equal(response.body.message, 'API 경로를 찾을 수 없습니다.');
});
