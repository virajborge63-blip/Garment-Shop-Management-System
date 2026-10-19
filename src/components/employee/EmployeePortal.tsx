import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { EmployeeDashboard } from './EmployeeDashboard.tsx';
import { EmployeeAttendance } from './EmployeeAttendance.tsx';
import { EmployeeSalary } from './EmployeeSalary.tsx';
import { EmployeePayroll } from './EmployeePayroll.tsx';
import { EmployeeSalarySlips } from './EmployeeSalarySlips.tsx';
import { EmployeeProfile } from './EmployeeProfile.tsx';
import { 
  Building2, LayoutDashboard, Calendar, DollarSign, 
  Award, FileText, UserCheck, LogOut, Menu, X, ShieldCheck
} from 'lucide-react';

export const EmployeePortal: React.FC = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'My Dashboard', icon: LayoutDashboard },
    { id: 'attendance', label: 'My Attendance', icon: Calendar },
    { id: 'salary', label: 'My Salary', icon: DollarSign },
    { id: 'payroll', label: 'My Payroll', icon: Award },
    { id: 'salary-slips', label: 'My Salary Slips', icon: FileText },
    { id: 'profile', label: 'My Profile', icon: UserCheck },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden bg-slate-900 text-white p-4 flex items-center justify-between no-print">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center font-bold text-sm">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-sm block">H.M. RAJPAL GARMENT SHOP</span>
            <span className="text-[10px] text-teal-300 font-semibold tracking-wider">EMPLOYEE PORTAL</span>
          </div>
        </div>
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 text-slate-300 hover:text-white"
        >
          {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Employee Sidebar */}
      <aside
        className={`fixed md:sticky top-0 z-40 h-screen w-64 bg-slate-900 text-slate-300 flex flex-col justify-between shrink-0 transition-transform duration-200 no-print ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div>
          {/* Brand Header */}
          <div className="p-6 border-b border-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-500 flex items-center justify-center text-white shadow-md shadow-teal-600/30">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <span className="font-black text-white text-base tracking-tight block">H.M. RAJPAL GARMENT SHOP</span>
              <span className="text-[10px] font-bold text-teal-400 uppercase tracking-widest block">EMPLOYEE PORTAL</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`emp-nav-${item.id}`}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-teal-600 text-white shadow-md shadow-teal-600/30 font-extrabold'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Employee User Info & Logout */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center justify-center font-bold text-xs">
              {user?.employee_id || 'EP'}
            </div>
            <div className="min-w-0 flex-1">
              <span className="font-bold text-xs text-white block truncate">{user?.name || user?.username}</span>
              <span className="text-[10px] text-teal-400 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Verified Employee
              </span>
            </div>
          </div>

          <button
            id="employee-logout-btn"
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 hover:text-rose-300 text-xs font-bold transition-colors border border-rose-500/20"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Employee View */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">
        {activeTab === 'dashboard' && <EmployeeDashboard onNavigate={setActiveTab} />}
        {activeTab === 'attendance' && <EmployeeAttendance />}
        {activeTab === 'salary' && <EmployeeSalary />}
        {activeTab === 'payroll' && <EmployeePayroll />}
        {activeTab === 'salary-slips' && <EmployeeSalarySlips />}
        {activeTab === 'profile' && <EmployeeProfile />}
      </main>
    </div>
  );
};
