import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { User, Employee, Session } from './db.ts';

export interface AuthenticatedUser {
  id: string | number;
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

// Create a new session in MongoDB
export async function createSession(userId: string | number, role: string, employeeId: string | null): Promise<string> {
  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await Session.create({
    token,
    user_id: String(userId),
    role,
    employee_id: employeeId || null,
    expires_at: expiresAt,
  });

  return token;
}

// Middleware: Authenticate user from Bearer token
export async function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid authentication token.' });
  }

  const token = authHeader.split('Bearer ')[1].trim();
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Empty token provided.' });
  }

  try {
    const session = await Session.findOne({
      token,
      expires_at: { $gt: new Date() },
    });

    if (!session) {
      return res.status(401).json({ error: 'Unauthorized: Session expired or invalid.' });
    }

    const user = await User.findById(session.user_id);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: User account not found.' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Account has been deactivated.' });
    }

    let employee = null;
    if (session.employee_id) {
      employee = await Employee.findOne({ employee_id: session.employee_id });
    }

    let displayName = employee?.name;
    if (user.role === 'SUPER_ADMIN') {
      displayName = 'H.M. Rajpal (Owner)';
    } else if (user.role === 'ADMIN') {
      displayName = employee?.name || user.username || 'Store Operations Admin';
    }

    req.user = {
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      role: user.role,
      employee_id: user.employee_id,
      name: displayName,
      department: user.role === 'SUPER_ADMIN' ? 'Executive Board / Ownership' : employee?.department,
      designation: user.role === 'SUPER_ADMIN' ? 'Store Owner & Super Admin' : employee?.designation,
      avatar_url: employee?.avatar_url,
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
