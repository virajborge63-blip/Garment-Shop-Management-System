import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createHealthHandler } from '../server/routes/healthRoute.ts';

function createHealthApp(connected: boolean) {
  const app = express();
  app.get('/api/health', createHealthHandler(() => connected));
  return app;
}

describe('GET /api/health', () => {
  it('returns the exact connected payload without authentication', async () => {
    const response = await request(createHealthApp(true)).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', database: 'connected' });
  });

  it('returns the exact degraded payload when the database is disconnected', async () => {
    const response = await request(createHealthApp(false)).get('/api/health');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: 'degraded', database: 'disconnected' });
  });
});
