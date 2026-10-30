import React, { useState, useEffect } from 'react';
import { SuperAdminDashboardData } from '../../types.ts';
import { getStoredAuthToken } from '../../utils/authToken.ts';
import { 
  Building2, Users, DollarSign, Clock, ShieldCheck, 
  TrendingUp, Award, AlertCircle, ArrowUpRight, 
  Calendar, CheckCircle2, ChevronRight, Sparkles, UserPlus
} from 'lucide-react';

interface SuperAdminOverviewProps {
  onNavigate: (tab: string) => void;
}

export const SuperAdminOverview: React.FC<SuperAdminOverviewProps> = ({ onNavigate }) => {
  const [data, setData] = useState<SuperAdminDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOverview();
  }, []);

  const fetchOverview = async () => {
    try {
      setIsLoading(true);
      const token = getStoredAuthToken();
      const res = await fetch('/api/super-admin/overview', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load executive overview');
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Error fetching store overview');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
        <span className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-bold text-slate-500">Loading Store Executive Dashboard...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs">
        <p className="font-bold">Error loading owner dashboard</p>
        <p className="mt-1">{error}</p>
        <button
          onClick={fetchOverview}
          className="mt-3 px-3 py-1.5 bg-rose-600 text-white rounded-lg font-bold"
        >
          Retry
        </button>
      </div>
    );
  }

  const { ownerInfo, metrics, departmentBreakdown, recentSecurityEvents } = data;

  return (
    <div className="space-y-6">
      {/* Luxury Owner Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950/40 p-6 sm:p-8 border border-amber-500/20 shadow-xl">
        <div className="absolute -right-8 -top-8 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[11px] font-bold tracking-wider uppercase">
              👑 Store Owner & Super Administrator
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {ownerInfo.storeName}
            </h1>
            <p className="text-xs text-slate-400 max-w-xl">
              Welcome, <strong className="text-amber-200">{ownerInfo.ownerName}</strong>. Comprehensive high-level executive control over store payroll, 100+ worker daily attendance, staff wage liability, and manager permissions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => onNavigate('attendance')}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center gap-1.5"
            >
              <Users className="w-4 h-4" />
              Open Daily Roster ({metrics.totalWorkforce} Workers)
            </button>
            <button
              onClick={() => onNavigate('payroll')}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 transition-all flex items-center gap-1.5"
            >
              <DollarSign className="w-4 h-4 text-emerald-400" />
              Review Payroll
            </button>
          </div>
        </div>
      </div>

      {/* Primary Owner KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Staff */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-amber-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Store Staff</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
              {metrics.totalWorkforce}
            </span>
            <span className="text-xs font-bold text-emerald-600">
              {metrics.activeWorkforce} Active
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Across {metrics.totalDepartments} garment departments</p>
        </div>

        {/* Card 2: Monthly Wage Liability */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-amber-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Monthly Wage Liability</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
              ₹{(metrics.monthlyWageLiability).toLocaleString('en-IN')}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Est. annual: ₹{(metrics.estimatedAnnualPayroll).toLocaleString('en-IN')}</p>
        </div>

        {/* Card 3: Today's Turnout */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-amber-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Today's Presence Rate</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
              {metrics.todayPresenceRate}%
            </span>
            <span className="text-xs font-semibold text-slate-500">
              ({metrics.todayPresentCount} Present)
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {metrics.todayAbsentCount} Absent • {metrics.todayHalfDayCount} Half Day • {metrics.todayLeaveCount} Leave
          </p>
        </div>

        {/* Card 4: Overtime Expenditure */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-amber-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Month Overtime Cost</span>
            <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
              ₹{metrics.monthlyOvertimeExpense.toLocaleString('en-IN')}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Peak shopping hours & festival rush</p>
        </div>
      </div>

      {/* Main Content Split: Department Breakdown + Executive Security */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Department Staffing & Payroll Distribution */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Department Workforce & Payroll Distribution</h2>
              <p className="text-xs text-slate-500">Headcount and salary commitment per garment section</p>
            </div>
            <button
              onClick={() => onNavigate('employees')}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-500 flex items-center gap-1"
            >
              Staff Directory <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-100">
                <tr>
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3 text-center">Staff Count</th>
                  <th className="py-2.5 px-3 text-right">Monthly Payroll (₹)</th>
                  <th className="py-2.5 px-3 text-center">Overtime (hrs)</th>
                  <th className="py-2.5 px-3 text-right">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {departmentBreakdown.map((dept) => {
                  const share = metrics.monthlyWageLiability > 0 
                    ? Math.round((dept.total_monthly_salary / metrics.monthlyWageLiability) * 100) 
                    : 0;
                  return (
                    <tr key={dept.department} className="hover:bg-slate-50/80">
                      <td className="py-3 px-3">
                        <span className="font-bold text-slate-900 block">{dept.department}</span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-indigo-600">
                        {dept.headcount}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">
                        ₹{Number(dept.total_monthly_salary).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-3 text-center font-mono">
                        {dept.overtime_hours > 0 ? (
                          <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-800 font-bold text-[11px]">
                            {dept.overtime_hours}h
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="font-mono text-[11px] text-slate-600">{share}%</span>
                          <div className="w-12 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full bg-amber-500 rounded-full" style={{ width: `${share}%` }} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Col: Admin Accounts & Quick Control */}
        <div className="space-y-4">
          {/* Quick Admin Account card */}
          <div className="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-2xl p-6 text-white border border-indigo-900 shadow-md space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                Store Admin Access
              </span>
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 text-[10px] font-bold">
                {metrics.totalAdminAccounts} Accounts
              </span>
            </div>
            <div>
              <h3 className="text-base font-bold">Manager & Admin Control</h3>
              <p className="text-xs text-slate-400 mt-1">
                You have full authority to grant or revoke store manager access, reset manager passwords, and audit manager actions.
              </p>
            </div>
            <button
              onClick={() => onNavigate('admin-accounts')}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
            >
              <UserPlus className="w-4 h-4" />
              Manage Manager Accounts
            </button>
          </div>

          {/* Recent Audit events */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Security & Audit Trail
              </h3>
              <button
                onClick={() => onNavigate('audit-logs')}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-500"
              >
                View All
              </button>
            </div>

            <div className="space-y-2.5">
              {recentSecurityEvents.slice(0, 5).map((log) => (
                <div key={log.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-[11px]">{log.action}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5 truncate">{log.record_affected}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">By {log.admin_name}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
