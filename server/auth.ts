import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { db } from './db.ts';

export interface AuthenticatedUser {
  id: number;
  username: string;
  email: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'EMPLOYEE';
  employee_id: string | null;
  name?: string;
  department?: string;
  designation?: string;
  avatar_url?: string;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

// Generate secure random session token
export function createSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Create a new session in database
export function createSession(userId: number, role: string, employeeId: string | null): string {
  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const stmt = db.prepare(`
    INSERT INTO sessions (token, user_id, role, employee_id, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(token, userId, role, employeeId, expiresAt);
  return token;
}

// Middleware: Authenticate user from Bearer token
export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid authentication token.' });
  }

  const token = authHeader.split('Bearer ')[1].trim();
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Empty token provided.' });
  }

  try {
    const sessionStmt = db.prepare(`
      SELECT s.token, s.user_id, s.role, s.employee_id, s.expires_at,
             u.username, u.email, u.status as user_status,
             e.name, e.department, e.designation, e.avatar_url
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN employees e ON s.employee_id = e.employee_id
      WHERE s.token = ? AND datetime(s.expires_at) > datetime('now')
    `);

    const session = sessionStmt.get(token) as any;

    if (!session) {
      return res.status(401).json({ error: 'Unauthorized: Session expired or invalid.' });
    }

    if (session.user_status !== 'active') {
      return res.status(403).json({ error: 'Account has been deactivated.' });
    }

    let displayName = session.name;
    if (session.role === 'SUPER_ADMIN') {
      displayName = 'H.M. Rajpal (Owner)';
    } else if (session.role === 'ADMIN') {
      displayName = session.name || 'Store Operations Admin';
    }

    req.user = {
      id: session.user_id,
      username: session.username,
      email: session.email,
      role: session.role,
      employee_id: session.employee_id,
      name: displayName,
      department: session.role === 'SUPER_ADMIN' ? 'Executive Board / Ownership' : session.department,
      designation: session.role === 'SUPER_ADMIN' ? 'Store Owner & Super Admin' : session.designation,
      avatar_url: session.avatar_url || (session.role === 'SUPER_ADMIN' ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80' : undefined),
    };

    next();
  } catch (err: any) {
    console.error('Session verification error:', err);
    return res.status(500).json({ error: 'Internal error during authentication.' });
  }
}

// Strict Admin/SuperAdmin RBAC middleware
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
  }

  if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({
      error: 'Access Denied: Administrator or Super Admin permissions required.',
      code: 'RBAC_ADMIN_REQUIRED'
    });
  }

  next();
}

// Strict Super Admin only RBAC middleware (Store Owner)
export function requireSuperAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
  }

  if (req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({
      error: 'Access Denied: Owner / Super Admin permissions required.',
      code: 'RBAC_SUPER_ADMIN_REQUIRED'
    });
  }

  next();
}

// Strict Employee-only RBAC middleware
export function requireEmployee(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
  }

  if (!req.user.employee_id) {
    return res.status(403).json({
      error: 'Access Denied: No linked employee profile found for this account.',
      code: 'RBAC_EMPLOYEE_REQUIRED'
    });
  }

  next();
}
