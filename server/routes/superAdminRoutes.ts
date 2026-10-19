import { Router, Response } from 'express';
import { db, logAudit, hashPassword, seedWorkersUpTo } from '../db.ts';
import { authenticateToken, requireSuperAdmin, AuthRequest } from '../auth.ts';

const router = Router();

// Apply auth + strict Super Admin check
router.use(authenticateToken);
router.use(requireSuperAdmin);

// ==========================================
// 1. OWNER EXECUTIVE DASHBOARD
// ==========================================
router.get('/overview', (req: AuthRequest, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const monthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}%`;

    // 1. Store settings
    const settingsRows = db.prepare('SELECT key, value FROM settings').all() as any[];
    const settingsMap: Record<string, string> = {};
    settingsRows.forEach((r) => { settingsMap[r.key] = r.value; });

    // 2. Workforce totals
    const workforce = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(monthly_salary) as monthly_liability,
        COUNT(DISTINCT department) as total_departments
      FROM employees
    `).get() as any;

    // 3. Admin accounts count
    const adminCountRow = db.prepare(`
      SELECT COUNT(*) as count FROM users WHERE role IN ('SUPER_ADMIN', 'ADMIN')
    `).get() as any;

    // 4. Today's attendance
    const todayCounts = db.prepare(`
      SELECT 
        SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN status = 'Absent' THEN 1 ELSE 0 END) as absent,
        SUM(CASE WHEN status = 'Half Day' THEN 1 ELSE 0 END) as half_day,
        SUM(CASE WHEN status = 'Leave' THEN 1 ELSE 0 END) as leave
      FROM attendance
      WHERE date = ?
    `).get(today) as any;

    const present = todayCounts?.present || 0;
    const absent = todayCounts?.absent || 0;
    const halfDay = todayCounts?.half_day || 0;
    const leave = todayCounts?.leave || 0;
    const activeStaff = workforce.active || 1;
    const todayPresenceRate = Math.round(((present + halfDay * 0.5) / activeStaff) * 100);

    // 5. Overtime expense this month
    const otStats = db.prepare(`
      SELECT 
        COALESCE(SUM(a.overtime_hours), 0) as total_ot_hours,
        COALESCE(SUM(a.overtime_hours * e.overtime_rate), 0) as total_ot_cost
      FROM attendance a
      JOIN employees e ON a.employee_id = e.employee_id
      WHERE a.date LIKE ?
    `).get(monthStr) as any;

    // 6. Department breakdown
    const deptBreakdown = db.prepare(`
      SELECT 
        e.department,
        COUNT(e.employee_id) as headcount,
        SUM(e.monthly_salary) as total_monthly_salary,
        COALESCE(SUM(a.overtime_hours), 0) as overtime_hours
      FROM employees e
      LEFT JOIN attendance a ON e.employee_id = a.employee_id AND a.date LIKE ?
      WHERE e.status = 'active'
      GROUP BY e.department
      ORDER BY headcount DESC
    `).all(monthStr) as any[];

    // 7. Recent executive audit logs
    const recentLogs = db.prepare(`
      SELECT id, admin_id, admin_name, action, record_affected, previous_value, new_value, timestamp
      FROM audit_logs
      ORDER BY id DESC
      LIMIT 10
    `).all();

    return res.json({
      ownerInfo: {
        storeName: settingsMap['company_name'] || 'H.M. RAJPAL GARMENT SHOP',
        ownerName: 'H.M. Rajpal',
        address: settingsMap['company_address'] || 'Shop No. 12-14, Cloth Market, Main Bazaar',
        phone: settingsMap['company_phone'] || '+91 98234 56789',
        email: settingsMap['company_email'] || 'contact@rajpalgarments.com',
      },
      metrics: {
        totalWorkforce: workforce.total || 0,
        activeWorkforce: workforce.active || 0,
        totalDepartments: workforce.total_departments || 0,
        totalAdminAccounts: adminCountRow?.count || 0,
        monthlyWageLiability: workforce.monthly_liability || 0,
        monthlyOvertimeExpense: Math.round(otStats?.total_ot_cost || 0),
        estimatedAnnualPayroll: Math.round((workforce.monthly_liability || 0) * 12),
        todayPresenceRate,
        todayPresentCount: present,
        todayAbsentCount: absent,
        todayHalfDayCount: halfDay,
        todayLeaveCount: leave,
      },
      departmentBreakdown: deptBreakdown,
      recentSecurityEvents: recentLogs,
    });
  } catch (err: any) {
    console.error('Super Admin overview error:', err);
    return res.status(500).json({ error: 'Failed to retrieve owner executive metrics.' });
  }
});

// ==========================================
// 2. ADMIN & MANAGER ACCOUNT MANAGEMENT
// ==========================================
// List all Admin and Super Admin accounts
router.get('/admins', (req: AuthRequest, res: Response) => {
  try {
    const admins = db.prepare(`
      SELECT id, username, email, role, status, created_at
      FROM users
      WHERE role IN ('SUPER_ADMIN', 'ADMIN')
      ORDER BY role ASC, id ASC
    `).all();
    return res.json({ admins });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch admin accounts.' });
  }
});

// Create new Manager / Admin user
router.post('/admins', (req: AuthRequest, res: Response) => {
  try {
    const { username, email, password, role } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required.' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();
    const assignedRole = role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'ADMIN';

    // Check unique username or email
    const existing = db.prepare('SELECT id FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?').get(cleanUsername, cleanEmail);
    if (existing) {
      return res.status(400).json({ error: 'A user with this username or email already exists.' });
    }

    const hashed = hashPassword(password);
    db.prepare(`
      INSERT INTO users (username, email, password_hash, role, employee_id, status)
      VALUES (?, ?, ?, ?, null, 'active')
    `).run(cleanUsername, cleanEmail, hashed, assignedRole);

    logAudit(
      req.user!.username, req.user!.name || 'Owner', 'ADMIN_ACCOUNT_CREATED',
      `Account @${cleanUsername} (${cleanEmail})`, '', `Role: ${assignedRole}`
    );

    return res.status(201).json({
      success: true,
      message: `Admin account for @${cleanUsername} created successfully with role ${assignedRole}.`
    });
  } catch (err: any) {
    console.error('Create admin error:', err);
    return res.status(500).json({ error: 'Failed to create admin account.' });
  }
});

// Update Admin account (status / password)
router.put('/admins/:id', (req: AuthRequest, res: Response) => {
  try {
    const adminId = parseInt(req.params.id, 10);
    const targetUser = db.prepare('SELECT * FROM users WHERE id = ?').get(adminId) as any;
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Owner protection: cannot demote own account or deactivate self
    if (targetUser.id === req.user!.id && req.body.status === 'inactive') {
      return res.status(400).json({ error: 'You cannot deactivate your own Super Admin account.' });
    }

    const { status, password, role } = req.body;

    if (status && (status === 'active' || status === 'inactive')) {
      db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, adminId);
    }

    if (role && (role === 'ADMIN' || role === 'SUPER_ADMIN')) {
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, adminId);
    }

    if (password && password.trim().length >= 4) {
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password.trim()), adminId);
    }

    logAudit(
      req.user!.username, req.user!.name || 'Owner', 'ADMIN_ACCOUNT_MODIFIED',
      `Account #${adminId} (@${targetUser.username})`, `Status: ${targetUser.status}`, `Status: ${status || targetUser.status}`
    );

    return res.json({ success: true, message: `Admin account @${targetUser.username} updated.` });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update admin account.' });
  }
});

// Delete Admin account
router.delete('/admins/:id', (req: AuthRequest, res: Response) => {
  try {
    const adminId = parseInt(req.params.id, 10);
    if (adminId === req.user!.id) {
      return res.status(400).json({ error: 'Cannot delete your own active Super Admin session.' });
    }

    const targetUser = db.prepare('SELECT * FROM users WHERE id = ?').get(adminId) as any;
    if (!targetUser) {
      return res.status(404).json({ error: 'Account not found.' });
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(adminId);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(adminId);

    logAudit(
      req.user!.username, req.user!.name || 'Owner', 'ADMIN_ACCOUNT_DELETED',
      `Account @${targetUser.username}`, 'Active admin account', 'Deleted'
    );

    return res.json({ success: true, message: `Account @${targetUser.username} deleted.` });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete admin account.' });
  }
});

export default router;
