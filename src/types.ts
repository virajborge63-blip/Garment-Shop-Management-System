export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'EMPLOYEE';

export interface User {
  id: number | string;
  username: string;
  email: string;
  role: Role;
  employee_id: string | null;
  name?: string;
  department?: string;
  designation?: string;
  avatar_url?: string;
}

export interface Employee {
  employee_id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  department: string;
  designation: string;
  joining_date: string;
  per_day_salary: number;
  monthly_salary: number;
  overtime_rate: number;
  status: 'active' | 'inactive';
  avatar_url: string;
  // Computed summary fields for tables
  present_days_month?: number;
  absent_days_month?: number;
  leave_days_month?: number;
  ot_hours_month?: number;
}

export type AttendanceStatus = 'Present' | 'Absent' | 'Leave' | 'Half Day';

export interface AttendanceRecord {
  attendance_id: number | string;
  employee_id: string;
  employee_name?: string;
  department?: string;
  designation?: string;
  avatar_url?: string;
  date: string;
  day?: string;
  status: AttendanceStatus;
  working_hours: number;
  overtime_hours: number;
  notes?: string;
  created_by?: string;
  updated_by?: string;
  updated_at?: string;
}

export interface PayrollRecord {
  payroll_id: number | string;
  employee_id: string;
  employee_name?: string;
  department?: string;
  designation?: string;
  email?: string;
  avatar_url?: string;
  month: number;
  year: number;
  working_days: number;
  present_days: number;
  absent_days: number;
  leave_days: number;
  half_days: number;
  overtime_hours: number;
  extra_working_days: number;
  per_day_salary: number;
  basic_salary: number;
  extra_day_salary: number;
  overtime_salary: number;
  bonus: number;
  deductions: number;
  net_salary: number;
  status: 'Draft' | 'Finalized' | 'Paid';
  generated_by?: string;
  created_at: string;
}

export interface SalarySlipData {
  company: {
    company_name?: string;
    company_address?: string;
    company_phone?: string;
    company_email?: string;
    currency_symbol?: string;
    [key: string]: string | undefined;
  };
  salarySlip: PayrollRecord & {
    phone?: string;
    address?: string;
    joining_date?: string;
  };
}

export interface AdminDashboardMetrics {
  cards: {
    totalEmployees: number;
    activeEmployees: number;
    presentToday: number;
    absentToday: number;
    onLeaveToday: number;
    halfDayToday: number;
    totalWorkingDays: number;
    totalOvertimeHours: number;
    currentMonthPayroll: number;
    totalSalaryPaid: number;
  };
  charts: {
    dailyAttendance: Array<{
      date: string;
      day: string;
      present: number;
      absent: number;
      leave: number;
      halfDay: number;
    }>;
    monthlyComparison: Array<{
      month: string;
      presentRate: number;
      totalOt: number;
    }>;
    overtimeByDept: Array<{
      department: string;
      employees_count: number;
      ot_hours: number;
    }>;
  };
  recentAttendance: AttendanceRecord[];
  recentEmployeeActivity: Array<{
    id: number | string;
    admin_name: string;
    action: string;
    record_affected: string;
    timestamp: string;
    new_value: string;
  }>;
}

export interface EmployeeDashboardMetrics {
  employee: {
    employee_id: string;
    name: string;
    department: string;
    designation: string;
    avatar_url?: string;
  };
  stats: {
    todayStatus: string;
    todayWorkingHours: number;
    todayOvertime: number;
    presentDays: number;
    absentDays: number;
    leaveDays: number;
    halfDays: number;
    workingDays: number;
    overtimeHours: number;
    attendancePercentage: number;
    currentMonthSalary: number;
  };
  recentAttendance: Array<{
    date: string;
    status: AttendanceStatus;
    working_hours: number;
    overtime_hours: number;
    notes?: string;
  }>;
}

export interface AuditLogItem {
  id: number;
  admin_id: string;
  admin_name: string;
  action: string;
  record_affected: string;
  previous_value: string;
  new_value: string;
  timestamp: string;
}

export interface SystemSettings {
  company_name: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  standard_working_days: string;
  standard_daily_hours: string;
  leave_is_paid: string;
  currency_symbol: string;
}

export interface RosterEmployeeRow {
  employee_id: string;
  name: string;
  department: string;
  designation: string;
  avatar_url?: string;
  status: AttendanceStatus;
  working_hours: number;
  overtime_hours: number;
  notes: string;
  is_dirty?: boolean;
  attendance_id?: number;
}

export interface AdminAccount {
  id: number;
  username: string;
  email: string;
  role: Role;
  status: 'active' | 'inactive';
  created_at: string;
}

export interface SuperAdminDashboardData {
  ownerInfo: {
    storeName: string;
    ownerName: string;
    establishedYear?: string;
  };
  metrics: {
    totalWorkforce: number;
    activeWorkforce: number;
    totalDepartments: number;
    totalAdminAccounts: number;
    monthlyWageLiability: number;
    monthlyOvertimeExpense: number;
    estimatedAnnualPayroll: number;
    todayPresenceRate: number;
    todayPresentCount: number;
    todayAbsentCount: number;
    todayLeaveCount: number;
  };
  departmentBreakdown: Array<{
    department: string;
    headcount: number;
    totalMonthlySalary: number;
    overtimeHours: number;
  }>;
  recentSecurityEvents: AuditLogItem[];
}

