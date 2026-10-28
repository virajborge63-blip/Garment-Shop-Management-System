import { Router, Response } from 'express';
import { Employee, Attendance, Payroll, Setting } from '../db.ts';
import { authenticateToken, requireEmployee, AuthRequest } from '../auth.ts';

const router = Router();

// Apply auth + strict employee check
router.use(authenticateToken);
router.use(requireEmployee);

// ==========================================
// 1. EMPLOYEE DASHBOARD
// ==========================================
router.get('/dashboard', async (req: AuthRequest, res: Response) => {
  try {
    const employeeId = req.user!.employee_id!;
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const monthPrefix = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

    // Employee profile
    const emp = await Employee.findOne({ employee_id: employeeId });
    if (!emp) {
      return res.status(404).json({ error: 'Employee record not found.' });
    }

    // Today's attendance
    const todayRecord = await Attendance.findOne({ employee_id: employeeId, date: today });

    // Monthly attendance summary
    const monthAtt = await Attendance.find({
      employee_id: employeeId,
      date: new RegExp(`^${monthPrefix}`),
    });

    let presentDays = 0;
    let absentDays = 0;
    let leaveDays = 0;
    let halfDays = 0;
    let otHours = 0;

    for (const r of monthAtt) {
      if (r.status === 'Present') presentDays++;
      else if (r.status === 'Absent') absentDays++;
      else if (r.status === 'Leave') leaveDays++;
      else if (r.status === 'Half Day') halfDays++;
      otHours += r.overtime_hours || 0;
    }

    // Settings
    const stdDaysSetting = await Setting.findOne({ key: 'standard_working_days' });
    const stdWorkingDays = stdDaysSetting ? parseInt(stdDaysSetting.value, 10) : 26;
    const leavePaidSetting = await Setting.findOne({ key: 'leave_is_paid' });
    const leaveIsPaid = leavePaidSetting?.value === 'true';

    // Attendance percentage
    const effectiveDays = presentDays + (halfDays * 0.5) + (leaveIsPaid ? leaveDays : 0);
    const totalDaysConsidered = Math.max(presentDays + absentDays + leaveDays + halfDays, 1);
    const attendancePercentage = Math.min(100, Math.round((effectiveDays / totalDaysConsidered) * 1000) / 10);

    // Latest payroll or current month estimate
    const latestPayroll = await Payroll.findOne({ employee_id: employeeId }).sort({ year: -1, month: -1 });

    let currentMonthSalary = emp.monthly_salary;
    if (latestPayroll) {
      currentMonthSalary = latestPayroll.net_salary;
    }

    // Recent 5 attendance days
    const recentHistory = await Attendance.find({ employee_id: employeeId }).sort({ date: -1 }).limit(5);

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
        overtimeHours: Math.round(otHours),
        attendancePercentage,
        currentMonthSalary,
      },
      recentAttendance: recentHistory.map((r) => ({
        date: r.date,
        status: r.status,
        working_hours: r.working_hours,
        overtime_hours: r.overtime_hours,
        notes: r.notes || '',
      })),
    });
  } catch (err: any) {
    console.error('Employee dashboard error:', err);
    return res.status(500).json({ error: 'Failed to retrieve employee dashboard.' });
  }
});

// ==========================================
// 2. EMPLOYEE PROFILE (READ / SELF-UPDATE)
// ==========================================
router.get('/profile', async (req: AuthRequest, res: Response) => {
  try {
    const employeeId = req.user!.employee_id!;
    const emp = await Employee.findOne({ employee_id: employeeId });
    if (!emp) {
      return res.status(404).json({ error: 'Employee not found.' });
    }
    return res.json({ employee: emp });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve profile.' });
  }
});

router.put('/profile', async (req: AuthRequest, res: Response) => {
  try {
    const employeeId = req.user!.employee_id!;
    const { phone, address, avatar_url } = req.body;

    const emp = await Employee.findOne({ employee_id: employeeId });
    if (!emp) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    if (phone !== undefined) emp.phone = phone;
    if (address !== undefined) emp.address = address;
    if (avatar_url !== undefined) emp.avatar_url = avatar_url;
    await emp.save();

    return res.json({ success: true, message: 'Profile updated successfully.', employee: emp });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update profile.' });
  }
});

// ==========================================
// 3. EMPLOYEE ATTENDANCE HISTORY
// ==========================================
router.get('/attendance', async (req: AuthRequest, res: Response) => {
  try {
    const employeeId = req.user!.employee_id!;
    const { month, year } = req.query;

    const filter: any = { employee_id: employeeId };
    if (month && year) {
      const prefix = `${year}-${String(month).padStart(2, '0')}`;
      filter.date = new RegExp(`^${prefix}`);
    }

    const records = await Attendance.find(filter).sort({ date: -1 });

    const enriched = records.map((r) => {
      const d = new Date(r.date);
      const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
      return {
        attendance_id: r._id.toString(),
        employee_id: r.employee_id,
        date: r.date,
        day: dayName,
        status: r.status,
        working_hours: r.working_hours,
        overtime_hours: r.overtime_hours,
        notes: r.notes,
      };
    });

    return res.json({ attendance: enriched });
  } catch (err: any) {
    console.error('Error fetching employee attendance:', err);
    return res.status(500).json({ error: 'Failed to fetch attendance.' });
  }
});

// ==========================================
// 4. EMPLOYEE SALARY BREAKDOWN (READ ONLY)
// ==========================================
router.get('/salary', async (req: AuthRequest, res: Response) => {
  try {
    const employeeId = req.user!.employee_id!;
    const { month, year } = req.query;

    const now = new Date();
    const qMonth = month ? parseInt(String(month), 10) : (now.getMonth() + 1);
    const qYear = year ? parseInt(String(year), 10) : now.getFullYear();

    const emp = await Employee.findOne({ employee_id: employeeId });
    if (!emp) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    // Check if finalized payroll exists for this month/year
    const payrollRecord = await Payroll.findOne({ employee_id: employeeId, month: qMonth, year: qYear });

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
          payrollId: payrollRecord._id.toString(),
        }
      });
    }

    // If not generated, compute live dynamic formula from attendance
    const stdDaysSetting = await Setting.findOne({ key: 'standard_working_days' });
    const stdWorkingDays = stdDaysSetting ? parseFloat(stdDaysSetting.value) : 26;

    const leavePaidSetting = await Setting.findOne({ key: 'leave_is_paid' });
    const leaveIsPaid = leavePaidSetting?.value === 'true';

    const monthPrefix = `${qYear}-${String(qMonth).padStart(2, '0')}`;
    const attRecs = await Attendance.find({ employee_id: employeeId, date: new RegExp(`^${monthPrefix}`) });

    let presentDays = 0;
    let absentDays = 0;
    let leaveDays = 0;
    let halfDays = 0;
    let otHours = 0;

    for (const r of attRecs) {
      if (r.status === 'Present') presentDays++;
      else if (r.status === 'Absent') absentDays++;
      else if (r.status === 'Leave') leaveDays++;
      else if (r.status === 'Half Day') halfDays++;
      otHours += r.overtime_hours || 0;
    }

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
router.get('/payroll', async (req: AuthRequest, res: Response) => {
  try {
    const employeeId = req.user!.employee_id!;
    const records = await Payroll.find({ employee_id: employeeId }).sort({ year: -1, month: -1 });

    return res.json({
      payroll: records.map((r) => ({
        payroll_id: r._id.toString(),
        employee_id: r.employee_id,
        month: r.month,
        year: r.year,
        working_days: r.working_days,
        present_days: r.present_days,
        absent_days: r.absent_days,
        leave_days: r.leave_days,
        half_days: r.half_days,
        overtime_hours: r.overtime_hours,
        extra_working_days: r.extra_working_days,
        per_day_salary: r.per_day_salary,
        basic_salary: r.basic_salary,
        extra_day_salary: r.extra_day_salary,
        overtime_salary: r.overtime_salary,
        bonus: r.bonus,
        deductions: r.deductions,
        net_salary: r.net_salary,
        status: r.status,
        generated_by: r.generated_by,
        created_at: r.created_at.toISOString(),
      })),
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve payroll history.' });
  }
});

// ==========================================
// 6. EMPLOYEE SALARY SLIPS (READ ONLY & PRINTABLE)
// ==========================================
router.get('/salary-slips', async (req: AuthRequest, res: Response) => {
  try {
    const employeeId = req.user!.employee_id!;
    const records = await Payroll.find({ employee_id: employeeId }).sort({ year: -1, month: -1 });

    return res.json({
      salarySlips: records.map((r) => ({
        payroll_id: r._id.toString(),
        month: r.month,
        year: r.year,
        net_salary: r.net_salary,
        basic_salary: r.basic_salary,
        status: r.status,
        created_at: r.created_at.toISOString(),
      })),
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve salary slips.' });
  }
});

// Get detailed salary slip for printing/download
router.get('/salary-slips/:id', async (req: AuthRequest, res: Response) => {
  try {
    const employeeId = req.user!.employee_id!;
    const payrollId = req.params.id;

    const slip = await Payroll.findOne({ _id: payrollId, employee_id: employeeId });
    if (!slip) {
      return res.status(404).json({ error: 'Salary slip not found or access denied.' });
    }

    const emp = await Employee.findOne({ employee_id: employeeId });

    // Company info
    const settings = await Setting.find();
    const company: Record<string, string> = {};
    settings.forEach((r) => { company[r.key] = r.value; });

    return res.json({
      company,
      salarySlip: {
        ...slip.toObject(),
        payroll_id: slip._id.toString(),
        employee_name: emp?.name,
        department: emp?.department,
        designation: emp?.designation,
        joining_date: emp?.joining_date,
        email: emp?.email,
        phone: emp?.phone,
        address: emp?.address,
      },
    });
  } catch (err: any) {
    console.error('Error fetching salary slip:', err);
    return res.status(500).json({ error: 'Failed to retrieve salary slip.' });
  }
});

export default router;
