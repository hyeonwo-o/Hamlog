import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { createHttpsRedirectMiddleware } from '../middleware/httpsRedirect.js';

const createRedirectTestApp = () => {
  const app = express();
  app.use(createHttpsRedirectMiddleware({
    enabled: true,
    resolveCanonicalBaseUrl: async () => 'https://tech.hamwoo.co.kr'
  }));
  app.all('*', (_req, res) => res.status(200).send('ok'));
  return app;
};

test('public-host proxy HTTP requests redirect to the configured HTTPS origin', async () => {
  const response = await request(createRedirectTestApp())
    .get('/posts/seo-check?from=http')
    .set('Host', 'tech.hamwoo.co.kr')
    .set('X-Forwarded-Proto', 'http');

  assert.equal(response.status, 308);
  assert.equal(
    response.headers.location,
    'https://tech.hamwoo.co.kr/posts/seo-check?from=http'
  );
});

test('HTTPS redirect ignores secure, health, localhost, Tailscale, and forged-host requests', async () => {
  const app = createRedirectTestApp();
  const cases = [
    request(app)
      .get('/')
      .set('Host', 'tech.hamwoo.co.kr')
      .set('X-Forwarded-Proto', 'https'),
    request(app)
      .get('/api/health')
      .set('Host', 'tech.hamwoo.co.kr')
      .set('X-Forwarded-Proto', 'http'),
    request(app)
      .get('/')
      .set('Host', 'localhost:4000')
      .set('X-Forwarded-Proto', 'http'),
    request(app)
      .get('/')
      .set('Host', '100.64.0.10:4000')
      .set('X-Forwarded-Proto', 'http'),
    request(app)
      .get('/')
      .set('Host', 'attacker.example')
      .set('X-Forwarded-Proto', 'http')
  ];

  const responses = await Promise.all(cases);
  responses.forEach(response => assert.equal(response.status, 200));
});
