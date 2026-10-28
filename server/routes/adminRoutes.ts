import { Router, Response } from 'express';
import {
  Employee,
  Attendance,
  Payroll,
  Setting,
  AuditLog,
  User,
  logAudit,
  hashPassword,
} from '../db.ts';
import { authenticateToken, requireAdmin, AuthRequest } from '../auth.ts';

const router = Router();

// Apply auth + strict admin check to all routes in this router
router.use(authenticateToken);
router.use(requireAdmin);

// ==========================================
// 1. ADMIN DASHBOARD
// ==========================================
router.get('/dashboard', async (req: AuthRequest, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
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
    const monthRecords = await Attendance.find({
      date: new RegExp(`^${monthPrefix}`),
    });

    let totalOvertimeHours = 0;
    const recordedDates = new Set<string>();
    for (const rec of monthRecords) {
      totalOvertimeHours += rec.overtime_hours || 0;
      recordedDates.add(rec.date);
    }

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
    const dailyAttendance = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });

      const dayRecs = await Attendance.find({ date: dateStr });
      let p = 0, a = 0, l = 0, h = 0;
      for (const r of dayRecs) {
        if (r.status === 'Present') p++;
        else if (r.status === 'Absent') a++;
        else if (r.status === 'Leave') l++;
        else if (r.status === 'Half Day') h++;
      }

      dailyAttendance.push({
        date: dateStr,
        day: dayName,
        present: p,
        absent: a,
        leave: l,
        halfDay: h,
      });
    }

    // Monthly Comparison Chart (last 6 months)
    const monthlyComparison = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();
      const mStr = `${y}-${String(m).padStart(2, '0')}`;

      const mRecs = await Attendance.find({ date: new RegExp(`^${mStr}`) });
      let mPresent = 0;
      let mTotal = 0;
      let mOt = 0;
      for (const r of mRecs) {
        mTotal++;
        mOt += r.overtime_hours || 0;
        if (r.status === 'Present') mPresent += 1;
        else if (r.status === 'Half Day') mPresent += 0.5;
      }

      const presentRate = mTotal > 0 ? Math.round((mPresent / mTotal) * 100) : 0;
      monthlyComparison.push({
        month: `${monthNames[m - 1]} ${y}`,
        presentRate,
        totalOt: Math.round(mOt),
      });
    }

    // Overtime by department
    const activeStaff = await Employee.find({ status: 'active' });
    const deptMap: Record<string, { count: number; ot: number }> = {};
    for (const emp of activeStaff) {
      if (!deptMap[emp.department]) {
        deptMap[emp.department] = { count: 0, ot: 0 };
      }
      deptMap[emp.department].count++;
    }

    for (const rec of monthRecords) {
      const emp = activeStaff.find((e) => e.employee_id === rec.employee_id);
      if (emp && deptMap[emp.department]) {
        deptMap[emp.department].ot += rec.overtime_hours || 0;
      }
    }

    const overtimeByDept = Object.keys(deptMap).map((dept) => ({
      department: dept,
      employees_count: deptMap[dept].count,
      ot_hours: Math.round(deptMap[dept].ot),
    }));

    // Recent 5 attendance records
    const recentAtt = await Attendance.find().sort({ created_at: -1 }).limit(5);
    const recentAttendance = [];
    for (const r of recentAtt) {
      const emp = await Employee.findOne({ employee_id: r.employee_id });
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
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const monthPrefix = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

    const employees = await Employee.find().sort({ employee_id: 1 });
    const monthAtt = await Attendance.find({ date: new RegExp(`^${monthPrefix}`) });

    // Aggregate monthly attendance per employee
    const statsMap: Record<string, { present: number; absent: number; leave: number; halfDay: number; ot: number }> = {};
    for (const r of monthAtt) {
      if (!statsMap[r.employee_id]) {
        statsMap[r.employee_id] = { present: 0, absent: 0, leave: 0, halfDay: 0, ot: 0 };
      }
      if (r.status === 'Present') statsMap[r.employee_id].present++;
      else if (r.status === 'Absent') statsMap[r.employee_id].absent++;
      else if (r.status === 'Leave') statsMap[r.employee_id].leave++;
      else if (r.status === 'Half Day') statsMap[r.employee_id].halfDay++;
      statsMap[r.employee_id].ot += r.overtime_hours || 0;
    }

    const employeeList = employees.map((emp) => {
      const stats = statsMap[emp.employee_id] || { present: 0, absent: 0, leave: 0, halfDay: 0, ot: 0 };
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
        present_days_month: stats.present,
        absent_days_month: stats.absent,
        leave_days_month: stats.leave,
        ot_hours_month: stats.ot,
      };
    });

    return res.json({ employees: employeeList });
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

    if (!name || !email || !department || !designation) {
      return res.status(400).json({ error: 'Name, email, department, and designation are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check unique email
    const existingEmp = await Employee.findOne({ email: cleanEmail });
    if (existingEmp) {
      return res.status(400).json({ error: 'An employee with this email already exists.' });
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

    const pSalary = parseFloat(per_day_salary) || 800;
    const mSalary = parseFloat(monthly_salary) || (pSalary * 26);
    const otRate = parseFloat(overtime_rate) || 150;
    const jDate = joining_date || new Date().toISOString().split('T')[0];
    const defaultAvatar = avatar_url || `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80`;

    const newEmp = await Employee.create({
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
    });

    // Create user login account for employee
    const username = cleanEmail.split('@')[0].toLowerCase();
    const userPass = password || `${username}123`;
    const passwordHash = hashPassword(userPass);

    const existingUser = await User.findOne({ username });
    const finalUsername = existingUser ? `${username}_${newEmpId.toLowerCase()}` : username;

    await User.create({
      username: finalUsername,
      email: cleanEmail,
      password_hash: passwordHash,
      role: 'EMPLOYEE',
      employee_id: newEmpId,
      status: 'active',
      created_at: new Date(),
    });

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

    const {
      name, phone, address, department, designation, joining_date,
      per_day_salary, monthly_salary, overtime_rate, status, avatar_url, password
    } = req.body;

    const pDay = per_day_salary !== undefined ? parseFloat(per_day_salary) : oldEmp.per_day_salary;
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

    await oldEmp.save();

    // Update user status and password if provided
    const userUpdate: any = {};
    if (status) userUpdate.status = status;
    if (password && password.trim().length >= 4) {
      userUpdate.password_hash = hashPassword(password.trim());
    }
    if (Object.keys(userUpdate).length > 0) {
      await User.updateOne({ employee_id: empId }, { $set: userUpdate });
    }

    await logAudit(
      req.user!.username,
      req.user!.name || 'Admin',
      'EMPLOYEE_UPDATED',
      `Employee ${empId} (${oldEmp.name})`,
      `Status: ${oldEmp.status}, Salary: ₹${oldEmp.monthly_salary}`,
      `Status: ${status || oldEmp.status}, Salary: ₹${mSalary}`
    );

    return res.json({ success: true, message: `Employee ${empId} updated successfully.`, employee: oldEmp });
  } catch (err: any) {
    console.error('Error updating employee:', err);
    return res.status(500).json({ error: 'Failed to update employee.' });
  }
});

// Delete Employee
router.delete('/employees/:id', async (req: AuthRequest, res: Response) => {
  try {
    const empId = req.params.id.toUpperCase();
    const emp = await Employee.findOne({ employee_id: empId });
    if (!emp) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    await Employee.deleteOne({ employee_id: empId });
    await User.deleteOne({ employee_id: empId });
    await Attendance.deleteMany({ employee_id: empId });
    await Payroll.deleteMany({ employee_id: empId });

    await logAudit(
      req.user!.username,
      req.user!.name || 'Admin',
      'EMPLOYEE_DELETED',
      `Employee ${empId} (${emp.name})`,
      `Dept: ${emp.department}`,
      'Record permanently removed'
    );

    return res.json({ success: true, message: `Employee ${empId} (${emp.name}) deleted successfully.` });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete employee.' });
  }
});

// ==========================================
// 3. DAILY ROSTER ATTENDANCE
// ==========================================
router.get('/attendance/date/:date', async (req: AuthRequest, res: Response) => {
  try {
    const targetDate = req.params.date; // YYYY-MM-DD
    const employees = await Employee.find({ status: 'active' }).sort({ employee_id: 1 });
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
        status: att ? att.status : 'Present',
        working_hours: att ? att.working_hours : 8,
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

    return res.json({
      date: targetDate,
      summary: {
        totalEmployees: roster.length,
        present: presentCount,
        absent: absentCount,
        leave: leaveCount,
        halfDay: halfDayCount,
      },
      roster,
    });
  } catch (err: any) {
    console.error('Error fetching attendance roster:', err);
    return res.status(500).json({ error: 'Failed to retrieve attendance roster.' });
  }
});

// Bulk Attendance Update
router.post('/attendance/bulk', async (req: AuthRequest, res: Response) => {
  try {
    const { date, records } = req.body;
    if (!date || !Array.isArray(records)) {
      return res.status(400).json({ error: 'Date and records array are required.' });
    }

    const adminName = req.user!.name || req.user!.username || 'Admin';

    for (const item of records) {
      if (!item.employee_id) continue;
      const status = item.status || 'Present';
      const wHours = item.working_hours !== undefined ? parseFloat(item.working_hours) : 8;
      const otHours = item.overtime_hours !== undefined ? parseFloat(item.overtime_hours) : 0;
      const notes = item.notes || '';

      await Attendance.findOneAndUpdate(
        { employee_id: item.employee_id, date },
        {
          $set: {
            status,
            working_hours: wHours,
            overtime_hours: otHours,
            notes,
            updated_by: adminName,
            updated_at: new Date(),
          },
          $setOnInsert: {
            created_by: adminName,
            created_at: new Date(),
          },
        },
        { upsert: true, new: true }
      );
    }

    await logAudit(
      req.user!.username,
      adminName,
      'ATTENDANCE_BULK_LOGGED',
      `Date: ${date}`,
      '',
      `Updated attendance roster for ${records.length} employees`
    );

    return res.json({ success: true, message: `Attendance for ${records.length} employees saved for ${date}.` });
  } catch (err: any) {
    console.error('Bulk attendance error:', err);
    return res.status(500).json({ error: 'Failed to save bulk attendance.' });
  }
});

// Single Attendance Update
router.post('/attendance/single', async (req: AuthRequest, res: Response) => {
  try {
    const { employee_id, date, status, working_hours, overtime_hours, notes } = req.body;

    if (!employee_id || !date || !status) {
      return res.status(400).json({ error: 'Employee ID, date, and status are required.' });
    }

    const adminName = req.user!.name || req.user!.username || 'Admin';
    const wHours = working_hours !== undefined ? parseFloat(working_hours) : 8;
    const otHours = overtime_hours !== undefined ? parseFloat(overtime_hours) : 0;

    await Attendance.findOneAndUpdate(
      { employee_id, date },
      {
        $set: {
          status,
          working_hours: wHours,
          overtime_hours: otHours,
          notes: notes || '',
          updated_by: adminName,
          updated_at: new Date(),
        },
        $setOnInsert: {
          created_by: adminName,
          created_at: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    return res.json({ success: true, message: `Attendance updated for ${employee_id} on ${date}.` });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update attendance record.' });
  }
});

// ==========================================
// 4. PAYROLL MANAGEMENT & SALARY PROCESSING
// ==========================================
router.get('/payroll', async (req: AuthRequest, res: Response) => {
  try {
    const { month, year, status } = req.query;
    const now = new Date();
    const qMonth = month ? parseInt(String(month), 10) : (now.getMonth() + 1);
    const qYear = year ? parseInt(String(year), 10) : now.getFullYear();

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
    const now = new Date();
    const qMonth = month ? parseInt(String(month), 10) : (now.getMonth() + 1);
    const qYear = year ? parseInt(String(year), 10) : now.getFullYear();

    const stdSetting = await Setting.findOne({ key: 'standard_working_days' });
    const standardWorkingDays = stdSetting ? parseFloat(stdSetting.value) : 26;

    const leavePaidSetting = await Setting.findOne({ key: 'leave_is_paid' });
    const leaveIsPaid = leavePaidSetting?.value === 'true';

    const empQuery: any = { status: 'active' };
    if (employee_id && employee_id !== 'All') {
      empQuery.employee_id = employee_id;
    }
    const employees = await Employee.find(empQuery);

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

      await Payroll.findOneAndUpdate(
        { employee_id: emp.employee_id, month: qMonth, year: qYear },
        {
          $set: {
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
            status: 'Finalized',
            generated_by: adminName,
            created_at: new Date(),
          },
        },
        { upsert: true, new: true }
      );
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

    const updated = await Payroll.findByIdAndUpdate(
      payroll_id,
      { $set: { status } },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: 'Payroll record not found.' });
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

// ==========================================
// 5. EXECUTIVE REPORTS
// ==========================================
router.get('/reports', async (req: AuthRequest, res: Response) => {
  try {
    const { type, month, year, department } = req.query;
    const now = new Date();
    const qMonth = month ? parseInt(String(month), 10) : (now.getMonth() + 1);
    const qYear = year ? parseInt(String(year), 10) : now.getFullYear();
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
    const newSettings = req.body;
    if (!newSettings || typeof newSettings !== 'object') {
      return res.status(400).json({ error: 'Invalid settings payload.' });
    }

    for (const [key, val] of Object.entries(newSettings)) {
      await Setting.findOneAndUpdate(
        { key },
        { $set: { value: String(val) } },
        { upsert: true }
      );
    }

    await logAudit(
      req.user!.username,
      req.user!.name || 'Admin',
      'STORE_SETTINGS_UPDATED',
      'System Settings',
      '',
      `Updated ${Object.keys(newSettings).length} store configuration keys`
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
