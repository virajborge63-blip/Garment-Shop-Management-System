import { Router, Response } from 'express';
import {
  Employee,
  Attendance,
  Payroll,
  Setting,
  AuditLog,
  Session,
  User,
  logAudit,
  hashPassword,
} from '../db.ts';
import { authenticateToken, requireAdmin, AuthRequest } from '../auth.ts';
import {
  addCalendarDays,
  addCalendarMonths,
  getBusinessDate,
  getBusinessDateParts,
  getWeekdayAbbreviation,
} from '../../shared/businessDate.ts';
import {
  ATTENDANCE_PAGE_SIZE_DEFAULT,
  ATTENDANCE_PAGE_SIZE_MAX,
  EMPLOYEE_PAGE_SIZE_DEFAULT,
  EMPLOYEE_PAGE_SIZE_MAX,
} from '../../shared/pagination.ts';
import { parsePagination } from '../pagination.ts';

const router = Router();

// Apply auth + strict admin check to all routes in this router
router.use(authenticateToken);
router.use(requireAdmin);

class EmployeeArchiveConflictError extends Error {}

function parsePositiveSalary(value: unknown): number | undefined {
  if (
    (typeof value !== 'number' && typeof value !== 'string') ||
    (typeof value === 'string' && value.trim() === '')
  ) {
    return undefined;
  }
  const salary = Number(value);
  return Number.isFinite(salary) && salary > 0 ? salary : undefined;
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 11000
  );
}

// ==========================================
// 1. ADMIN DASHBOARD
// ==========================================
router.get('/dashboard', async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const today = getBusinessDate(now);
    const { month: currentMonth, year: currentYear } = getBusinessDateParts(now);
    const monthPrefix = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

    // Total Employees
    const totalEmployees = await Employee.countDocuments();
    const activeEmployees = await Employee.countDocuments({ status: 'active' });

    // Today's attendance
    const todayRecords = await Attendance.find({ date: today });
    let presentToday = 0;
    let absentToday = 0;
    let onLeaveToday = 0;
    let halfDayToday = 0;

    for (const rec of todayRecords) {
      if (rec.status === 'Present') presentToday++;
      else if (rec.status === 'Absent') absentToday++;
      else if (rec.status === 'Leave') onLeaveToday++;
      else if (rec.status === 'Half Day') halfDayToday++;
    }

    // Monthly overtime & working days
    const monthStart = `${monthPrefix}-01`;
    const monthEnd = `${monthPrefix}-31`;
    const [monthlyOvertime, activeStaff] = await Promise.all([
      Attendance.aggregate<{
        _id: string;
        overtime: number;
      }>([
        { $match: { date: { $gte: monthStart, $lte: monthEnd } } },
        {
          $group: {
            _id: '$employee_id',
            overtime: { $sum: { $ifNull: ['$overtime_hours', 0] } },
          },
        },
      ]),
      Employee.find({ status: 'active' }).lean(),
    ]);
    const totalOvertimeHours = monthlyOvertime.reduce((sum, record) => sum + record.overtime, 0);

    // Settings
    const stdDaysSetting = await Setting.findOne({ key: 'standard_working_days' });
    const standardWorkingDays = stdDaysSetting ? parseInt(stdDaysSetting.value, 10) : 26;

    // Current month payroll sum
    const payrollRecords = await Payroll.find({ month: currentMonth, year: currentYear });
    let currentMonthPayroll = 0;
    let totalSalaryPaid = 0;
    for (const pr of payrollRecords) {
      currentMonthPayroll += pr.net_salary || 0;
      if (pr.status === 'Paid') {
        totalSalaryPaid += pr.net_salary || 0;
      }
    }

    // Recent 7 Days Attendance Trend Chart
    const firstTrendDate = addCalendarDays(today, -6);
    const dailyAttendanceCounts = await Attendance.aggregate<{
      _id: { date: string; status: string };
      count: number;
    }>([
      { $match: { date: { $gte: firstTrendDate, $lte: today } } },
      { $group: { _id: { date: '$date', status: '$status' }, count: { $sum: 1 } } },
    ]);
    const dailyCounts = new Map<string, Record<string, number>>();
    for (const entry of dailyAttendanceCounts) {
      const counts = dailyCounts.get(entry._id.date) || {};
      counts[entry._id.status] = entry.count;
      dailyCounts.set(entry._id.date, counts);
    }

    const dailyAttendance = [];
    for (let i = 6; i >= 0; i--) {
      const dateStr = addCalendarDays(today, -i);
      const dayName = getWeekdayAbbreviation(dateStr);
      const counts = dailyCounts.get(dateStr) || {};

      dailyAttendance.push({
        date: dateStr,
        day: dayName,
        present: counts.Present || 0,
        absent: counts.Absent || 0,
        leave: counts.Leave || 0,
        halfDay: counts['Half Day'] || 0,
      });
    }

    // Monthly Comparison Chart (last 6 months)
    const monthlyComparison = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const firstComparisonMonth = addCalendarMonths(currentYear, currentMonth, -5);
    const monthlyAttendanceCounts = await Attendance.aggregate<{
      _id: string;
      total: number;
      present: number;
      halfDay: number;
      overtime: number;
    }>([
      {
        $match: {
          date: {
            $gte: `${firstComparisonMonth.year}-${String(firstComparisonMonth.month).padStart(2, '0')}-01`,
            $lte: `${monthPrefix}-31`,
          },
        },
      },
      {
        $group: {
          _id: { $substrBytes: ['$date', 0, 7] },
          total: { $sum: 1 },
          present: { $sum: { $cond: [{ $eq: ['$status', 'Present'] }, 1, 0] } },
          halfDay: { $sum: { $cond: [{ $eq: ['$status', 'Half Day'] }, 1, 0] } },
          overtime: { $sum: { $ifNull: ['$overtime_hours', 0] } },
        },
      },
    ]);
    const monthlyCounts = new Map(monthlyAttendanceCounts.map((entry) => [entry._id, entry]));

    for (let i = 5; i >= 0; i--) {
      const { month: m, year: y } = addCalendarMonths(currentYear, currentMonth, -i);
      const mStr = `${y}-${String(m).padStart(2, '0')}`;
      const totals = monthlyCounts.get(mStr);
      const mPresent = (totals?.present || 0) + (totals?.halfDay || 0) * 0.5;
      const mTotal = totals?.total || 0;

      const presentRate = mTotal > 0 ? Math.round((mPresent / mTotal) * 100) : 0;
      monthlyComparison.push({
        month: `${monthNames[m - 1]} ${y}`,
        presentRate,
        totalOt: Math.round(totals?.overtime || 0),
      });
    }

    // Overtime by department
    const deptMap: Record<string, { count: number; ot: number }> = {};
    const employeeDepartments = new Map<string, string>();
    for (const emp of activeStaff) {
      if (!deptMap[emp.department]) {
        deptMap[emp.department] = { count: 0, ot: 0 };
      }
      deptMap[emp.department].count++;
      employeeDepartments.set(emp.employee_id, emp.department);
    }

    for (const rec of monthlyOvertime) {
      const department = employeeDepartments.get(rec._id);
      if (department && deptMap[department]) {
        deptMap[department].ot += rec.overtime;
      }
    }

    const overtimeByDept = Object.keys(deptMap).map((dept) => ({
      department: dept,
      employees_count: deptMap[dept].count,
      ot_hours: Math.round(deptMap[dept].ot),
    }));

    // Recent 5 attendance records
    const recentAtt = await Attendance.find().sort({ created_at: -1 }).limit(5);
    const recentEmployees = await Employee.find({
      employee_id: { $in: recentAtt.map((record) => record.employee_id) },
    }).lean();
    const recentEmployeeMap = new Map(recentEmployees.map((employee) => [employee.employee_id, employee]));
    const recentAttendance = [];
    for (const r of recentAtt) {
      const emp = recentEmployeeMap.get(r.employee_id);
      recentAttendance.push({
        attendance_id: r._id.toString(),
        employee_id: r.employee_id,
        employee_name: emp?.name || r.employee_id,
        department: emp?.department || '',
        designation: emp?.designation || '',
        avatar_url: emp?.avatar_url || '',
        date: r.date,
        status: r.status,
        working_hours: r.working_hours,
        overtime_hours: r.overtime_hours,
        notes: r.notes,
      });
    }

    // Recent 5 audit logs
    const recentLogs = await AuditLog.find().sort({ timestamp: -1 }).limit(5);

    return res.json({
      cards: {
        totalEmployees,
        activeEmployees,
        presentToday,
        absentToday,
        onLeaveToday,
        halfDayToday,
        totalWorkingDays: standardWorkingDays,
        totalOvertimeHours: Math.round(totalOvertimeHours),
        currentMonthPayroll,
        totalSalaryPaid,
      },
      charts: {
        dailyAttendance,
        monthlyComparison,
        overtimeByDept,
      },
      recentAttendance,
      recentEmployeeActivity: recentLogs.map((l) => ({
        id: l._id.toString(),
        admin_name: l.admin_name,
        action: l.action,
        record_affected: l.record_affected,
        timestamp: l.timestamp.toISOString(),
        new_value: l.new_value || '',
      })),
    });
  } catch (err: any) {
    console.error('Admin dashboard error:', err);
    return res.status(500).json({ error: 'Failed to generate admin dashboard metrics.' });
  }
});

// ==========================================
// 2. EMPLOYEE DIRECTORY & CRUD
// ==========================================
router.get('/employees', async (req: AuthRequest, res: Response) => {
  try {
    const { search, department, status } = req.query;
    const pagination = parsePagination(
      req.query.page,
      req.query.limit,
      EMPLOYEE_PAGE_SIZE_DEFAULT,
      EMPLOYEE_PAGE_SIZE_MAX
    );
    if (!pagination) {
      return res.status(400).json({ error: 'Page and limit must be positive integers.' });
    }
    const filter: any = {};

    if (req.query.include_archived !== 'true') {
      filter.is_active = { $ne: false };
    }
    if (status && status !== 'All') {
      filter.status = status;
    }
    if (department && department !== 'All') {
      filter.department = department;
    }
    if (search && typeof search === 'string' && search.trim()) {
      const s = search.trim();
      const regex = new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { name: regex },
        { employee_id: regex },
        { email: regex },
        { designation: regex },
        { phone: regex },
      ];
    }

    const requestedSortField = req.query.sort_by;
    const sortField =
      typeof requestedSortField === 'string' &&
      ['employee_id', 'name', 'monthly_salary'].includes(requestedSortField)
        ? requestedSortField
        : 'employee_id';
    const sortDirection = req.query.sort_order === 'desc' ? -1 : 1;
    const sort: Record<string, 1 | -1> = sortField === 'employee_id'
      ? { employee_id: sortDirection }
      : { [sortField]: sortDirection, employee_id: 1 };

    const [employees, total] = await Promise.all([
      Employee.find(filter).sort(sort).skip(pagination.skip).limit(pagination.limit).lean(),
      Employee.countDocuments(filter),
    ]);
    const { month: currentMonth, year: currentYear } = getBusinessDateParts();
    const monthPrefix = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    const monthlyAttendance = employees.length > 0
      ? await Attendance.aggregate<{
          _id: string;
          present: number;
          absent: number;
          leave: number;
          overtime: number;
        }>([
          {
            $match: {
              employee_id: { $in: employees.map((employee) => employee.employee_id) },
              date: { $gte: `${monthPrefix}-01`, $lte: `${monthPrefix}-31` },
            },
          },
          {
            $group: {
              _id: '$employee_id',
              present: { $sum: { $cond: [{ $eq: ['$status', 'Present'] }, 1, 0] } },
              absent: { $sum: { $cond: [{ $eq: ['$status', 'Absent'] }, 1, 0] } },
              leave: { $sum: { $cond: [{ $eq: ['$status', 'Leave'] }, 1, 0] } },
              overtime: { $sum: { $ifNull: ['$overtime_hours', 0] } },
            },
          },
        ])
      : [];
    const statsMap = new Map(monthlyAttendance.map((entry) => [entry._id, entry]));

    const employeeList = employees.map((emp) => {
      const stats = statsMap.get(emp.employee_id);
      return {
        employee_id: emp.employee_id,
        name: emp.name,
        phone: emp.phone,
        email: emp.email,
        address: emp.address,
        department: emp.department,
        designation: emp.designation,
        joining_date: emp.joining_date,
        per_day_salary: emp.per_day_salary,
        monthly_salary: emp.monthly_salary,
        overtime_rate: emp.overtime_rate,
        status: emp.status,
        avatar_url: emp.avatar_url,
        present_days_month: stats?.present || 0,
        absent_days_month: stats?.absent || 0,
        leave_days_month: stats?.leave || 0,
        ot_hours_month: stats?.overtime || 0,
      };
    });

    return res.json({
      data: employeeList,
      page: pagination.page,
      limit: pagination.limit,
      total,
    });
  } catch (err: any) {
    console.error('Error fetching employees:', err);
    return res.status(500).json({ error: 'Failed to retrieve employee directory.' });
  }
});

// Create Employee
router.post('/employees', async (req: AuthRequest, res: Response) => {
  try {
    const {
      name, phone, email, address, department, designation,
      joining_date, per_day_salary, monthly_salary, overtime_rate,
      avatar_url, password
    } = req.body;

    if (
      typeof name !== 'string' ||
      typeof email !== 'string' ||
      typeof department !== 'string' ||
      typeof designation !== 'string' ||
      !name.trim() ||
      !email.trim() ||
      !department.trim() ||
      !designation.trim()
    ) {
      return res.status(400).json({ error: 'Name, email, department, and designation are required.' });
    }
    const pSalary = parsePositiveSalary(per_day_salary);
    if (pSalary === undefined) {
      return res.status(400).json({ error: 'Per-day salary must be a finite number greater than zero.' });
    }
    if (typeof password !== 'string' || password.length < 12) {
      return res.status(400).json({ error: 'A unique initial password of at least 12 characters is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const username = cleanEmail.split('@')[0].toLowerCase();
    const [existingEmployee, existingUserEmail, existingUsername] = await Promise.all([
      Employee.exists({ email: cleanEmail }),
      User.exists({ email: cleanEmail }),
      User.exists({ username }),
    ]);
    if (existingEmployee || existingUserEmail) {
      return res.status(409).json({ error: 'An employee or account with this email already exists.' });
    }
    if (existingUsername) {
      return res.status(409).json({ error: 'The username derived from this email is already in use.' });
    }

    // Auto-generate employee ID (EMP001, EMP002, ...)
    const count = await Employee.countDocuments();
    let newEmpId = `EMP${String(count + 1).padStart(3, '0')}`;
    let duplicateCheck = await Employee.findOne({ employee_id: newEmpId });
    let counter = count + 1;
    while (duplicateCheck) {
      counter++;
      newEmpId = `EMP${String(counter).padStart(3, '0')}`;
      duplicateCheck = await Employee.findOne({ employee_id: newEmpId });
    }

    const mSalary = parseFloat(monthly_salary) || (pSalary * 26);
    const otRate = parseFloat(overtime_rate) || 150;
    const jDate = joining_date || getBusinessDate();
    const defaultAvatar = avatar_url || `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80`;

    const employeeData = {
      employee_id: newEmpId,
      name: name.trim(),
      phone: phone || '',
      email: cleanEmail,
      address: address || '',
      department: department.trim(),
      designation: designation.trim(),
      joining_date: jDate,
      per_day_salary: pSalary,
      monthly_salary: mSalary,
      overtime_rate: otRate,
      status: 'active',
      avatar_url: defaultAvatar,
      created_at: new Date(),
    };
    const userData = {
      username,
      email: cleanEmail,
      password_hash: hashPassword(password),
      role: 'EMPLOYEE' as const,
      employee_id: newEmpId,
      status: 'active' as const,
      created_at: new Date(),
    };

    const session = await Employee.startSession();
    let newEmp: InstanceType<typeof Employee> | null = null;
    try {
      await session.withTransaction(async () => {
        const employee = new Employee(employeeData);
        const user = new User(userData);
        await employee.save({ session });
        await user.save({ session });
        newEmp = employee;
      });
    } finally {
      await session.endSession();
    }
    if (!newEmp) {
      throw new Error('Employee account transaction completed without creating records.');
    }

    await logAudit(
      req.user!.username,
      req.user!.name || 'Admin',
      'EMPLOYEE_ADDED',
      `Employee ${newEmpId} (${name})`,
      '',
      `Designation: ${designation}, Dept: ${department}, Monthly Salary: ₹${mSalary}`
    );

    return res.status(201).json({
      success: true,
      message: `Employee ${name} (${newEmpId}) registered successfully.`,
      employee: newEmp,
      employee_id: newEmpId,
    });
  } catch (err: any) {
    if (isDuplicateKeyError(err)) {
      return res.status(409).json({ error: 'An employee ID, email, or username already exists.' });
    }
    console.error('Error adding employee:', err);
    return res.status(500).json({ error: 'Failed to add employee.' });
  }
});

// Update Employee
router.put('/employees/:id', async (req: AuthRequest, res: Response) => {
  try {
    const empId = req.params.id.toUpperCase();
    const oldEmp = await Employee.findOne({ employee_id: empId });
    if (!oldEmp) {
      return res.status(404).json({ error: 'Employee not found.' });
    }
    if (oldEmp.is_active === false) {
      return res.status(409).json({ error: 'Archived employees cannot be edited.' });
    }

    const {
      name, phone, address, department, designation, joining_date,
      per_day_salary, monthly_salary, overtime_rate, status, avatar_url, password
    } = req.body;

    const pDay = per_day_salary !== undefined
      ? parsePositiveSalary(per_day_salary)
      : oldEmp.per_day_salary;
    if (pDay === undefined) {
      return res.status(400).json({ error: 'Per-day salary must be a finite number greater than zero.' });
    }
    if (status !== undefined && !['active', 'inactive'].includes(status)) {
      return res.status(400).json({ error: 'Employee status is invalid.' });
    }
    if (password !== undefined && password !== '' && (typeof password !== 'string' || password.length < 12)) {
      return res.status(400).json({ error: 'A reset password must be at least 12 characters long.' });
    }

    const previousStatus = oldEmp.status;
    const previousMonthlySalary = oldEmp.monthly_salary;
    const deactivatedAt = status === 'inactive' ? new Date() : undefined;
    const mSalary = monthly_salary !== undefined ? parseFloat(monthly_salary) : oldEmp.monthly_salary;
    const otRate = overtime_rate !== undefined ? parseFloat(overtime_rate) : oldEmp.overtime_rate;

    oldEmp.name = name || oldEmp.name;
    oldEmp.phone = phone !== undefined ? phone : oldEmp.phone;
    oldEmp.address = address !== undefined ? address : oldEmp.address;
    oldEmp.department = department || oldEmp.department;
    oldEmp.designation = designation || oldEmp.designation;
    oldEmp.joining_date = joining_date || oldEmp.joining_date;
    oldEmp.per_day_salary = pDay;
    oldEmp.monthly_salary = mSalary;
    oldEmp.overtime_rate = otRate;
    oldEmp.status = status || oldEmp.status;
    oldEmp.avatar_url = avatar_url || oldEmp.avatar_url;
    if (deactivatedAt) {
      oldEmp.is_active = false;
      oldEmp.archived_at = deactivatedAt;
      oldEmp.archived_by = req.user!.username;
    }

    // Update user status and password if provided
    const userUpdate: any = {};
    if (status) userUpdate.status = status;
    if (password !== undefined && password !== '') {
      userUpdate.password_hash = hashPassword(password);
    }

    const shouldRevokeEmployeeSessions = deactivatedAt !== undefined || (password !== undefined && password !== '');
    if (shouldRevokeEmployeeSessions) {
      const session = await Employee.startSession();
      try {
        await session.withTransaction(async () => {
          await oldEmp.save({ session });
          if (deactivatedAt) {
            const employeeUsers = await User.find({ employee_id: empId }).session(session);
            for (const user of employeeUsers) {
              user.set(userUpdate);
              await user.save({ session });
            }
            await Session.deleteMany({ employee_id: empId }, { session });
          } else {
            if (Object.keys(userUpdate).length > 0) {
              await User.updateMany({ employee_id: empId }, { $set: userUpdate }, { session });
            }
            await Session.deleteMany({ employee_id: empId }, { session });
          }
        });
      } finally {
        await session.endSession();
      }
    } else {
      await oldEmp.save();
      if (Object.keys(userUpdate).length > 0) {
        await User.updateMany({ employee_id: empId }, { $set: userUpdate });
      }
    }

    await logAudit(
      req.user!.username,
      req.user!.name || 'Admin',
      deactivatedAt ? 'EMPLOYEE_ARCHIVED' : 'EMPLOYEE_UPDATED',
      `Employee ${empId} (${oldEmp.name})`,
      `Status: ${previousStatus}, Salary: ₹${previousMonthlySalary}`,
      `Status: ${status || oldEmp.status}, Salary: ₹${mSalary}`
    );

    return res.json({
      success: true,
      message: deactivatedAt
        ? `Employee ${empId} archived successfully.`
        : `Employee ${empId} updated successfully.`,
      employee: oldEmp,
    });
  } catch (err: any) {
    console.error('Error updating employee:', err);
    return res.status(500).json({ error: 'Failed to update employee.' });
  }
});

// Archive Employee
router.delete('/employees/:id', async (req: AuthRequest, res: Response) => {
  try {
    const empId = req.params.id.toUpperCase();
    const emp = await Employee.findOne({ employee_id: empId });
    if (!emp) {
      return res.status(404).json({ error: 'Employee not found.' });
    }
    if (emp.is_active === false) {
      return res.status(409).json({ error: 'Employee is already archived.' });
    }

    const archivedAt = new Date();
    const archivedBy = req.user!.username;
    const session = await Employee.startSession();
    let archivedEmployee: typeof emp | null = null;
    try {
      await session.withTransaction(async () => {
        archivedEmployee = await Employee.findOneAndUpdate(
          { employee_id: empId, is_active: { $ne: false } },
          {
            $set: {
              status: 'inactive',
              is_active: false,
              archived_at: archivedAt,
              archived_by: archivedBy,
            },
          },
          { session, returnDocument: 'after', runValidators: true }
        );
        if (!archivedEmployee) {
          throw new EmployeeArchiveConflictError('Employee was archived by another request.');
        }

        const employeeUsers = await User.find({ employee_id: empId }).session(session);
        for (const user of employeeUsers) {
          user.status = 'inactive';
          await user.save({ session });
        }
        await Session.deleteMany({ employee_id: empId }, { session });
      });
    } catch (error) {
      if (error instanceof EmployeeArchiveConflictError) {
        return res.status(409).json({ error: error.message });
      }
      throw error;
    } finally {
      await session.endSession();
    }

    await logAudit(
      req.user!.username,
      req.user!.name || 'Admin',
      'EMPLOYEE_ARCHIVED',
      `Employee ${empId} (${emp.name})`,
      `Dept: ${emp.department}`,
      `Archived at ${archivedAt.toISOString()} by ${archivedBy}`
    );

    return res.json({ success: true, message: `Employee ${empId} (${emp.name}) archived successfully.` });
  } catch (err: any) {
    console.error('Error archiving employee:', err);
    return res.status(500).json({ error: 'Failed to delete employee.' });
  }
});

// ==========================================
// 3. DAILY ROSTER ATTENDANCE
// ==========================================

// Helper function to generate attendance roster for a specific date
async function getAttendanceRoster(targetDate: string) {
  const employees = await Employee.find({ status: 'active', is_active: { $ne: false } }).sort({ employee_id: 1 });
  const attendanceRecords = await Attendance.find({ date: targetDate });

  const attMap = new Map(attendanceRecords.map((r) => [r.employee_id, r]));

  const roster = employees.map((emp) => {
    const att = attMap.get(emp.employee_id);
    return {
      attendance_id: att?._id.toString() || null,
      employee_id: emp.employee_id,
      name: emp.name,
      department: emp.department,
      designation: emp.designation,
      avatar_url: emp.avatar_url,
      status: att ? att.status : 'Unmarked',
      working_hours: att ? att.working_hours : 0,
      overtime_hours: att ? att.overtime_hours : 0,
      notes: att?.notes || '',
    };
  });

  let presentCount = 0;
  let absentCount = 0;
  let leaveCount = 0;
  let halfDayCount = 0;

  roster.forEach((r) => {
    if (r.status === 'Present') presentCount++;
    else if (r.status === 'Absent') absentCount++;
    else if (r.status === 'Leave') leaveCount++;
    else if (r.status === 'Half Day') halfDayCount++;
  });

  return {
    date: targetDate,
    summary: {
      totalEmployees: roster.length,
      present: presentCount,
      absent: absentCount,
      leave: leaveCount,
      halfDay: halfDayCount,
    },
    roster,
  };
}

// 3a. Get Attendance Roster by query ?date=YYYY-MM-DD
router.get('/attendance/roster', async (req: AuthRequest, res: Response) => {
  try {
    const targetDate = String(req.query.date || getBusinessDate());
    const data = await getAttendanceRoster(targetDate);
    return res.json(data);
  } catch (err: any) {
    console.error('Error fetching attendance roster:', err);
    return res.status(500).json({ error: 'Failed to retrieve attendance roster.' });
  }
});

// 3b. Get Attendance Roster by path parameter /date/:date (alias)
router.get('/attendance/date/:date', async (req: AuthRequest, res: Response) => {
  try {
    const targetDate = req.params.date;
    const data = await getAttendanceRoster(targetDate);
    return res.json(data);
  } catch (err: any) {
    console.error('Error fetching attendance roster:', err);
    return res.status(500).json({ error: 'Failed to retrieve attendance roster.' });
  }
});

// 3c. Get Filtered Attendance History (supports date, month, year, employee_id, status)
router.get('/attendance', async (req: AuthRequest, res: Response) => {
  try {
    const { date, month, year, employee_id, status, start_date, end_date } = req.query;
    const pagination = parsePagination(
      req.query.page,
      req.query.limit,
      ATTENDANCE_PAGE_SIZE_DEFAULT,
      ATTENDANCE_PAGE_SIZE_MAX
    );
    if (!pagination) {
      return res.status(400).json({ error: 'Page and limit must be positive integers.' });
    }
    const filter: any = {};

    const hasDateRange = start_date !== undefined || end_date !== undefined;
    const hasMonthFilter = month !== undefined || year !== undefined;
    if (date !== undefined && (hasDateRange || hasMonthFilter)) {
      return res.status(400).json({ error: 'Use only one attendance date filter.' });
    }
    if (hasDateRange && hasMonthFilter) {
      return res.status(400).json({ error: 'Use either a date range or a month and year.' });
    }

    if (date !== undefined) {
      if (typeof date !== 'string' || !isValidAttendanceDate(date)) {
        return res.status(400).json({ error: 'Date must be a valid YYYY-MM-DD value.' });
      }
      filter.date = date;
    } else if (hasDateRange) {
      if (
        (start_date !== undefined &&
          (typeof start_date !== 'string' || !isValidAttendanceDate(start_date))) ||
        (end_date !== undefined &&
          (typeof end_date !== 'string' || !isValidAttendanceDate(end_date)))
      ) {
        return res.status(400).json({ error: 'Date range values must be valid YYYY-MM-DD dates.' });
      }
      if (typeof start_date === 'string' && typeof end_date === 'string' && start_date > end_date) {
        return res.status(400).json({ error: 'Start date must not be after end date.' });
      }
      filter.date = {};
      if (typeof start_date === 'string') filter.date.$gte = start_date;
      if (typeof end_date === 'string') filter.date.$lte = end_date;
    } else if (hasMonthFilter) {
      if (
        typeof month !== 'string' ||
        !/^\d{1,2}$/.test(month) ||
        Number(month) < 1 ||
        Number(month) > 12 ||
        typeof year !== 'string' ||
        !/^\d{4}$/.test(year)
      ) {
        return res.status(400).json({ error: 'Month and year must be valid numeric values.' });
      }
      const monthNumber = Number(month);
      const monthPrefix = `${year}-${String(monthNumber).padStart(2, '0')}`;
      filter.date = {
        $gte: `${monthPrefix}-01`,
        $lte: `${monthPrefix}-31`,
      };
    }

    if (employee_id !== undefined && employee_id !== 'All') {
      if (typeof employee_id !== 'string' || employee_id.trim() === '') {
        return res.status(400).json({ error: 'Employee ID must be a non-empty string.' });
      }
      filter.employee_id = employee_id.toUpperCase();
    }

    if (status && status !== 'All') {
      filter.status = status;
    }

    const [records, total] = await Promise.all([
      Attendance.find(filter)
        .sort({ date: -1, employee_id: 1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      Attendance.countDocuments(filter),
    ]);
    const employees = await Employee.find({
      employee_id: { $in: records.map((record) => record.employee_id) },
    }).lean();
    const empMap = new Map(employees.map((e) => [e.employee_id, e]));

    const enriched = records.map((r) => {
      const emp = empMap.get(r.employee_id);
      const dayName = isValidAttendanceDate(r.date) ? getWeekdayAbbreviation(r.date) : '';
      return {
        attendance_id: r._id.toString(),
        employee_id: r.employee_id,
        employee_name: emp?.name || r.employee_id,
        department: emp?.department || '',
        designation: emp?.designation || '',
        avatar_url: emp?.avatar_url || '',
        date: r.date,
        day: dayName,
        status: r.status,
        working_hours: r.working_hours,
        overtime_hours: r.overtime_hours,
        notes: r.notes || '',
        created_by: r.created_by,
        updated_by: r.updated_by,
        updated_at: r.updated_at ? r.updated_at.toISOString() : undefined,
      };
    });

    return res.json({
      data: enriched,
      page: pagination.page,
      limit: pagination.limit,
      total,
    });
  } catch (err: any) {
    console.error('Error fetching attendance list:', err);
    return res.status(500).json({ error: 'Failed to retrieve attendance records.' });
  }
});

// Helper for saving batch attendance
const attendanceStatuses = ['Present', 'Absent', 'Leave', 'Half Day'] as const;
type AttendanceStatus = (typeof attendanceStatuses)[number];
type ValidAttendanceRecord = {
  employee_id: string;
  status: AttendanceStatus;
  working_hours: number;
  overtime_hours: number;
  notes: string;
};
type AttendanceValidationResult =
  | { record: ValidAttendanceRecord; error?: never }
  | { error: string; record?: never };

function isValidAttendanceDate(date: unknown): date is string {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

function parseAttendanceHours(value: unknown, fallback: number): number | undefined {
  if (value === undefined) return fallback;
  if (
    (typeof value !== 'number' && typeof value !== 'string') ||
    (typeof value === 'string' && value.trim() === '')
  ) {
    return undefined;
  }
  const hours = Number(value);
  return Number.isFinite(hours) ? hours : undefined;
}

function validateAttendanceInput(input: unknown, date: unknown): AttendanceValidationResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { error: 'Each attendance record must be an object.' };
  }
  const recordInput = input as Record<string, unknown>;
  if (typeof recordInput.employee_id !== 'string' || !recordInput.employee_id.trim()) {
    return { error: 'Employee ID is required.' };
  }
  if (!isValidAttendanceDate(date)) {
    return { error: 'Date must be a valid YYYY-MM-DD date.' };
  }
  const status = attendanceStatuses.find((validStatus) => validStatus === recordInput.status);
  if (!status) {
    return { error: 'Attendance status is invalid.' };
  }

  const workingHours = parseAttendanceHours(recordInput.working_hours, 8);
  const overtimeHours = parseAttendanceHours(recordInput.overtime_hours, 0);
  if (workingHours === undefined || workingHours < 0 || workingHours > 16) {
    return { error: 'Working hours must be a finite number from 0 to 16.' };
  }
  if (overtimeHours === undefined || overtimeHours < 0 || overtimeHours > 2) {
    return { error: 'Overtime hours must be a finite number from 0 to 2.' };
  }
  if (recordInput.notes !== undefined && typeof recordInput.notes !== 'string') {
    return { error: 'Attendance notes must be a string.' };
  }

  return {
    record: {
      employee_id: recordInput.employee_id.trim().toUpperCase(),
      status,
      working_hours: workingHours,
      overtime_hours: overtimeHours,
      notes: typeof recordInput.notes === 'string' ? recordInput.notes : '',
    },
  };
}

async function handleBatchAttendance(req: AuthRequest, res: Response) {
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ error: 'Request body must be an object.' });
    }
    const { date, records } = req.body;
    if (!isValidAttendanceDate(date) || !Array.isArray(records)) {
      return res.status(400).json({ error: 'A valid YYYY-MM-DD date and records array are required.' });
    }

    const validatedRecords: ValidAttendanceRecord[] = [];
    for (const item of records) {
      const validated = validateAttendanceInput(item, date);
      if ('error' in validated) return res.status(400).json({ error: validated.error });
      validatedRecords.push(validated.record);
    }

    const employeeIds = [...new Set(validatedRecords.map((record) => record.employee_id))];
    const employees = await Employee.find({ employee_id: { $in: employeeIds } })
      .select({ employee_id: 1 })
      .lean();
    const existingEmployeeIds = new Set(employees.map((employee) => employee.employee_id));
    const missingEmployeeId = employeeIds.find((employeeId) => !existingEmployeeIds.has(employeeId));
    if (missingEmployeeId) {
      return res.status(400).json({ error: `Employee ${missingEmployeeId} does not exist.` });
    }

    const adminName = req.user!.name || req.user!.username || 'Admin';

    for (const record of validatedRecords) {
      await Attendance.findOneAndUpdate(
        { employee_id: record.employee_id, date },
        {
          $set: {
            status: record.status,
            working_hours: record.working_hours,
            overtime_hours: record.overtime_hours,
            notes: record.notes,
            updated_by: adminName,
            updated_at: new Date(),
          },
          $setOnInsert: {
            created_by: adminName,
            created_at: new Date(),
          },
        },
        { upsert: true, returnDocument: 'after', runValidators: true }
      );
    }

    await logAudit(
      req.user!.username,
      adminName,
      'ATTENDANCE_BULK_LOGGED',
      `Date: ${date}`,
      '',
      `Updated attendance roster for ${validatedRecords.length} employees`
    );

    return res.json({ success: true, message: `Attendance for ${validatedRecords.length} employees saved for ${date}.` });
  } catch (err: any) {
    console.error('Bulk attendance error:', err);
    return res.status(500).json({ error: 'Failed to save bulk attendance.' });
  }
}

// 3d. Bulk/Batch Attendance Update (supports both /attendance/batch and /attendance/bulk)
router.post('/attendance/batch', handleBatchAttendance);
router.post('/attendance/bulk', handleBatchAttendance);

// Helper for saving single attendance
async function handleSingleAttendance(req: AuthRequest, res: Response) {
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ error: 'Request body must be an object.' });
    }
    const { employee_id, date, status, working_hours, overtime_hours, notes } = req.body;

    const validated = validateAttendanceInput(
      { employee_id, status, working_hours, overtime_hours, notes },
      date
    );
    if ('error' in validated) {
      return res.status(400).json({ error: validated.error });
    }

    const employeeExists = await Employee.exists({ employee_id: validated.record.employee_id });
    if (!employeeExists) {
      return res.status(400).json({ error: 'Employee does not exist.' });
    }

    const adminName = req.user!.name || req.user!.username || 'Admin';

    await Attendance.findOneAndUpdate(
      { employee_id: validated.record.employee_id, date },
      {
        $set: {
          status: validated.record.status,
          working_hours: validated.record.working_hours,
          overtime_hours: validated.record.overtime_hours,
          notes: validated.record.notes,
          updated_by: adminName,
          updated_at: new Date(),
        },
        $setOnInsert: {
          created_by: adminName,
          created_at: new Date(),
        },
      },
      { upsert: true, returnDocument: 'after', runValidators: true }
    );

    return res.json({ success: true, message: `Attendance updated for ${employee_id} on ${date}.` });
  } catch (err: any) {
    console.error('Single attendance error:', err);
    return res.status(500).json({ error: 'Failed to update attendance record.' });
  }
}

// 3e. Single Attendance Update (supports both /attendance and /attendance/single)
router.post('/attendance', handleSingleAttendance);
router.post('/attendance/single', handleSingleAttendance);

// 3f. Delete Attendance Record
router.delete('/attendance/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await Attendance.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Attendance record not found.' });
    }

    await logAudit(
      req.user!.username,
      req.user!.name || 'Admin',
      'ATTENDANCE_DELETED',
      `Attendance #${id} (${deleted.employee_id})`,
      `Date: ${deleted.date}, Status: ${deleted.status}`,
      'Record deleted'
    );

    return res.json({ success: true, message: 'Attendance record deleted successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete attendance record.' });
  }
});

// ==========================================
// 4. PAYROLL MANAGEMENT & SALARY PROCESSING
// ==========================================
router.get('/payroll', async (req: AuthRequest, res: Response) => {
  try {
    const { month, year, status } = req.query;
    const businessDate = getBusinessDateParts();
    const qMonth = month ? parseInt(String(month), 10) : businessDate.month;
    const qYear = year ? parseInt(String(year), 10) : businessDate.year;

    const query: any = { month: qMonth, year: qYear };
    if (status && status !== 'All') {
      query.status = status;
    }

    const payrollRecords = await Payroll.find(query).sort({ employee_id: 1 });
    const employees = await Employee.find();
    const empMap = new Map(employees.map((e) => [e.employee_id, e]));

    const enriched = payrollRecords.map((p) => {
      const emp = empMap.get(p.employee_id);
      return {
        payroll_id: p._id.toString(),
        employee_id: p.employee_id,
        employee_name: emp?.name || p.employee_id,
        department: emp?.department || '',
        designation: emp?.designation || '',
        email: emp?.email || '',
        avatar_url: emp?.avatar_url || '',
        month: p.month,
        year: p.year,
        working_days: p.working_days,
        present_days: p.present_days,
        absent_days: p.absent_days,
        leave_days: p.leave_days,
        half_days: p.half_days,
        overtime_hours: p.overtime_hours,
        extra_working_days: p.extra_working_days,
        per_day_salary: p.per_day_salary,
        basic_salary: p.basic_salary,
        extra_day_salary: p.extra_day_salary,
        overtime_salary: p.overtime_salary,
        bonus: p.bonus,
        deductions: p.deductions,
        net_salary: p.net_salary,
        status: p.status,
        generated_by: p.generated_by,
        created_at: p.created_at.toISOString(),
      };
    });

    let totalPayroll = 0;
    let totalPaid = 0;
    enriched.forEach((p) => {
      totalPayroll += p.net_salary;
      if (p.status === 'Paid') totalPaid += p.net_salary;
    });

    return res.json({
      month: qMonth,
      year: qYear,
      summary: {
        totalProcessed: enriched.length,
        totalNetSalary: totalPayroll,
        totalPaidSalary: totalPaid,
        pendingSalary: totalPayroll - totalPaid,
      },
      payroll: enriched,
    });
  } catch (err: any) {
    console.error('Payroll fetch error:', err);
    return res.status(500).json({ error: 'Failed to retrieve payroll records.' });
  }
});

// Generate / Calculate Payroll
router.post('/payroll/generate', async (req: AuthRequest, res: Response) => {
  try {
    const { month, year, employee_id } = req.body;
    const businessDate = getBusinessDateParts();
    const qMonth = month ? parseInt(String(month), 10) : businessDate.month;
    const qYear = year ? parseInt(String(year), 10) : businessDate.year;

    const stdSetting = await Setting.findOne({ key: 'standard_working_days' });
    const standardWorkingDays = stdSetting ? parseFloat(stdSetting.value) : 26;

    const leavePaidSetting = await Setting.findOne({ key: 'leave_is_paid' });
    const leaveIsPaid = leavePaidSetting?.value === 'true';

    const empQuery: any = { status: 'active' };
    if (employee_id && employee_id !== 'All') {
      empQuery.employee_id = employee_id;
    }
    const employees = await Employee.find(empQuery);

    const employeeIds = employees.map((employee) => employee.employee_id);
    const lockedPayroll = await Payroll.exists({
      employee_id: { $in: employeeIds },
      month: qMonth,
      year: qYear,
      status: { $in: ['Finalized', 'Paid'] },
    });
    if (lockedPayroll) {
      return res.status(409).json({ error: 'Finalized or paid payroll cannot be recalculated.' });
    }

    const monthPrefix = `${qYear}-${String(qMonth).padStart(2, '0')}`;
    const allAtt = await Attendance.find({ date: new RegExp(`^${monthPrefix}`) });

    const attMap: Record<string, { present: number; absent: number; leave: number; halfDay: number; ot: number }> = {};
    for (const r of allAtt) {
      if (!attMap[r.employee_id]) {
        attMap[r.employee_id] = { present: 0, absent: 0, leave: 0, halfDay: 0, ot: 0 };
      }
      if (r.status === 'Present') attMap[r.employee_id].present++;
      else if (r.status === 'Absent') attMap[r.employee_id].absent++;
      else if (r.status === 'Leave') attMap[r.employee_id].leave++;
      else if (r.status === 'Half Day') attMap[r.employee_id].halfDay++;
      attMap[r.employee_id].ot += r.overtime_hours || 0;
    }

    const adminName = req.user!.name || req.user!.username || 'Admin';
    let processedCount = 0;

    for (const emp of employees) {
      const payrollKey = { employee_id: emp.employee_id, month: qMonth, year: qYear };
      const existing = await Payroll.findOne(payrollKey).select({ status: 1 }).lean();
      if (existing && existing.status !== 'Draft') {
        return res.status(409).json({ error: 'Payroll changed while being generated. Refresh and retry.' });
      }

      const stats = attMap[emp.employee_id] || { present: 0, absent: 0, leave: 0, halfDay: 0, ot: 0 };
      const paidLeaveDays = leaveIsPaid ? stats.leave : 0;
      const actualPaidDays = stats.present + (stats.halfDay * 0.5) + paidLeaveDays;

      const baseDaysForBasic = Math.min(actualPaidDays, standardWorkingDays);
      const basicSalary = Math.round(baseDaysForBasic * emp.per_day_salary);

      const extraWorkingDays = Math.max(0, actualPaidDays - standardWorkingDays);
      const extraDaySalary = Math.round(extraWorkingDays * emp.per_day_salary);
      const overtimeSalary = Math.round(stats.ot * emp.overtime_rate);
      const bonus = 0;
      const deductions = 0;
      const netSalary = basicSalary + extraDaySalary + overtimeSalary + bonus - deductions;

      const payrollValues = {
        working_days: standardWorkingDays,
        present_days: stats.present,
        absent_days: stats.absent,
        leave_days: stats.leave,
        half_days: stats.halfDay,
        overtime_hours: stats.ot,
        extra_working_days: extraWorkingDays,
        per_day_salary: emp.per_day_salary,
        basic_salary: basicSalary,
        extra_day_salary: extraDaySalary,
        overtime_salary: overtimeSalary,
        bonus,
        deductions,
        net_salary: netSalary,
        status: 'Finalized' as const,
        generated_by: adminName,
      };

      if (existing) {
        const updated = await Payroll.findOneAndUpdate(
          { ...payrollKey, status: 'Draft' },
          { $set: payrollValues },
          { returnDocument: 'after', runValidators: true }
        );
        if (!updated) {
          return res.status(409).json({ error: 'Payroll changed while being generated. Refresh and retry.' });
        }
      } else {
        try {
          await Payroll.create({ ...payrollKey, ...payrollValues });
        } catch (error) {
          if (!isDuplicateKeyError(error) || !(await Payroll.exists(payrollKey))) {
            throw error;
          }
          return res.status(409).json({ error: 'Payroll changed while being generated. Refresh and retry.' });
        }
      }
      processedCount++;
    }

    await logAudit(
      req.user!.username,
      adminName,
      'PAYROLL_GENERATED',
      `Period: ${qMonth}/${qYear}`,
      '',
      `Generated payroll disbursements for ${processedCount} employees`
    );

    return res.json({
      success: true,
      message: `Payroll for ${processedCount} employees calculated successfully for ${qMonth}/${qYear}.`,
      processedCount,
    });
  } catch (err: any) {
    console.error('Payroll generation error:', err);
    return res.status(500).json({ error: 'Failed to generate payroll.' });
  }
});

// Update Payroll Status (Draft, Finalized, Paid)
router.put('/payroll/status', async (req: AuthRequest, res: Response) => {
  try {
    const { payroll_id, status } = req.body;
    if (!payroll_id || !status) {
      return res.status(400).json({ error: 'Payroll ID and status are required.' });
    }

    if (!['Draft', 'Finalized', 'Paid'].includes(status)) {
      return res.status(400).json({ error: 'Payroll status is invalid.' });
    }

    const payroll = await Payroll.findById(payroll_id);
    if (!payroll) {
      return res.status(404).json({ error: 'Payroll record not found.' });
    }

    const allowedTransition =
      (payroll.status === 'Draft' && status === 'Finalized') ||
      (payroll.status === 'Finalized' && status === 'Paid');
    if (!allowedTransition) {
      return res.status(409).json({ error: 'Payroll status cannot be changed from its current state.' });
    }

    const updated = await Payroll.findOneAndUpdate(
      { _id: payroll_id, status: payroll.status },
      { $set: { status } },
      { returnDocument: 'after', runValidators: true }
    );
    if (!updated) {
      return res.status(409).json({ error: 'Payroll status changed. Refresh and retry.' });
    }

    await logAudit(
      req.user!.username,
      req.user!.name || 'Admin',
      'PAYROLL_STATUS_CHANGED',
      `Payroll #${payroll_id} (${updated.employee_id})`,
      '',
      `Status updated to: ${status}`
    );

    return res.json({ success: true, message: `Payroll status updated to ${status}.` });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update payroll status.' });
  }
});

// Finalize All Payroll Records for a month/year
router.post('/payroll/finalize-all', async (req: AuthRequest, res: Response) => {
  try {
    const { month, year } = req.body;
    const businessDate = getBusinessDateParts();
    const qMonth = month ? parseInt(String(month), 10) : businessDate.month;
    const qYear = year ? parseInt(String(year), 10) : businessDate.year;

    const result = await Payroll.updateMany(
      { month: qMonth, year: qYear, status: 'Draft' },
      { $set: { status: 'Finalized' } }
    );

    await logAudit(
      req.user!.username,
      req.user!.name || 'Admin',
      'PAYROLL_FINALIZED_ALL',
      `Period: ${qMonth}/${qYear}`,
      '',
      `Finalized ${result.modifiedCount} payroll records for ${qMonth}/${qYear}`
    );

    return res.json({
      success: true,
      message: `Successfully finalized ${result.modifiedCount} payroll records for ${qMonth}/${qYear}.`,
      modifiedCount: result.modifiedCount,
    });
  } catch (err: any) {
    console.error('Finalize all payroll error:', err);
    return res.status(500).json({ error: 'Failed to finalize payroll records.' });
  }
});

// Edit Payroll Record (bonus, deductions, status adjustment)
router.put('/payroll/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { bonus, deductions, status } = req.body;

    const record = await Payroll.findById(id);
    if (!record) {
      return res.status(404).json({ error: 'Payroll record not found.' });
    }
    if (record.status !== 'Draft') {
      return res.status(409).json({ error: 'Finalized or paid payroll cannot be edited.' });
    }

    const newBonus = bonus !== undefined ? Math.max(0, parseFloat(bonus) || 0) : record.bonus;
    const newDeductions = deductions !== undefined ? Math.max(0, parseFloat(deductions) || 0) : record.deductions;
    const newStatus = status === undefined ? record.status : status;
    if (!['Draft', 'Finalized', 'Paid'].includes(newStatus)) {
      return res.status(400).json({ error: 'Payroll status is invalid.' });
    }
    if (newStatus === 'Paid') {
      return res.status(409).json({ error: 'Payroll must be finalized before it can be marked paid.' });
    }
    const newNetSalary = Math.max(
      0,
      record.basic_salary + record.extra_day_salary + record.overtime_salary + newBonus - newDeductions
    );

    const updated = await Payroll.findOneAndUpdate(
      { _id: id, status: 'Draft' },
      {
        $set: {
          bonus: newBonus,
          deductions: newDeductions,
          net_salary: newNetSalary,
          status: newStatus,
        },
      },
      { returnDocument: 'after', runValidators: true }
    );
    if (!updated) {
      return res.status(409).json({ error: 'Payroll status changed. Refresh and retry.' });
    }

    await logAudit(
      req.user!.username,
      req.user!.name || 'Admin',
      'PAYROLL_EDITED',
      `Payroll #${id} (${updated.employee_id})`,
      `Bonus: ₹${record.bonus}, Deductions: ₹${record.deductions}, Net: ₹${record.net_salary}, Status: ${record.status}`,
      `Bonus: ₹${newBonus}, Deductions: ₹${newDeductions}, Net: ₹${newNetSalary}, Status: ${updated.status}`
    );

    return res.json({
      success: true,
      message: `Payroll for ${updated.employee_id} updated successfully.`,
      payroll: updated,
    });
  } catch (err: any) {
    console.error('Update payroll error:', err);
    return res.status(500).json({ error: 'Failed to update payroll record.' });
  }
});

// ==========================================
// 5. EXECUTIVE REPORTS
// ==========================================
router.get('/reports', async (req: AuthRequest, res: Response) => {
  try {
    const { type, month, year, department } = req.query;
    const businessDate = getBusinessDateParts();
    const qMonth = month ? parseInt(String(month), 10) : businessDate.month;
    const qYear = year ? parseInt(String(year), 10) : businessDate.year;
    const monthPrefix = `${qYear}-${String(qMonth).padStart(2, '0')}`;

    const empFilter: any = {};
    if (department && department !== 'All') {
      empFilter.department = department;
    }
    const employees = await Employee.find(empFilter);
    const empIds = employees.map((e) => e.employee_id);
    const empMap = new Map(employees.map((e) => [e.employee_id, e]));

    let reportRows: any[] = [];
    let summary: any = {};

    if (type === 'attendance') {
      const attRecords = await Attendance.find({
        employee_id: { $in: empIds },
        date: new RegExp(`^${monthPrefix}`),
      });

      const statsMap: Record<string, { present: number; absent: number; leave: number; halfDay: number; ot: number }> = {};
      for (const r of attRecords) {
        if (!statsMap[r.employee_id]) {
          statsMap[r.employee_id] = { present: 0, absent: 0, leave: 0, halfDay: 0, ot: 0 };
        }
        if (r.status === 'Present') statsMap[r.employee_id].present++;
        else if (r.status === 'Absent') statsMap[r.employee_id].absent++;
        else if (r.status === 'Leave') statsMap[r.employee_id].leave++;
        else if (r.status === 'Half Day') statsMap[r.employee_id].halfDay++;
        statsMap[r.employee_id].ot += r.overtime_hours || 0;
      }

      let totalPresent = 0;
      let totalAbsent = 0;
      let totalLeave = 0;
      let totalOt = 0;

      reportRows = employees.map((emp) => {
        const s = statsMap[emp.employee_id] || { present: 0, absent: 0, leave: 0, halfDay: 0, ot: 0 };
        totalPresent += s.present;
        totalAbsent += s.absent;
        totalLeave += s.leave;
        totalOt += s.ot;
        return {
          employee_id: emp.employee_id,
          name: emp.name,
          department: emp.department,
          designation: emp.designation,
          present_days: s.present,
          absent_days: s.absent,
          leave_days: s.leave,
          half_days: s.halfDay,
          overtime_hours: s.ot,
        };
      });

      summary = {
        total_employees: employees.length,
        total_present_days: totalPresent,
        total_absent_days: totalAbsent,
        total_leave_days: totalLeave,
        total_overtime_hours: totalOt,
      };
    } else if (type === 'salary') {
      const payrollRecs = await Payroll.find({
        employee_id: { $in: empIds },
        month: qMonth,
        year: qYear,
      });

      let totalBasic = 0;
      let totalOtSalary = 0;
      let totalNet = 0;

      reportRows = payrollRecs.map((p) => {
        const emp = empMap.get(p.employee_id);
        totalBasic += p.basic_salary;
        totalOtSalary += p.overtime_salary;
        totalNet += p.net_salary;
        return {
          employee_id: p.employee_id,
          name: emp?.name || p.employee_id,
          department: emp?.department || '',
          per_day_salary: p.per_day_salary,
          basic_salary: p.basic_salary,
          extra_day_salary: p.extra_day_salary,
          overtime_salary: p.overtime_salary,
          bonus: p.bonus,
          deductions: p.deductions,
          net_salary: p.net_salary,
          status: p.status,
        };
      });

      summary = {
        total_employees: reportRows.length,
        total_basic_salary: totalBasic,
        total_overtime_salary: totalOtSalary,
        total_net_payroll: totalNet,
      };
    } else if (type === 'overtime') {
      const attRecords = await Attendance.find({
        employee_id: { $in: empIds },
        date: new RegExp(`^${monthPrefix}`),
        overtime_hours: { $gt: 0 },
      });

      const otMap: Record<string, number> = {};
      for (const r of attRecords) {
        otMap[r.employee_id] = (otMap[r.employee_id] || 0) + (r.overtime_hours || 0);
      }

      let totalOtHours = 0;
      let totalOtCost = 0;

      reportRows = Object.keys(otMap).map((id) => {
        const emp = empMap.get(id);
        const hours = otMap[id];
        const cost = Math.round(hours * (emp?.overtime_rate || 150));
        totalOtHours += hours;
        totalOtCost += cost;
        return {
          employee_id: id,
          name: emp?.name || id,
          department: emp?.department || '',
          designation: emp?.designation || '',
          overtime_rate: emp?.overtime_rate || 150,
          total_overtime_hours: hours,
          total_overtime_cost: cost,
        };
      });

      summary = {
        staff_with_overtime: reportRows.length,
        total_overtime_hours: totalOtHours,
        total_overtime_expenditure: totalOtCost,
      };
    }

    return res.json({
      type,
      month: qMonth,
      year: qYear,
      data: reportRows,
      summary,
    });
  } catch (err: any) {
    console.error('Report generation error:', err);
    return res.status(500).json({ error: 'Failed to generate report.' });
  }
});

// ==========================================
// 6. SYSTEM SETTINGS
// ==========================================
router.get('/settings', async (req: AuthRequest, res: Response) => {
  try {
    const settings = await Setting.find();
    const map: Record<string, string> = {};
    settings.forEach((s) => {
      map[s.key] = s.value;
    });
    return res.json({ settings: map });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve settings.' });
  }
});

router.post('/settings', async (req: AuthRequest, res: Response) => {
  try {
    const rawPayload = req.body;
    if (!rawPayload || typeof rawPayload !== 'object') {
      return res.status(400).json({ error: 'Invalid settings payload.' });
    }

    // Support both direct key-value map and nested { settings: { ... } } wrapper
    const settingsMap = rawPayload.settings && typeof rawPayload.settings === 'object'
      ? rawPayload.settings
      : rawPayload;

    let updatedCount = 0;
    for (const [key, val] of Object.entries(settingsMap)) {
      if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
        await Setting.findOneAndUpdate(
          { key },
          { $set: { value: String(val) } },
          { upsert: true }
        );
        updatedCount++;
      }
    }

    await logAudit(
      req.user!.username,
      req.user!.name || 'Admin',
      'STORE_SETTINGS_UPDATED',
      'System Settings',
      '',
      `Updated ${updatedCount} store configuration keys`
    );

    return res.json({ success: true, message: 'Settings saved successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to save settings.' });
  }
});

// ==========================================
// 7. SECURITY & AUDIT LOGS
// ==========================================
router.get('/audit-logs', async (req: AuthRequest, res: Response) => {
  try {
    const logs = await AuditLog.find().sort({ timestamp: -1 }).limit(100);
    return res.json({
      logs: logs.map((l) => ({
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
    return res.status(500).json({ error: 'Failed to retrieve audit logs.' });
  }
});

export default router;
