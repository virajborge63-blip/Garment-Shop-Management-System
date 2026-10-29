import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import path from 'path';
import mongoose from 'mongoose';
import { createServer as createViteServer } from 'vite';
import { initDatabase } from './server/db.ts';
import { apiRateLimiter } from './server/middleware/rateLimiter.ts';
import authRoutes from './server/routes/authRoutes.ts';
import adminRoutes from './server/routes/adminRoutes.ts';
import superAdminRoutes from './server/routes/superAdminRoutes.ts';
import employeeRoutes from './server/routes/employeeRoutes.ts';
import shopRoutes from './server/routes/shopRoutes.ts';

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  const PORT = Number(process.env.PORT) || 3000;

  // Initialize MongoDB connection and safe idempotent database setup
  await initDatabase();

  // Basic security & parsing
  app.disable('x-powered-by');
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Strict CORS policy: Whitelist localhost, 127.0.0.1, and configured origins
  const configuredAllowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      let isAllowed = false;

      // Allow loopback/localhost origins on any port for local development and self-hosting
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        isAllowed = true;
      } else if (configuredAllowedOrigins.includes(origin)) {
        isAllowed = true;
      }

      if (isAllowed) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }
    }

    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  // Apply general API rate limiting to all /api routes
  app.use('/api', apiRateLimiter);

  // Health-check endpoint
  app.get('/api/health', (req, res) => {
    try {
      const isDbConnected = mongoose.connection.readyState === 1;
      return res.json({
        status: 'ok',
        uptime: Math.round(process.uptime()),
        database: isDbConnected ? 'connected' : 'connecting',
        engine: 'MongoDB',
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      return res.status(500).json({ status: 'error', message: 'Health check failed' });
    }
  });

  // Mount API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/super-admin', superAdminRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/employee', employeeRoutes);
  app.use('/api/shop', shopRoutes);

  // Production vs Development mode detection
  const isProduction =
    process.env.NODE_ENV === 'production' ||
    process.argv[1]?.endsWith('server.cjs') ||
    process.env.npm_lifecycle_event === 'start';

  if (!isProduction) {
    const isHmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');

    // Prevent direct access to server bundles and database files
    app.use((req, res, next) => {
      const reqPath = req.path.toLowerCase();
      if (reqPath.endsWith('.cjs') || reqPath.endsWith('.map') || reqPath.endsWith('.db') || reqPath.endsWith('.sqlite')) {
        return res.status(404).end();
      }
      next();
    });

    app.use(express.static(distPath));

    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Safe global error handler (prevents leaking internal details in logs or responses)
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled server error:', err?.message || 'Unknown error');
    if (res.headersSent) {
      return next(err);
    }
    res.status(500).json({
      error: 'An unexpected internal error occurred. Please try again later.'
    });
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Garment Shop Management System (MongoDB) listening at http://0.0.0.0:${PORT} (${isProduction ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err?.message || err);
  process.exit(1);
});
