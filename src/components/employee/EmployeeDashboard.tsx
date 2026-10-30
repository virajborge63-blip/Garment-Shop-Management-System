import React, { useState, useEffect } from 'react';
import { EmployeeDashboardMetrics } from '../../types.ts';
import { getStoredAuthToken } from '../../utils/authToken.ts';
import { 
  CheckCircle2, Clock, Calendar, DollarSign, 
  Percent, UserCheck, AlertCircle, ArrowRight, 
  Activity, Award, Shield
} from 'lucide-react';

interface EmployeeDashboardProps {
  onNavigate: (tab: string) => void;
}

export const EmployeeDashboard: React.FC<EmployeeDashboardProps> = ({ onNavigate }) => {
  const [data, setData] = useState<EmployeeDashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      setIsLoading(true);
      const token = getStoredAuthToken();
      const res = await fetch('/api/employee/dashboard', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load dashboard');
      const resData = await res.json();
      setData(resData);
    } catch (err) {
      console.error('Error fetching employee dashboard', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-500 font-medium">Loading your employee portal...</span>
        </div>
      </div>
    );
  }

  const { employee, stats, recentAttendance } = data;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-teal-900 via-slate-900 to-slate-950 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img
              src={employee.avatar_url || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'}
              alt={employee.name}
              className="w-16 h-16 rounded-2xl object-cover border-2 border-teal-400/40 shadow-md"
            />
            <div>
              <span className="text-xs font-semibold tracking-wider text-teal-300 uppercase block">
                EMPLOYEE SELF-SERVICE PORTAL
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Welcome, {employee.name}
              </h1>
              <p className="text-xs text-slate-300 mt-0.5">
                {employee.designation} • {employee.department} • <span className="font-mono font-bold text-teal-300">{employee.employee_id}</span>
              </p>
            </div>
          </div>

          {/* Today's Status Pill */}
          <div className="bg-slate-950/70 backdrop-blur-md p-3.5 rounded-xl border border-teal-500/30 text-right">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Today's Attendance</span>
            <div className="flex items-center gap-2 justify-end mt-1">
              <span className={`w-2.5 h-2.5 rounded-full ${
                stats.todayStatus === 'Present' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`} />
              <span className="text-base font-extrabold text-white">{stats.todayStatus}</span>
            </div>
            <span className="text-[11px] text-slate-400 block mt-0.5">
              {stats.todayWorkingHours} hrs worked {stats.todayOvertime > 0 && `(+${stats.todayOvertime}h OT)`}
            </span>
          </div>
        </div>
      </div>

      {/* Monthly Statistics Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Current Month Performance & Attendance
          </h2>
          <span className="text-xs text-slate-400">Standard Working Days: {stats.workingDays}</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Present Days */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium uppercase tracking-wider">Present Days</span>
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black text-emerald-600">{stats.presentDays}</span>
              <span className="text-[11px] text-slate-400 block mt-0.5">Logged present</span>
            </div>
          </div>

          {/* Absent Days */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium uppercase tracking-wider">Absent Days</span>
              <div className="p-2 rounded-lg bg-rose-50 text-rose-600">
                <AlertCircle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black text-rose-600">{stats.absentDays}</span>
              <span className="text-[11px] text-slate-400 block mt-0.5">Unexcused</span>
            </div>
          </div>

          {/* Leave & Half Days */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium uppercase tracking-wider">Leaves / Half Days</span>
              <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black text-amber-600">
                {stats.leaveDays} <span className="text-xs text-slate-400">/ {stats.halfDays} HD</span>
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">Approved off days</span>
            </div>
          </div>

          {/* Overtime Hours */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium uppercase tracking-wider">Overtime Hours</span>
              <div className="p-2 rounded-lg bg-sky-50 text-sky-600">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black text-sky-600">{stats.overtimeHours} <span className="text-sm font-semibold">hrs</span></span>
              <span className="text-[11px] text-slate-400 block mt-0.5">Approved overtime</span>
            </div>
          </div>

          {/* Attendance Percentage */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium uppercase tracking-wider">Attendance Rate</span>
              <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                <Percent className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black text-indigo-600">{stats.attendancePercentage}%</span>
              <span className="text-[11px] text-slate-400 block mt-0.5">Monthly adherence</span>
            </div>
          </div>

          {/* Current Month Net Salary */}
          <div className="col-span-2 sm:col-span-3 bg-gradient-to-r from-teal-50 to-emerald-50 p-4 rounded-xl border border-teal-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-teal-800 uppercase tracking-wider block">Estimated / Finalized Salary</span>
              <span className="text-2xl sm:text-3xl font-black text-teal-950 mt-1 block">
                ₹{stats.currentMonthSalary.toLocaleString('en-IN')}
              </span>
              <span className="text-xs text-teal-700 mt-0.5 block">
                Calculated based on verified working days, overtime hours, and active allowances.
              </span>
            </div>
            <button
              onClick={() => onNavigate('salary')}
              className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-md shadow-teal-600/30 flex items-center gap-1.5"
            >
              View Calculation <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Quick Access Navigation Buttons */}
      <div>
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
          Quick Access Portals
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <button
            onClick={() => onNavigate('attendance')}
            className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-teal-400 hover:shadow-md transition-all text-left group"
          >
            <Calendar className="w-5 h-5 text-teal-600 mb-2 group-hover:scale-110 transition-transform" />
            <span className="font-bold text-xs text-slate-800 block">My Attendance</span>
            <span className="text-[10px] text-slate-400">History & daily logs</span>
          </button>

          <button
            onClick={() => onNavigate('salary')}
            className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-teal-400 hover:shadow-md transition-all text-left group"
          >
            <DollarSign className="w-5 h-5 text-indigo-600 mb-2 group-hover:scale-110 transition-transform" />
            <span className="font-bold text-xs text-slate-800 block">My Salary</span>
            <span className="text-[10px] text-slate-400">Formula & breakdown</span>
          </button>

          <button
            onClick={() => onNavigate('payroll')}
            className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-teal-400 hover:shadow-md transition-all text-left group"
          >
            <Award className="w-5 h-5 text-amber-600 mb-2 group-hover:scale-110 transition-transform" />
            <span className="font-bold text-xs text-slate-800 block">My Payroll</span>
            <span className="text-[10px] text-slate-400">Past disbursements</span>
          </button>

          <button
            onClick={() => onNavigate('salary-slips')}
            className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-teal-400 hover:shadow-md transition-all text-left group"
          >
            <CheckCircle2 className="w-5 h-5 text-purple-600 mb-2 group-hover:scale-110 transition-transform" />
            <span className="font-bold text-xs text-slate-800 block">My Salary Slips</span>
            <span className="text-[10px] text-slate-400">Printable payslips</span>
          </button>

          <button
            onClick={() => onNavigate('profile')}
            className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-teal-400 hover:shadow-md transition-all text-left group"
          >
            <Shield className="w-5 h-5 text-sky-600 mb-2 group-hover:scale-110 transition-transform" />
            <span className="font-bold text-xs text-slate-800 block">My Profile</span>
            <span className="text-[10px] text-slate-400">Personal & job details</span>
          </button>
        </div>
      </div>

      {/* Recent Attendance Activity Stream */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-4 h-4 text-teal-600" />
            Recent Attendance Activity
          </h2>
          <button
            onClick={() => onNavigate('attendance')}
            className="text-xs font-semibold text-teal-600 hover:text-teal-800"
          >
            View Full History
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 uppercase text-[10px] font-bold">
                <th className="pb-2">Date</th>
                <th className="pb-2">Status</th>
                <th className="pb-2 text-center">Working Hours</th>
                <th className="pb-2 text-center">Overtime Hours</th>
                <th className="pb-2">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentAttendance.map((rec, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="py-2.5 font-mono font-medium text-slate-800">{rec.date}</td>
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
                  <td className="py-2.5 text-center font-mono font-semibold text-slate-700">
                    {rec.working_hours} hrs
                  </td>
                  <td className="py-2.5 text-center font-mono">
                    {rec.overtime_hours > 0 ? (
                      <span className="text-sky-600 font-bold">+{rec.overtime_hours} hrs</span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="py-2.5 text-slate-500 truncate max-w-xs">
                    {rec.notes || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
