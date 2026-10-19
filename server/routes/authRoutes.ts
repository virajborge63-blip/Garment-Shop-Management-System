import { Router, Request, Response } from 'express';
import { db, hashPassword, logAudit } from '../db.ts';
import { createSession, authenticateToken, AuthRequest } from '../auth.ts';

const router = Router();

// Login
router.post('/login', (req: Request, res: Response) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Username/Email and password are required.' });
    }

    const trimmedId = String(identifier).trim();
    const cleanPass = String(password);

    // Look up user by username, email, or linked employee_id
    const userStmt = db.prepare(`
      SELECT u.id, u.username, u.email, u.password_hash, u.role, u.employee_id, u.status,
             e.name, e.department, e.designation, e.avatar_url
      FROM users u
      LEFT JOIN employees e ON u.employee_id = e.employee_id
      WHERE LOWER(u.username) = LOWER(?) OR LOWER(u.email) = LOWER(?) OR UPPER(u.employee_id) = UPPER(?)
    `);

    const user = userStmt.get(trimmedId, trimmedId, trimmedId) as any;

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials. User not found.' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Your account is deactivated. Contact HR/Administrator.' });
    }

    const hashedInput = hashPassword(cleanPass);
    if (user.password_hash !== hashedInput) {
      return res.status(401).json({ error: 'Invalid password. Please try again.' });
    }

    // Create session
    const token = createSession(user.id, user.role, user.employee_id);

    if (user.role === 'SUPER_ADMIN') {
      logAudit(user.username, 'H.M. Rajpal (Owner)', 'SUPER_ADMIN_LOGIN', 'Owner Console', '', 'Store Owner logged in successfully');
    } else if (user.role === 'ADMIN') {
      logAudit(user.username, user.name || 'Store Manager', 'ADMIN_LOGIN', 'Admin Portal', '', 'Logged in successfully');
    }

    let displayName = user.name;
    if (user.role === 'SUPER_ADMIN') {
      displayName = 'H.M. Rajpal (Owner)';
    } else if (user.role === 'ADMIN') {
      displayName = user.name || 'Store Manager';
    }

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        employee_id: user.employee_id,
        name: displayName,
        department: user.role === 'SUPER_ADMIN' ? 'Executive Board / Ownership' : user.department,
        designation: user.role === 'SUPER_ADMIN' ? 'Store Owner & Super Admin' : user.designation,
        avatar_url: user.avatar_url,
      }
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Authentication failed due to server error.' });
  }
});

// Verify current session
router.get('/me', authenticateToken, (req: AuthRequest, res: Response) => {
  return res.json({ user: req.user });
});

// Logout
router.post('/logout', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split('Bearer ')[1].trim();
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    }
    return res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    return res.status(500).json({ error: 'Logout failed.' });
  }
});

// Forgot Password
router.post('/forgot-password', (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email address is required.' });
  }

  // Password reset request
  const user = db.prepare('SELECT id, email, username, role FROM users WHERE LOWER(email) = LOWER(?)').get(email) as any;
  if (user) {
    return res.json({
      success: true,
      message: `Password reset request registered for ${email}. Please contact the Super Admin / Store Owner to reset your credentials.`
    });
  }

  return res.json({
    success: true,
    message: `If an account with that email exists, password reset request has been registered.`
  });
});

// Demo accounts endpoint (disabled - clean production state)
router.get('/demo-accounts', (req: Request, res: Response) => {
  return res.json({ accounts: [] });
});

export default router;
