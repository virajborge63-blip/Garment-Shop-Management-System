import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, Building2, Clock, Calendar, 
  DollarSign, CheckCircle2, AlertCircle, Save, Shield
} from 'lucide-react';

export const SettingsManagement: React.FC = () => {
  const [settings, setSettings] = useState({
    company_name: 'H.M. RAJPAL GARMENT SHOP',
    company_address: 'Shop No. 12-14, Cloth Market, Main Bazaar',
    company_phone: '+91 98234 56789',
    company_email: 'contact@rajpalgarments.com',
    standard_working_days: '26',
    standard_daily_hours: '8',
    leave_is_paid: 'true',
    currency_symbol: '₹',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('erp_token');
      const res = await fetch('/api/admin/settings', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.settings) {
        setSettings((prev) => ({ ...prev, ...data.settings }));
      }
    } catch (err) {
      console.error('Failed to load settings', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFeedback(null);

    try {
      const token = localStorage.getItem('erp_token');
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update settings');

      setFeedback({ type: 'success', message: 'System rules and company profile saved successfully!' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">System & Organization Settings</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Configure business profile for official payslips, set organizational working calendars, and define leave compensation formulas.
        </p>
      </div>

      {feedback && (
        <div className={`p-3.5 rounded-xl text-xs flex items-center justify-between ${
          feedback.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-rose-50 border border-rose-200 text-rose-800'
        }`}>
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
            <span>{feedback.message}</span>
          </div>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Company Information (Used on Salary Slips) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-150">
            <Building2 className="w-5 h-5 text-indigo-600" />
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Company Information</h2>
              <p className="text-[11px] text-slate-500">Rendered in the header of all official payslips and compliance exports</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Company Registered Name</label>
              <input
                type="text"
                required
                value={settings.company_name}
                onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Corporate Email Address</label>
              <input
                type="email"
                required
                value={settings.company_email}
                onChange={(e) => setSettings({ ...settings, company_email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Office Telephone / Hotline</label>
              <input
                type="text"
                value={settings.company_phone}
                onChange={(e) => setSettings({ ...settings, company_phone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Currency Symbol</label>
              <input
                type="text"
                value={settings.currency_symbol}
                onChange={(e) => setSettings({ ...settings, currency_symbol: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-mono font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="text-xs">
            <label className="block font-semibold text-slate-700 mb-1">Corporate Registered Address</label>
            <input
              type="text"
              value={settings.company_address}
              onChange={(e) => setSettings({ ...settings, company_address: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Section 2: Attendance, Hours & Payroll Rules */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-150">
            <Calendar className="w-5 h-5 text-indigo-600" />
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Attendance & Working Hours Rules</h2>
              <p className="text-[11px] text-slate-500">Governs monthly denominator calculations and extra day triggers</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <label className="block font-bold text-slate-800 mb-1">Standard Working Days per Month</label>
              <input
                type="number"
                min="1"
                max="31"
                value={settings.standard_working_days}
                onChange={(e) => setSettings({ ...settings, standard_working_days: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-mono font-bold focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Standard corporate calendar (Default: 26 days assuming 4 weekly rest days)
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <label className="block font-bold text-slate-800 mb-1">Standard Shift Hours per Day</label>
              <input
                type="number"
                min="1"
                max="16"
                value={settings.standard_daily_hours}
                onChange={(e) => setSettings({ ...settings, standard_daily_hours: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-mono font-bold focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Standard full-day presence duration (Default: 8 hours)
              </span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <label className="block font-bold text-slate-800 mb-2">Leave Remuneration Policy</label>
            <div className="grid grid-cols-2 gap-3">
              <label className={`p-3 rounded-lg border cursor-pointer flex items-center gap-2.5 transition-all ${
                settings.leave_is_paid === 'true'
                  ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500 text-indigo-900 font-bold'
                  : 'bg-white border-slate-200 text-slate-700'
              }`}>
                <input
                  type="radio"
                  name="leavePolicy"
                  checked={settings.leave_is_paid === 'true'}
                  onChange={() => setSettings({ ...settings, leave_is_paid: 'true' })}
                  className="text-indigo-600"
                />
                <div>
                  <span className="block text-xs">Paid Approved Leaves</span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    Approved leaves count towards paid days in monthly basic calculation.
                  </span>
                </div>
              </label>

              <label className={`p-3 rounded-lg border cursor-pointer flex items-center gap-2.5 transition-all ${
                settings.leave_is_paid === 'false'
                  ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500 text-indigo-900 font-bold'
                  : 'bg-white border-slate-200 text-slate-700'
              }`}>
                <input
                  type="radio"
                  name="leavePolicy"
                  checked={settings.leave_is_paid === 'false'}
                  onChange={() => setSettings({ ...settings, leave_is_paid: 'false' })}
                  className="text-indigo-600"
                />
                <div>
                  <span className="block text-xs">Unpaid Leaves</span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    Leaves are deducted and only actual present days are compensated.
                  </span>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving Changes...' : 'Save Configuration'}
          </button>
        </div>
      </form>
    </div>
  );
};
