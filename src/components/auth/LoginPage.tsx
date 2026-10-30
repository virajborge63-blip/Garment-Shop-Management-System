import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { 
  Lock, Mail, Eye, EyeOff, ShieldCheck, 
  ArrowRight, AlertCircle
} from 'lucide-react';


export const LoginPage: React.FC = () => {
  const { login, error, warning, clearError, isLoading } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) return;
    await login(identifier, password);
  };

  return (
    <div id="login-container" className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Decorative background grid and ambient lighting */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center">
        {/* Luxury Brand Crown Header */}
        <div className="inline-flex items-center justify-center gap-3 mb-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 via-amber-600 to-yellow-500 flex items-center justify-center shadow-xl shadow-amber-500/20 text-slate-950 font-black text-2xl border border-amber-300/40">
            👑
          </div>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          H.M. RAJPAL GARMENT SHOP
        </h1>
        <p className="mt-1 text-xs font-bold text-amber-400 tracking-wider uppercase">
          Attendance & Payroll Management System
        </p>
        <p className="mt-1.5 text-xs text-slate-400">
          Super Admin (Owner), Store Manager & Staff Portal
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 py-8 px-6 shadow-2xl rounded-2xl sm:px-10">
          
          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-rose-400 text-xs animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed font-medium">{error}</span>
            </div>
          )}
          {warning && (
            <div role="status" className="mb-5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-amber-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed font-medium">{warning}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="identifier" className="block text-xs font-semibold text-slate-300 mb-1.5">
                Email Address or Username
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="identifier"
                  name="identifier"
                  type="text"
                  autoComplete="username"
                  required
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    if (error) clearError();
                  }}
                  placeholder="name@business.com"
                  className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-950/70 border border-slate-750 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" id="password-label" className="block text-xs font-semibold text-slate-300">
                  Password
                </label>
                <span className="text-xs font-medium text-amber-400">
                  Contact the owner to reset your password.
                </span>
              </div>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) clearError();
                  }}
                  placeholder="Enter your password"
                  className="block w-full pl-10 pr-10 py-2.5 bg-slate-950/70 border border-slate-750 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs py-1">
              <label className="flex items-center gap-2 cursor-pointer text-slate-400 hover:text-slate-300">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-amber-500 h-3.5 w-3.5"
                />
                <span>Remember me on this device</span>
              </label>
            </div>

            <div className="pt-2">
              <button
                id="login-submit-btn"
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl shadow-lg bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-500 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm transition-all shadow-amber-500/20 disabled:opacity-50 cursor-pointer active:scale-[0.99]"
              >
                {isLoading ? (
                  <span className="inline-block w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Sign In to Access Portal</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Security & RBAC Guarantee */}
        <div className="mt-4 text-center">
          <p className="text-xs text-slate-500 flex items-center justify-center gap-1.5 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-500 inline" />
            End-to-End Role-Based Access Control • Active
          </p>
        </div>
      </div>
    </div>
  );
};
