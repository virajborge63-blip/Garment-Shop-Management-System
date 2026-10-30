import type { RequestHandler } from 'express';

export function createHealthHandler(isDatabaseAvailable: () => boolean): RequestHandler {
  return (_req, res) => {
    const connected = isDatabaseAvailable();
    return res.status(connected ? 200 : 503).json({
      status: connected ? 'ok' : 'degraded',
      database: connected ? 'connected' : 'disconnected',
    });
  };
}
