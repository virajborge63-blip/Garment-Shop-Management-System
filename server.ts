import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { initDatabase } from './server/db.ts';
import authRoutes from './server/routes/authRoutes.ts';
import adminRoutes from './server/routes/adminRoutes.ts';
import superAdminRoutes from './server/routes/superAdminRoutes.ts';
import employeeRoutes from './server/routes/employeeRoutes.ts';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize SQLite schema and seed data
  initDatabase();

  app.use(express.json());

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/super-admin', superAdminRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/employee', employeeRoutes);

  // Vite middleware for development or static serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ERP HRMS Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
