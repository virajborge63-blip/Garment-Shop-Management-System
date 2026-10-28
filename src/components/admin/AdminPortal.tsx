import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { AdminDashboard } from './AdminDashboard.tsx';
import { EmployeeManagement } from './EmployeeManagement.tsx';
import { AttendanceManagement } from './AttendanceManagement.tsx';
import { PayrollManagement } from './PayrollManagement.tsx';
import { ReportsManagement } from './ReportsManagement.tsx';
import { SettingsManagement } from './SettingsManagement.tsx';
import { AuditLogsView } from './AuditLogsView.tsx';
import { InventoryBillingManagement } from './InventoryBillingManagement.tsx';
import { 
  Building2, LayoutDashboard, Users, CalendarCheck2, 
  DollarSign, BarChart3, Settings, ShieldAlert, LogOut, 
  Menu, X, ShieldCheck, ShoppingBag
} from 'lucide-react';

export const AdminPortal: React.FC = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inventory-pos', label: 'Store & POS Billing', icon: ShoppingBag },
    { id: 'employees', label: 'Employees', icon: Users },
    { id: 'attendance', label: 'Attendance', icon: CalendarCheck2 },
    { id: 'payroll', label: 'Payroll', icon: DollarSign },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'audit-logs', label: 'Audit Logs', icon: ShieldAlert },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row">
      {/* Mobile Header Bar */}
      <div className="md:hidden bg-slate-900 text-white p-4 flex items-center justify-between no-print">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-sm">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-sm block">H.M. RAJPAL GARMENT SHOP</span>
            <span className="text-[10px] text-indigo-300 font-semibold tracking-wider">ADMIN PORTAL</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 text-slate-300 hover:text-white"
          >
            {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Admin Sidebar Navigation */}
      <aside
        className={`fixed md:sticky top-0 z-40 h-screen w-64 bg-slate-900 text-slate-300 flex flex-col justify-between shrink-0 transition-transform duration-200 no-print ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div>
          <div className="p-6 border-b border-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-500 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <span className="font-black text-white text-base tracking-tight block">H.M. RAJPAL GARMENT SHOP</span>
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block">ADMIN PORTAL</span>
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
                  id={`admin-nav-${item.id}`}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-extrabold'
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

        {/* Admin User Footer & Logout */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold text-xs">
              AD
            </div>
            <div className="min-w-0 flex-1">
              <span className="font-bold text-xs text-white block truncate">{user?.name || user?.username}</span>
              <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Root Administrator
              </span>
            </div>
          </div>

          <button
            id="admin-logout-btn"
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 hover:text-rose-300 text-xs font-bold transition-colors border border-rose-500/20"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Admin Workspace View */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">
        {activeTab === 'dashboard' && <AdminDashboard onNavigate={setActiveTab} />}
        {activeTab === 'inventory-pos' && <InventoryBillingManagement />}
        {activeTab === 'employees' && <EmployeeManagement />}
        {activeTab === 'attendance' && <AttendanceManagement />}
        {activeTab === 'payroll' && <PayrollManagement />}
        {activeTab === 'reports' && <ReportsManagement />}
        {activeTab === 'settings' && <SettingsManagement />}
        {activeTab === 'audit-logs' && <AuditLogsView />}
      </main>
    </div>
  );
};
