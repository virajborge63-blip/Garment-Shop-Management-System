import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { SuperAdminOverview } from './SuperAdminOverview.tsx';
import { AdminAccountsManagement } from './AdminAccountsManagement.tsx';
import { AttendanceManagement } from '../admin/AttendanceManagement.tsx';
import { EmployeeManagement } from '../admin/EmployeeManagement.tsx';
import { PayrollManagement } from '../admin/PayrollManagement.tsx';
import { ReportsManagement } from '../admin/ReportsManagement.tsx';
import { SettingsManagement } from '../admin/SettingsManagement.tsx';
import { AuditLogsView } from '../admin/AuditLogsView.tsx';
import { InventoryBillingManagement } from '../admin/InventoryBillingManagement.tsx';
import { 
  Building2, LayoutDashboard, Users, CalendarCheck2, 
  DollarSign, BarChart3, Settings, ShieldAlert, LogOut, 
  Menu, X, ShieldCheck, Crown, UserPlus, Sparkles, Download, ShoppingBag
} from 'lucide-react';

export const SuperAdminPortal: React.FC = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const navItems = [
    { id: 'overview', label: 'Executive Overview', icon: Crown, badge: 'Owner' },
    { id: 'inventory-pos', label: 'Store & POS Billing', icon: ShoppingBag, badge: 'Retail' },
    { id: 'attendance', label: 'Line-by-Line Attendance', icon: CalendarCheck2, badge: '100+ Staff' },
    { id: 'employees', label: 'Workforce Directory', icon: Users },
    { id: 'payroll', label: 'Payroll & Salary Slips', icon: DollarSign },
    { id: 'admin-accounts', label: 'Manager Accounts', icon: UserPlus, badge: 'Access' },
    { id: 'reports', label: 'Financial Reports', icon: BarChart3 },
    { id: 'settings', label: 'Store Settings', icon: Settings },
    { id: 'audit-logs', label: 'Security & Audit Logs', icon: ShieldAlert },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row">
      {/* Mobile Header Bar */}
      <div className="md:hidden bg-slate-950 text-white p-4 flex items-center justify-between no-print border-b border-amber-500/20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center font-bold text-slate-950">
            👑
          </div>
          <div>
            <span className="font-bold text-sm block">H.M. RAJPAL GARMENT SHOP</span>
            <span className="text-[10px] text-amber-400 font-bold tracking-wider">OWNER CONSOLE</span>
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

      {/* Super Admin Executive Sidebar */}
      <aside
        className={`fixed md:sticky top-0 z-40 h-screen w-64 bg-slate-950 text-slate-300 flex flex-col justify-between shrink-0 transition-transform duration-200 no-print border-r border-slate-800 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div>
          {/* Brand Header */}
          <div className="p-5 border-b border-slate-800/80 flex items-center gap-3 bg-slate-950/80">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-amber-600 to-yellow-500 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20 font-black">
              👑
            </div>
            <div>
              <span className="font-black text-white text-sm tracking-tight block">H.M. RAJPAL GARMENT SHOP</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-[10px] font-extrabold text-amber-400 uppercase tracking-widest">
                  SUPER ADMIN PORTAL
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3.5 space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`super-admin-nav-${item.id}`}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/20 font-black'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                      isActive 
                        ? 'bg-slate-950/20 text-slate-950' 
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Owner Profile Card & Logout */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/60">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 text-slate-950 font-black text-xs flex items-center justify-center shadow-sm">
              HR
            </div>
            <div className="min-w-0 flex-1">
              <span className="font-black text-xs text-white block truncate">
                {user?.name || 'H.M. Rajpal'}
              </span>
              <span className="text-[10px] text-amber-400 font-bold flex items-center gap-1">
                <Crown className="w-3 h-3 text-amber-400" />
                Store Owner
              </span>
            </div>
          </div>

          <button
            id="super-admin-logout-btn"
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 hover:text-rose-300 text-xs font-bold transition-colors border border-rose-500/20"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Owner Workspace View */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">
        {activeTab === 'overview' && <SuperAdminOverview onNavigate={setActiveTab} />}
        {activeTab === 'inventory-pos' && <InventoryBillingManagement />}
        {activeTab === 'attendance' && <AttendanceManagement />}
        {activeTab === 'employees' && <EmployeeManagement />}
        {activeTab === 'payroll' && <PayrollManagement />}
        {activeTab === 'admin-accounts' && <AdminAccountsManagement />}
        {activeTab === 'reports' && <ReportsManagement />}
        {activeTab === 'settings' && <SettingsManagement />}
        {activeTab === 'audit-logs' && <AuditLogsView />}
      </main>
    </div>
  );
};
