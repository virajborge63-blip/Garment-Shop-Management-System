import React, { useEffect, useState } from 'react';
import { AdminDashboardMetrics } from '../../types.ts';
import { 
  Users, UserCheck, UserX, Calendar, Clock, DollarSign, 
  TrendingUp, AlertCircle, ArrowUpRight, BarChart3, 
  Briefcase, Activity, FileSpreadsheet
} from 'lucide-react';

interface AdminDashboardProps {
  onNavigate: (tab: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
  const [metrics, setMetrics] = useState<AdminDashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('erp_token');
      const res = await fetch('/api/admin/dashboard', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load metrics');
      const data = await res.json();
      setMetrics(data);
    } catch (err: any) {
      setError(err.message || 'Error fetching dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-500 font-medium">Loading organization dashboard...</span>
        </div>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          <span>{error || 'Unable to load dashboard data.'}</span>
        </div>
        <button onClick={fetchMetrics} className="px-3 py-1.5 bg-rose-600 text-white text-xs font-semibold rounded-lg">
          Retry
        </button>
      </div>
    );
  }

  const { cards, charts, recentAttendance, recentEmployeeActivity } = metrics;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-slate-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/20 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-semibold tracking-wider text-indigo-300 uppercase block mb-1">
              ADMINISTRATIVE CONTROL CENTER
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Organization Overview</h1>
            <p className="text-xs text-slate-300 mt-1 max-w-xl">
              Live monitoring of organizational attendance, daily shift status, workforce overtime, and finalized payroll disbursements.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              id="dash-mark-attendance-btn"
              onClick={() => onNavigate('attendance')}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 transition-colors"
            >
              <Activity className="w-4 h-4" />
              Manage Today Attendance
            </button>
            <button
              id="dash-generate-payroll-btn"
              onClick={() => onNavigate('payroll')}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Monthly Payroll
            </button>
          </div>
        </div>
      </div>

      {/* 8 Metric KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Total Employees */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase tracking-wider">Total Staff</span>
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-slate-900">{cards.totalEmployees}</span>
            <span className="text-[11px] text-emerald-600 font-medium block mt-0.5">
              {cards.activeEmployees} active accounts
            </span>
          </div>
        </div>

        {/* Present Today */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase tracking-wider">Present Today</span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-emerald-600">{cards.presentToday}</span>
            <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
              On duty / logged
            </span>
          </div>
        </div>

        {/* Absent Today */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase tracking-wider">Absent Today</span>
            <div className="p-2 rounded-lg bg-rose-50 text-rose-600">
              <UserX className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-rose-600">{cards.absentToday}</span>
            <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
              Unexcused / missing
            </span>
          </div>
        </div>

        {/* On Leave Today */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase tracking-wider">On Leave</span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-amber-600">{cards.onLeaveToday}</span>
            <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
              {cards.halfDayToday > 0 ? `${cards.halfDayToday} on Half Day` : 'Approved leaves'}
            </span>
          </div>
        </div>

        {/* Working Days */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase tracking-wider">Std Working Days</span>
            <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-slate-900">{cards.totalWorkingDays}</span>
            <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
              Standard per month
            </span>
          </div>
        </div>

        {/* Total Overtime Hours */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase tracking-wider">Overtime Hours</span>
            <div className="p-2 rounded-lg bg-sky-50 text-sky-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-sky-600">{cards.totalOvertimeHours} <span className="text-sm font-semibold">hrs</span></span>
            <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
              Logged this month
            </span>
          </div>
        </div>

        {/* Current Month Payroll */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase tracking-wider">Monthly Payroll</span>
            <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xl font-black text-purple-950">₹{cards.currentMonthPayroll.toLocaleString('en-IN')}</span>
            <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
              Gross liabilities
            </span>
          </div>
        </div>

        {/* Total Salary Paid */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase tracking-wider">Total Paid Out</span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xl font-black text-emerald-700">₹{cards.totalSalaryPaid.toLocaleString('en-IN')}</span>
            <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
              Disbursed to staff
            </span>
          </div>
        </div>
      </div>

      {/* Visual Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Attendance Chart (Past 7 Days) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-600" />
                Daily Attendance Trend (Last 7 Days)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Daily breakdown of Present, Absent, Half Day & Leave records</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Present</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Absent</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Leave</span>
            </div>
          </div>

          <div className="space-y-3">
            {charts.dailyAttendance.map((day) => {
              const total = Math.max(day.present + day.absent + day.leave + day.halfDay, 1);
              const pPct = (day.present / total) * 100;
              const aPct = (day.absent / total) * 100;
              const lPct = (day.leave / total) * 100;
              const hPct = (day.halfDay / total) * 100;

              return (
                <div key={day.date} className="text-xs">
                  <div className="flex justify-between items-center mb-1 text-slate-700">
                    <span className="font-semibold text-slate-900 w-24">{day.day} ({day.date.slice(5)})</span>
                    <div className="flex items-center gap-3 text-slate-500">
                      <span>{day.present} Present</span>
                      {day.absent > 0 && <span className="text-rose-600 font-medium">{day.absent} Absent</span>}
                      {day.leave > 0 && <span className="text-amber-600 font-medium">{day.leave} Leave</span>}
                      <span className="font-mono text-slate-400">{Math.round(pPct)}%</span>
                    </div>
                  </div>
                  <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
                    <div style={{ width: `${pPct}%` }} className="bg-emerald-500 h-full transition-all duration-500" title={`Present: ${day.present}`} />
                    <div style={{ width: `${hPct}%` }} className="bg-purple-500 h-full transition-all duration-500" title={`Half Day: ${day.halfDay}`} />
                    <div style={{ width: `${lPct}%` }} className="bg-amber-500 h-full transition-all duration-500" title={`Leave: ${day.leave}`} />
                    <div style={{ width: `${aPct}%` }} className="bg-rose-500 h-full transition-all duration-500" title={`Absent: ${day.absent}`} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Overtime & Department Summary */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-sky-600" />
              Overtime Summary by Department
            </h2>
            <p className="text-xs text-slate-500 mb-4">Current month total overtime distribution</p>

            <div className="space-y-3">
              {charts.overtimeByDept.map((dept) => (
                <div key={dept.department} className="p-3 rounded-xl bg-slate-50 border border-slate-150 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-xs text-slate-900">{dept.department}</span>
                    <span className="block text-[11px] text-slate-500">{dept.employees_count} staff members</span>
                  </div>
                  <div className="text-right">
                    <span className="font-extrabold text-sm text-sky-600">{dept.ot_hours} hrs</span>
                    <span className="block text-[10px] text-slate-400">Total OT</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-150 flex justify-between items-center text-xs">
            <span className="text-slate-500">Detailed Overtime Audit:</span>
            <button
              onClick={() => onNavigate('reports')}
              className="font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              Generate Report <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Dual Activity Stream: Recent Attendance & Recent Employee Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Attendance Activity */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-600" />
              Recent Attendance Activity
            </h2>
            <button
              onClick={() => onNavigate('attendance')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
            >
              View All
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase text-[10px] font-bold">
                  <th className="pb-2">Employee</th>
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2 text-right">Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentAttendance.map((rec) => (
                  <tr key={rec.attendance_id} className="hover:bg-slate-50/80">
                    <td className="py-2.5 font-medium text-slate-900">
                      <span>{rec.employee_name || rec.employee_id}</span>
                      <span className="block text-[10px] text-slate-400">{rec.department}</span>
                    </td>
                    <td className="py-2.5 text-slate-600">{rec.date}</td>
                    <td className="py-2.5">
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        rec.status === 'Present' ? 'bg-emerald-100 text-emerald-800' :
                        rec.status === 'Absent' ? 'bg-rose-100 text-rose-800' :
                        rec.status === 'Half Day' ? 'bg-purple-100 text-purple-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {rec.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-semibold text-slate-700">
                      {rec.working_hours}h {rec.overtime_hours > 0 && <span className="text-sky-600 font-bold">(+{rec.overtime_hours}h OT)</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Admin Audit Activity */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-600" />
              Administrative Audit Log
            </h2>
            <button
              onClick={() => onNavigate('audit-logs')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
            >
              Full Audit Trail
            </button>
          </div>

          <div className="space-y-3 text-xs">
            {recentEmployeeActivity.map((log) => (
              <div key={log.id} className="p-3 rounded-xl bg-slate-50 border border-slate-150 flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-indigo-600 mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 truncate">{log.action}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-slate-600 text-[11px] mt-0.5 truncate">{log.record_affected}</p>
                  {log.new_value && (
                    <p className="text-slate-500 text-[10px] font-mono mt-1 bg-white p-1.5 rounded border border-slate-200 truncate">
                      {log.new_value}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
