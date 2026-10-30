import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { getTrustProxyHops } from '../server/environment.ts';
import { createRateLimiter } from '../server/middleware/rateLimiter.ts';

describe('rate limiter client identity', () => {
  it('defaults to trusting no proxy hops and validates configured hop counts', () => {
    const previousHops = process.env.TRUST_PROXY;
    try {
      delete process.env.TRUST_PROXY;
      expect(getTrustProxyHops()).toBe(0);

      process.env.TRUST_PROXY = '2';
      expect(getTrustProxyHops()).toBe(2);

      process.env.TRUST_PROXY = 'all';
      expect(() => getTrustProxyHops()).toThrow('TRUST_PROXY must be a non-negative integer.');
    } finally {
      if (previousHops === undefined) delete process.env.TRUST_PROXY;
      else process.env.TRUST_PROXY = previousHops;
    }
  });

  it('does not let clients choose their own identity through X-Forwarded-For', async () => {
    const app = express();
    app.use(createRateLimiter({ windowMs: 60_000, max: 1 }));
    app.get('/', (_req, res) => res.sendStatus(200));

    const first = await request(app)
      .get('/')
      .set('X-Forwarded-For', '198.51.100.10');
    const second = await request(app)
      .get('/')
      .set('X-Forwarded-For', '198.51.100.11');

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
  });

  it('uses the configured single proxy hop to resolve the client IP', async () => {
    const previousHops = process.env.TRUST_PROXY;
    process.env.TRUST_PROXY = '1';
    try {
      const app = express();
      app.set('trust proxy', getTrustProxyHops());
      app.use(createRateLimiter({ windowMs: 60_000, max: 1 }));
      app.get('/', (req, res) => res.json({ ip: req.ip }));

      const first = await request(app)
        .get('/')
        .set('X-Forwarded-For', '192.0.2.10, 198.51.100.20');
      const second = await request(app)
        .get('/')
        .set('X-Forwarded-For', '203.0.113.10, 198.51.100.20');

      expect(first.status).toBe(200);
      expect(first.body.ip).toBe('198.51.100.20');
      expect(second.status).toBe(429);
    } finally {
      if (previousHops === undefined) delete process.env.TRUST_PROXY;
      else process.env.TRUST_PROXY = previousHops;
    }
  });
});
