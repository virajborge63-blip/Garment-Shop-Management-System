import { Router, Response } from 'express';
import { db } from '../db.ts';
import { authenticateToken, requireEmployee, AuthRequest } from '../auth.ts';

const router = Router();

// Apply auth + strict employee check
router.use(authenticateToken);
router.use(requireEmployee);

// ==========================================
// 1. EMPLOYEE DASHBOARD
// ==========================================
router.get('/dashboard', (req: AuthRequest, res: Response) => {
  try {
    const employeeId = req.user!.employee_id!;
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const monthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}%`;

    // Employee profile
    const emp = db.prepare('SELECT * FROM employees WHERE employee_id = ?').get(employeeId) as any;
    if (!emp) {
      return res.status(404).json({ error: 'Employee record not found.' });
    }

    // Today's attendance
    const todayRecord = db.prepare('SELECT status, working_hours, overtime_hours FROM attendance WHERE employee_id = ? AND date = ?').get(employeeId, today) as any;

    // Monthly attendance summary
    const monthAtt = db.prepare(`
      SELECT 
        SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) as present_days,
        SUM(CASE WHEN status = 'Absent' THEN 1 ELSE 0 END) as absent_days,
        SUM(CASE WHEN status = 'Leave' THEN 1 ELSE 0 END) as leave_days,
        SUM(CASE WHEN status = 'Half Day' THEN 1 ELSE 0 END) as half_days,
        COALESCE(SUM(overtime_hours), 0) as overtime_hours,
        COUNT(*) as total_logged_days
      FROM attendance
      WHERE employee_id = ? AND date LIKE ?
    `).get(employeeId, monthStr) as any;

    const presentDays = monthAtt?.present_days || 0;
    const absentDays = monthAtt?.absent_days || 0;
    const leaveDays = monthAtt?.leave_days || 0;
    const halfDays = monthAtt?.half_days || 0;
    const otHours = monthAtt?.overtime_hours || 0;

    // Settings
    const stdDaysSetting = db.prepare("SELECT value FROM settings WHERE key = 'standard_working_days'").get() as any;
    const stdWorkingDays = stdDaysSetting ? parseInt(stdDaysSetting.value, 10) : 26;
    const leavePaidSetting = db.prepare("SELECT value FROM settings WHERE key = 'leave_is_paid'").get() as any;
    const leaveIsPaid = leavePaidSetting?.value === 'true';

    // Attendance percentage = (Present + 0.5 * HalfDay + (leaveIsPaid ? Leave : 0)) / (Logged Days or Working Days so far)
    const effectiveDays = presentDays + (halfDays * 0.5) + (leaveIsPaid ? leaveDays : 0);
    const totalDaysConsidered = Math.max(presentDays + absentDays + leaveDays + halfDays, 1);
    const attendancePercentage = Math.min(100, Math.round((effectiveDays / totalDaysConsidered) * 1000) / 10);

    // Latest payroll or current month estimate
    const latestPayroll = db.prepare(`
      SELECT * FROM payroll 
      WHERE employee_id = ? 
      ORDER BY year DESC, month DESC 
      LIMIT 1
    `).get(employeeId) as any;

    let currentMonthSalary = emp.monthly_salary;
    if (latestPayroll) {
      currentMonthSalary = latestPayroll.net_salary;
    }

    // Recent 5 attendance days
    const recentHistory = db.prepare(`
      SELECT date, status, working_hours, overtime_hours, notes
      FROM attendance
      WHERE employee_id = ?
      ORDER BY date DESC
      LIMIT 5
    `).all(employeeId);

    return res.json({
      employee: {
        employee_id: emp.employee_id,
        name: emp.name,
        department: emp.department,
        designation: emp.designation,
        avatar_url: emp.avatar_url,
      },
      stats: {
        todayStatus: todayRecord ? todayRecord.status : 'Not Marked',
        todayWorkingHours: todayRecord ? todayRecord.working_hours : 0,
        todayOvertime: todayRecord ? todayRecord.overtime_hours : 0,
        presentDays,
        absentDays,
        leaveDays,
        halfDays,
        workingDays: stdWorkingDays,
        overtimeHours: otHours,
        attendancePercentage: isNaN(attendancePercentage) ? 100 : attendancePercentage,
        currentMonthSalary,
      },
      recentAttendance: recentHistory
    });
  } catch (err: any) {
    console.error('Error in employee dashboard:', err);
    return res.status(500).json({ error: 'Failed to retrieve employee dashboard.' });
  }
});

// ==========================================
// 2. EMPLOYEE PROFILE (READ ONLY)
// ==========================================
router.get('/profile', (req: AuthRequest, res: Response) => {
  try {
    const employeeId = req.user!.employee_id!;
    const emp = db.prepare('SELECT * FROM employees WHERE employee_id = ?').get(employeeId);
    if (!emp) {
      return res.status(404).json({ error: 'Employee not found.' });
    }
    return res.json({ employee: emp });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve profile.' });
  }
});

// ==========================================
// 3. EMPLOYEE ATTENDANCE HISTORY (READ ONLY)
// ==========================================
router.get('/attendance', (req: AuthRequest, res: Response) => {
  try {
    const employeeId = req.user!.employee_id!;
    const { month, year } = req.query;

    let query = `
      SELECT attendance_id, date, status, working_hours, overtime_hours, notes
      FROM attendance
      WHERE employee_id = ?
    `;
    const params: any[] = [employeeId];

    if (month && year) {
      const monthStr = `${year}-${String(month).padStart(2, '0')}%`;
      query += ` AND date LIKE ?`;
      params.push(monthStr);
    }

    query += ` ORDER BY date DESC`;

    const rawRecords = db.prepare(query).all(...params) as any[];

    // Format records with human-readable Day of Week
    const records = rawRecords.map((r) => {
      const d = new Date(r.date);
      const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
      return {
        ...r,
        day: dayName,
      };
    });

    return res.json({ attendance: records });
  } catch (err: any) {
    console.error('Error fetching employee attendance:', err);
    return res.status(500).json({ error: 'Failed to fetch attendance.' });
  }
});

// ==========================================
// 4. EMPLOYEE SALARY BREAKDOWN (READ ONLY)
// ==========================================
router.get('/salary', (req: AuthRequest, res: Response) => {
  try {
    const employeeId = req.user!.employee_id!;
    const { month, year } = req.query;

    const now = new Date();
    const qMonth = month ? parseInt(String(month), 10) : (now.getMonth() + 1);
    const qYear = year ? parseInt(String(year), 10) : now.getFullYear();

    const emp = db.prepare('SELECT * FROM employees WHERE employee_id = ?').get(employeeId) as any;
    if (!emp) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    // Check if finalized payroll exists for this month/year
    const payrollRecord = db.prepare(`
      SELECT * FROM payroll 
      WHERE employee_id = ? AND month = ? AND year = ?
    `).get(employeeId, qMonth, qYear) as any;

    if (payrollRecord) {
      return res.json({
        month: qMonth,
        year: qYear,
        source: 'finalized_payroll',
        details: {
          perDaySalary: payrollRecord.per_day_salary,
          standardWorkingDays: payrollRecord.working_days,
          actualWorkingDays: payrollRecord.present_days + (payrollRecord.half_days * 0.5) + payrollRecord.leave_days,
          presentDays: payrollRecord.present_days,
          leaveDays: payrollRecord.leave_days,
          absentDays: payrollRecord.absent_days,
          halfDays: payrollRecord.half_days,
          extraWorkingDays: payrollRecord.extra_working_days,
          overtimeHours: payrollRecord.overtime_hours,
          overtimeRate: emp.overtime_rate,
          basicSalary: payrollRecord.basic_salary,
          extraDaySalary: payrollRecord.extra_day_salary,
          overtimeSalary: payrollRecord.overtime_salary,
          bonus: payrollRecord.bonus,
          deductions: payrollRecord.deductions,
          finalSalary: payrollRecord.net_salary,
          status: payrollRecord.status,
          payrollId: payrollRecord.payroll_id,
        }
      });
    }

    // If not generated, compute live dynamic formula from attendance
    const stdDaysSetting = db.prepare("SELECT value FROM settings WHERE key = 'standard_working_days'").get() as any;
    const stdWorkingDays = stdDaysSetting ? parseFloat(stdDaysSetting.value) : 26;

    const leavePaidSetting = db.prepare("SELECT value FROM settings WHERE key = 'leave_is_paid'").get() as any;
    const leaveIsPaid = leavePaidSetting?.value === 'true';

    const monthStr = `${qYear}-${String(qMonth).padStart(2, '0')}%`;
    const attStats = db.prepare(`
      SELECT 
        SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) as present_days,
        SUM(CASE WHEN status = 'Absent' THEN 1 ELSE 0 END) as absent_days,
        SUM(CASE WHEN status = 'Leave' THEN 1 ELSE 0 END) as leave_days,
        SUM(CASE WHEN status = 'Half Day' THEN 1 ELSE 0 END) as half_days,
        COALESCE(SUM(overtime_hours), 0) as total_ot
      FROM attendance
      WHERE employee_id = ? AND date LIKE ?
    `).get(employeeId, monthStr) as any;

    const presentDays = attStats?.present_days || 0;
    const absentDays = attStats?.absent_days || 0;
    const leaveDays = attStats?.leave_days || 0;
    const halfDays = attStats?.half_days || 0;
    const otHours = attStats?.total_ot || 0;

    const paidLeaveDays = leaveIsPaid ? leaveDays : 0;
    const actualPaidDays = presentDays + (halfDays * 0.5) + paidLeaveDays;
    const baseDaysForBasic = Math.min(actualPaidDays, stdWorkingDays);
    const basicSalary = Math.round(baseDaysForBasic * emp.per_day_salary);
    const extraWorkingDays = Math.max(0, actualPaidDays - stdWorkingDays);
    const extraDaySalary = Math.round(extraWorkingDays * emp.per_day_salary);
    const overtimeSalary = Math.round(otHours * emp.overtime_rate);
    const bonus = 0;
    const deductions = 0;
    const finalSalary = basicSalary + extraDaySalary + overtimeSalary + bonus - deductions;

    return res.json({
      month: qMonth,
      year: qYear,
      source: 'live_estimate',
      details: {
        perDaySalary: emp.per_day_salary,
        standardWorkingDays: stdWorkingDays,
        actualWorkingDays: actualPaidDays,
        presentDays,
        leaveDays,
        absentDays,
        halfDays,
        extraWorkingDays,
        overtimeHours: otHours,
        overtimeRate: emp.overtime_rate,
        basicSalary,
        extraDaySalary,
        overtimeSalary,
        bonus,
        deductions,
        finalSalary,
        status: 'In Progress / Unfinalized',
      }
    });
  } catch (err: any) {
    console.error('Error fetching employee salary:', err);
    return res.status(500).json({ error: 'Failed to retrieve salary calculation.' });
  }
});

// ==========================================
// 5. EMPLOYEE PAYROLL HISTORY (READ ONLY)
// ==========================================
router.get('/payroll', (req: AuthRequest, res: Response) => {
  try {
    const employeeId = req.user!.employee_id!;
    const records = db.prepare(`
      SELECT * FROM payroll 
      WHERE employee_id = ? 
      ORDER BY year DESC, month DESC
    `).all(employeeId);

    return res.json({ payroll: records });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve payroll history.' });
  }
});

// ==========================================
// 6. EMPLOYEE SALARY SLIPS (READ ONLY & PRINTABLE)
// ==========================================
router.get('/salary-slips', (req: AuthRequest, res: Response) => {
  try {
    const employeeId = req.user!.employee_id!;
    const records = db.prepare(`
      SELECT payroll_id, month, year, net_salary, basic_salary, status, created_at
      FROM payroll 
      WHERE employee_id = ?
      ORDER BY year DESC, month DESC
    `).all(employeeId);

    return res.json({ salarySlips: records });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve salary slips.' });
  }
});

// Get detailed salary slip for printing/download
router.get('/salary-slips/:id', (req: AuthRequest, res: Response) => {
  try {
    const employeeId = req.user!.employee_id!;
    const payrollId = req.params.id;

    // Strict security: ensure the requested salary slip belongs to THIS employee!
    const slip = db.prepare(`
      SELECT p.*, e.name as employee_name, e.department, e.designation, e.joining_date, e.email, e.phone, e.address
      FROM payroll p
      JOIN employees e ON p.employee_id = e.employee_id
      WHERE p.payroll_id = ? AND p.employee_id = ?
    `).get(payrollId, employeeId) as any;

    if (!slip) {
      return res.status(404).json({ error: 'Salary slip not found or access denied.' });
    }

    // Company info
    const settingsRows = db.prepare('SELECT key, value FROM settings').all() as any[];
    const company: Record<string, string> = {};
    settingsRows.forEach((r) => { company[r.key] = r.value; });

    return res.json({
      company,
      salarySlip: slip,
    });
  } catch (err: any) {
    console.error('Error fetching salary slip:', err);
    return res.status(500).json({ error: 'Failed to retrieve salary slip.' });
  }
});

export default router;
