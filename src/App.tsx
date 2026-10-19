import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { LoginPage } from './components/auth/LoginPage.tsx';
import { SuperAdminPortal } from './components/superadmin/SuperAdminPortal.tsx';
import { AdminPortal } from './components/admin/AdminPortal.tsx';
import { EmployeePortal } from './components/employee/EmployeePortal.tsx';
import { Building2 } from 'lucide-react';

const MainContent: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/30 animate-pulse mb-4 text-slate-950 font-bold">
          <Building2 className="w-6 h-6" />
        </div>
        <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mb-3" />
        <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">
          Verifying Security & Session...
        </span>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  // Strict Role-Based Gateway
  if (user.role === 'SUPER_ADMIN') {
    return <SuperAdminPortal />;
  }

  if (user.role === 'ADMIN') {
    return <AdminPortal />;
  }

  if (user.role === 'EMPLOYEE') {
    return <EmployeePortal />;
  }

  return <LoginPage />;
};

export default function App() {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
}
