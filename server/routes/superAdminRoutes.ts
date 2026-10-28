import { Router, Response } from 'express';
import {
  User,
  Employee,
  Attendance,
  Setting,
  AuditLog,
  logAudit,
  hashPassword,
  seedWorkersUpTo,
} from '../db.ts';
import { authenticateToken, requireSuperAdmin, AuthRequest } from '../auth.ts';

const router = Router();

// Apply auth + strict Super Admin check
router.use(authenticateToken);
router.use(requireSuperAdmin);

// ==========================================
// 1. OWNER EXECUTIVE DASHBOARD
// ==========================================
router.get('/overview', async (req: AuthRequest, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const monthPrefix = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

    // 1. Store settings
    const settings = await Setting.find();
    const settingsMap: Record<string, string> = {};
    settings.forEach((r) => {
      settingsMap[r.key] = r.value;
    });

    // 2. Workforce totals
    const totalEmployees = await Employee.countDocuments();
    const activeStaff = await Employee.find({ status: 'active' });
    const activeCount = activeStaff.length;

    let monthlyLiability = 0;
    const deptSet = new Set<string>();
    for (const emp of activeStaff) {
      monthlyLiability += emp.monthly_salary || 0;
      deptSet.add(emp.department);
    }

    // 3. Admin accounts count
    const totalAdminAccounts = await User.countDocuments({ role: { $in: ['SUPER_ADMIN', 'ADMIN'] } });

    // 4. Today's attendance
    const todayRecords = await Attendance.find({ date: today });
    let present = 0;
    let absent = 0;
    let halfDay = 0;
    let leave = 0;

    for (const r of todayRecords) {
      if (r.status === 'Present') present++;
      else if (r.status === 'Absent') absent++;
      else if (r.status === 'Half Day') halfDay++;
      else if (r.status === 'Leave') leave++;
    }

    const todayPresenceRate = activeCount > 0 ? Math.round(((present + halfDay * 0.5) / activeCount) * 100) : 0;

    // 5. Overtime expense this month
    const monthAtt = await Attendance.find({
      date: new RegExp(`^${monthPrefix}`),
    });

    const empMap = new Map(activeStaff.map((e) => [e.employee_id, e]));
    let totalOtHours = 0;
    let totalOtCost = 0;

    for (const r of monthAtt) {
      const emp = empMap.get(r.employee_id);
      const otH = r.overtime_hours || 0;
      totalOtHours += otH;
      if (emp) {
        totalOtCost += otH * (emp.overtime_rate || 150);
      }
    }

    // 6. Department breakdown
    const deptStats: Record<string, { headcount: number; totalSalary: number; ot: number }> = {};
    for (const emp of activeStaff) {
      if (!deptStats[emp.department]) {
        deptStats[emp.department] = { headcount: 0, totalSalary: 0, ot: 0 };
      }
      deptStats[emp.department].headcount++;
      deptStats[emp.department].totalSalary += emp.monthly_salary || 0;
    }

    for (const r of monthAtt) {
      const emp = empMap.get(r.employee_id);
      if (emp && deptStats[emp.department]) {
        deptStats[emp.department].ot += r.overtime_hours || 0;
      }
    }

    const departmentBreakdown = Object.keys(deptStats).map((dept) => ({
      department: dept,
      headcount: deptStats[dept].headcount,
      totalMonthlySalary: deptStats[dept].totalSalary,
      overtimeHours: Math.round(deptStats[dept].ot),
    }));

    // 7. Recent executive audit logs
    const recentLogs = await AuditLog.find().sort({ timestamp: -1 }).limit(10);

    return res.json({
      ownerInfo: {
        storeName: settingsMap['company_name'] || 'H.M. RAJPAL GARMENT SHOP',
        ownerName: 'H.M. Rajpal',
        address: settingsMap['company_address'] || 'Shop No. 12-14, Cloth Market, Main Bazaar',
        phone: settingsMap['company_phone'] || '+91 98234 56789',
        email: settingsMap['company_email'] || 'contact@rajpalgarments.com',
      },
      metrics: {
        totalWorkforce: totalEmployees,
        activeWorkforce: activeCount,
        totalDepartments: deptSet.size,
        totalAdminAccounts,
        monthlyWageLiability: monthlyLiability,
        monthlyOvertimeExpense: Math.round(totalOtCost),
        estimatedAnnualPayroll: monthlyLiability * 12,
        todayPresenceRate,
        todayPresentCount: present,
        todayAbsentCount: absent,
        todayLeaveCount: leave,
      },
      departmentBreakdown,
      recentSecurityEvents: recentLogs.map((l) => ({
        id: l._id.toString(),
        admin_id: l.admin_id,
        admin_name: l.admin_name,
        action: l.action,
        record_affected: l.record_affected,
        previous_value: l.previous_value,
        new_value: l.new_value,
        timestamp: l.timestamp.toISOString(),
      })),
    });
  } catch (err: any) {
    console.error('Super Admin overview error:', err);
    return res.status(500).json({ error: 'Failed to retrieve owner dashboard metrics.' });
  }
});

// ==========================================
// 2. ADMIN ACCOUNTS (STORE MANAGERS & RBAC)
// ==========================================
router.get('/admins', async (req: AuthRequest, res: Response) => {
  try {
    const admins = await User.find({ role: { $in: ['SUPER_ADMIN', 'ADMIN'] } }).sort({ created_at: -1 });
    return res.json({
      admins: admins.map((a) => ({
        id: a._id.toString(),
        username: a.username,
        email: a.email,
        role: a.role,
        status: a.status,
        created_at: a.created_at.toISOString(),
      })),
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve admin accounts.' });
  }
});

// Create Admin account
router.post('/admins', async (req: AuthRequest, res: Response) => {
  try {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();
    const assignedRole = role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'ADMIN';

    // Check unique username or email
    const existing = await User.findOne({
      $or: [{ username: cleanUsername }, { email: cleanEmail }],
    });
    if (existing) {
      return res.status(400).json({ error: 'A user with this username or email already exists.' });
    }

    const hashed = hashPassword(password);
    const newAdmin = await User.create({
      username: cleanUsername,
      email: cleanEmail,
      password_hash: hashed,
      role: assignedRole,
      employee_id: null,
      status: 'active',
      created_at: new Date(),
    });

    await logAudit(
      req.user!.username,
      req.user!.name || 'Owner',
      'ADMIN_ACCOUNT_CREATED',
      `Account @${cleanUsername} (${cleanEmail})`,
      '',
      `Role: ${assignedRole}`
    );

    return res.status(201).json({
      success: true,
      message: `Admin account for @${cleanUsername} created successfully with role ${assignedRole}.`,
      admin: {
        id: newAdmin._id.toString(),
        username: newAdmin.username,
        email: newAdmin.email,
        role: newAdmin.role,
        status: newAdmin.status,
        created_at: newAdmin.created_at.toISOString(),
      },
    });
  } catch (err: any) {
    console.error('Create admin error:', err);
    return res.status(500).json({ error: 'Failed to create admin account.' });
  }
});

// Update Admin account
router.put('/admins/:id', async (req: AuthRequest, res: Response) => {
  try {
    const adminId = req.params.id;
    const targetUser = await User.findById(adminId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Owner protection: cannot demote own account or deactivate self
    if (targetUser._id.toString() === req.user!.id && req.body.status === 'inactive') {
      return res.status(400).json({ error: 'You cannot deactivate your own Super Admin account.' });
    }

    const { status, password, role } = req.body;

    if (status && (status === 'active' || status === 'inactive')) {
      targetUser.status = status;
    }

    if (role && (role === 'ADMIN' || role === 'SUPER_ADMIN')) {
      targetUser.role = role;
    }

    if (password && password.trim().length >= 8) {
      targetUser.password_hash = hashPassword(password.trim());
    }

    await targetUser.save();

    await logAudit(
      req.user!.username,
      req.user!.name || 'Owner',
      'ADMIN_ACCOUNT_MODIFIED',
      `Account #${adminId} (@${targetUser.username})`,
      '',
      `Status: ${targetUser.status}, Role: ${targetUser.role}`
    );

    return res.json({ success: true, message: `Admin account @${targetUser.username} updated.` });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update admin account.' });
  }
});

// Delete Admin account
router.delete('/admins/:id', async (req: AuthRequest, res: Response) => {
  try {
    const adminId = req.params.id;
    const targetUser = await User.findById(adminId);
    if (!targetUser) {
      return res.status(404).json({ error: 'Admin account not found.' });
    }

    // Owner protection
    if (targetUser._id.toString() === req.user!.id) {
      return res.status(400).json({ error: 'You cannot delete your own Super Admin account.' });
    }

    await User.findByIdAndDelete(adminId);

    await logAudit(
      req.user!.username,
      req.user!.name || 'Owner',
      'ADMIN_ACCOUNT_DELETED',
      `Account #${adminId} (@${targetUser.username})`,
      `Role: ${targetUser.role}`,
      'Account deleted'
    );

    return res.json({ success: true, message: `Admin account @${targetUser.username} removed.` });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete admin account.' });
  }
});

// ==========================================
// 3. SEED 100+ STORE WORKERS (PERFORMANCE TEST)
// ==========================================
router.post('/seed-test-workers', async (req: AuthRequest, res: Response) => {
  try {
    const target = req.body.count ? parseInt(req.body.count, 10) : 100;
    const finalCount = await seedWorkersUpTo(target);

    await logAudit(
      req.user!.username,
      req.user!.name || 'Owner',
      'TEST_DATA_SEEDED',
      'Employees & Users in MongoDB',
      '',
      `Ensured ${finalCount} workforce profiles`
    );

    return res.json({
      success: true,
      message: `Workforce database populated to ${finalCount} active employees.`,
      count: finalCount,
    });
  } catch (err: any) {
    console.error('Seeding error:', err);
    return res.status(500).json({ error: 'Failed to seed staff members.' });
  }
});

export default router;
