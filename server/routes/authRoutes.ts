import { Router, Request, Response } from 'express';
import { db, hashPassword, verifyPassword, logAudit } from '../db.ts';
import { createSession, authenticateToken, AuthRequest } from '../auth.ts';

const router = Router();

// 1. User Login
router.post('/login', (req: Request, res: Response) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Username/Email and password are required.' });
    }

    if (typeof identifier !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Invalid input format.' });
    }

    const trimmedId = identifier.trim();
    const cleanPass = password;

    if (trimmedId.length === 0 || cleanPass.length === 0 || trimmedId.length > 255 || cleanPass.length > 255) {
      return res.status(400).json({ error: 'Credentials must be within valid length limits.' });
    }

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

    const isValidPassword = verifyPassword(cleanPass, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid password. Please try again.' });
    }

    // If password was verified using legacy hash (SHA-256), seamlessly upgrade to modern scrypt hash
    if (!user.password_hash.startsWith('scrypt$')) {
      try {
        const upgradedHash = hashPassword(cleanPass);
        db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(upgradedHash, user.id);
        console.log(`[Security] Upgraded legacy password hash to scrypt for user: ${user.username}`);
      } catch (upgradeErr) {
        console.warn('[Security Notice] Could not upgrade legacy password hash:', upgradeErr);
      }
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
    console.error('Login error:', err?.message || 'Authentication error');
    return res.status(500).json({ error: 'Authentication failed due to server error.' });
  }
});

// 2. Protected Administrator Provisioning Endpoint
router.post('/setup-admin', (req: Request, res: Response) => {
  try {
    const { email, password, username, setupToken } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required for administrator setup.' });
    }

    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Invalid input format.' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();
    const adminUsername = (typeof username === 'string' && username.trim()) ? username.trim() : 'owner_admin';

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({ error: 'Invalid email address provided.' });
    }

    // Password strength check
    if (cleanPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }

    // Check existing Super Admin status
    const adminCountRow = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'SUPER_ADMIN'").get() as { count: number };
    const hasExistingSuperAdmin = adminCountRow && adminCountRow.count > 0;

    const configuredSetupToken = process.env.SETUP_TOKEN;

    if (hasExistingSuperAdmin) {
      // If a Super Admin already exists, setupToken is strictly required to prevent unauthorized takeover
      if (!configuredSetupToken || setupToken !== configuredSetupToken) {
        return res.status(403).json({
          error: 'Administrator already configured. A valid SETUP_TOKEN is required in the request body to reset administrator credentials, or use CLI: npm run setup:admin --reset.'
        });
      }
    } else if (configuredSetupToken) {
      // Even on first setup, if SETUP_TOKEN is set in environment, verify it
      if (setupToken !== configuredSetupToken) {
        return res.status(403).json({ error: 'Invalid SETUP_TOKEN provided.' });
      }
    }

    const passwordHash = hashPassword(cleanPassword);

    const existingUser = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(trimmedEmail) as any;
    if (existingUser) {
      db.prepare(`
        UPDATE users 
        SET username = ?, password_hash = ?, role = 'SUPER_ADMIN', status = 'active'
        WHERE id = ?
      `).run(adminUsername, passwordHash, existingUser.id);

      logAudit(adminUsername, 'Setup API', 'SUPER_ADMIN_PASSWORD_RESET', 'users', '', `Authorized Super Admin password reset for ${trimmedEmail}`);
      return res.json({ success: true, message: 'Administrator credentials updated successfully.' });
    } else {
      db.prepare(`
        INSERT INTO users (username, email, password_hash, role, employee_id, status)
        VALUES (?, ?, ?, 'SUPER_ADMIN', null, 'active')
      `).run(adminUsername, trimmedEmail, passwordHash);

      logAudit(adminUsername, 'Setup API', 'SUPER_ADMIN_CREATED', 'users', '', `Created initial Super Admin for ${trimmedEmail}`);
      return res.json({ success: true, message: 'Super Administrator created successfully.' });
    }
  } catch (err: any) {
    console.error('Admin setup error:', err?.message || err);
    return res.status(500).json({ error: 'Administrator setup failed.' });
  }
});

// 3. Verify Current Session
router.get('/me', authenticateToken, (req: AuthRequest, res: Response) => {
  return res.json({ user: req.user });
});

// 4. Logout
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

// 5. Forgot Password
router.post('/forgot-password', (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Valid email address is required.' });
  }

  // Safe response: do not leak whether user exists
  return res.json({
    success: true,
    message: 'If an account associated with this email exists, password reset instructions have been logged. Please contact your Super Admin to update credentials.'
  });
});

// 6. Demo accounts endpoint (disabled - clean production state)
router.get('/demo-accounts', (req: Request, res: Response) => {
  return res.json({ accounts: [] });
});

export default router;
