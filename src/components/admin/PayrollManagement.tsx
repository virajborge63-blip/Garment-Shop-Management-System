import React, { useState, useEffect } from 'react';
import { PayrollRecord, SalarySlipData } from '../../types.ts';
import { getStoredAuthToken } from '../../utils/authToken.ts';
import { SalarySlipModal } from '../common/SalarySlipModal.tsx';
import { 
  FileSpreadsheet, Calculator, CheckCircle2, 
  Printer, Edit3, Lock, AlertCircle, X, Check, 
  DollarSign, Sparkles, ChevronRight, TrendingUp
} from 'lucide-react';

interface PayrollWarning {
  employee_id: string;
  employee_name: string;
  dates: string[];
}

export const PayrollManagement: React.FC = () => {
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
  const [payrollWarnings, setPayrollWarnings] = useState<PayrollWarning[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<number>(8); // Defaults to August or current
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [isGenerating, setIsGenerating] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Edit bonus & deductions modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPayroll, setEditingPayroll] = useState<PayrollRecord | null>(null);
  const [editBonus, setEditBonus] = useState(0);
  const [editDeductions, setEditDeductions] = useState(0);
  const [editStatus, setEditStatus] = useState<'Draft' | 'Finalized' | 'Paid'>('Finalized');

  // Salary slip preview modal
  const [selectedSlip, setSelectedSlip] = useState<PayrollRecord | null>(null);
  const [isSlipOpen, setIsSlipOpen] = useState(false);
  const [companySettings, setCompanySettings] = useState<any>({});

  useEffect(() => {
    fetchPayroll();
    fetchCompanySettings();
  }, [selectedMonth, selectedYear]);

  const fetchCompanySettings = async () => {
    try {
      const token = getStoredAuthToken();
      const res = await fetch('/api/admin/settings', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.settings) setCompanySettings(data.settings);
    } catch {
      // ignore
    }
  };

  const fetchPayroll = async () => {
    try {
      setIsLoading(true);
      const token = getStoredAuthToken();
      const res = await fetch(`/api/admin/payroll?month=${selectedMonth}&year=${selectedYear}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setPayrolls(data.payroll || []);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to fetch payroll.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGeneratePayroll = async () => {
    try {
      setIsGenerating(true);
      setFeedback(null);
      setPayrollWarnings([]);
      const token = getStoredAuthToken();
      const res = await fetch('/api/admin/payroll/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          month: selectedMonth,
          year: selectedYear,
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate payroll');

      setPayrollWarnings(Array.isArray(data.warnings) ? data.warnings : []);
      setFeedback({ type: 'success', message: data.message });
      fetchPayroll();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFinalizeAll = async () => {
    if (!window.confirm(`Finalize and lock all payroll records for ${selectedMonth}/${selectedYear}?`)) return;
    try {
      const token = getStoredAuthToken();
      const res = await fetch('/api/admin/payroll/finalize-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          month: selectedMonth,
          year: selectedYear,
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to finalize payroll');

      setFeedback({ type: 'success', message: data.message });
      fetchPayroll();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const openEditModal = (p: PayrollRecord) => {
    setEditingPayroll(p);
    setEditBonus(p.bonus);
    setEditDeductions(p.deductions);
    setEditStatus(p.status);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayroll) return;

    try {
      const token = getStoredAuthToken();
      const res = await fetch(`/api/admin/payroll/${editingPayroll.payroll_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          bonus: editBonus,
          deductions: editDeductions,
          status: editStatus,
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update payroll item');

      setFeedback({ type: 'success', message: data.message });
      setIsEditModalOpen(false);
      fetchPayroll();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const totalPayrollAmount = payrolls.reduce((sum, p) => sum + p.net_salary, 0);
  const totalOvertimePaid = payrolls.reduce((sum, p) => sum + p.overtime_salary, 0);
  const totalDeductions = payrolls.reduce((sum, p) => sum + p.deductions, 0);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Payroll & Salary Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Automated salary calculations, overtime compensations, bonus adjustments and payslip generation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            id="calculate-payroll-btn"
            onClick={handleGeneratePayroll}
            disabled={isGenerating}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition-all disabled:opacity-50"
          >
            <Calculator className="w-4 h-4" />
            {isGenerating ? 'Calculating Salaries...' : 'Run Auto-Calculation'}
          </button>
          <button
            id="finalize-all-payroll-btn"
            onClick={handleFinalizeAll}
            disabled={payrolls.length === 0}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all disabled:opacity-50"
          >
            <Lock className="w-4 h-4 text-emerald-400" />
            Finalize & Lock All
          </button>
        </div>
      </div>

      {feedback && (
        <div className={`p-3.5 rounded-xl text-xs flex items-center justify-between ${
          feedback.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-rose-50 border border-rose-200 text-rose-800'
        }`}>
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {payrollWarnings.length > 0 && (
        <section
          aria-label="Unmarked attendance warning"
          className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950"
        >
          <p className="text-sm font-bold">
            Unmarked working days earn no pay. Review attendance if any of these were worked.
          </p>
          <ul className="mt-2 space-y-1 text-xs">
            {payrollWarnings.map((warning) => (
              <li key={warning.employee_id}>
                <span className="font-semibold">{warning.employee_name} ({warning.employee_id}):</span>{' '}
                {warning.dates.join(', ')}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Period Selector & Summary Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Month / Year Selector Card */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Payroll Period</span>
          <div className="flex items-center gap-2 mt-2">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {monthNames.map((m, idx) => (
                <option key={m} value={idx + 1}>{m}</option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {[2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <span className="text-[11px] text-slate-400 mt-2 block">
            {payrolls.length} employee records computed
          </span>
        </div>

        {/* Total Net Payroll Amount */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Total Net Payroll</span>
          <span className="text-2xl font-black text-slate-900 block mt-1">
            ₹{totalPayrollAmount.toLocaleString('en-IN')}
          </span>
          <span className="text-[11px] text-emerald-600 font-semibold block mt-0.5">
            Disbursement liability
          </span>
        </div>

        {/* Total Overtime Paid */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Overtime Remuneration</span>
          <span className="text-2xl font-black text-sky-600 block mt-1">
            ₹{totalOvertimePaid.toLocaleString('en-IN')}
          </span>
          <span className="text-[11px] text-slate-500 font-semibold block mt-0.5">
            Compensated extra hours
          </span>
        </div>

        {/* Total Deductions */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Withheld Deductions</span>
          <span className="text-2xl font-black text-rose-600 block mt-1">
            ₹{totalDeductions.toLocaleString('en-IN')}
          </span>
          <span className="text-[11px] text-slate-500 font-semibold block mt-0.5">
            PF, taxes, & unexcused leaves
          </span>
        </div>
      </div>

      {/* Payroll Records Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              {monthNames[selectedMonth - 1]} {selectedYear} Payroll Register
            </h2>
            <p className="text-xs text-slate-500">
              Formula: Net = (Paid Days × Per-Day) + (Extra Days × Per-Day) + (OT Hours × OT Rate) + Bonus − Deductions
            </p>
          </div>
          <button
            onClick={() => window.print()}
            className="no-print inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Payroll Sheet
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold">
              <tr>
                <th className="py-3 px-3">Employee</th>
                <th className="py-3 px-2 text-center" title="Standard Working Days">Std Days</th>
                <th className="py-3 px-2 text-center" title="Present Days">Pres</th>
                <th className="py-3 px-2 text-center" title="Leave Days">Leave</th>
                <th className="py-3 px-2 text-center" title="Absent Days">Abs</th>
                <th className="py-3 px-2 text-center" title="Overtime Hours">OT (h)</th>
                <th className="py-3 px-3 text-right">Per-Day (₹)</th>
                <th className="py-3 px-3 text-right">Basic (₹)</th>
                <th className="py-3 px-3 text-right">OT Pay (₹)</th>
                <th className="py-3 px-2 text-right">Bonus</th>
                <th className="py-3 px-2 text-right">Deduct</th>
                <th className="py-3 px-3 text-right font-black">Net Salary</th>
                <th className="py-3 px-2 text-center">Status</th>
                <th className="py-3 px-3 text-right no-print">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={14} className="py-12 text-center text-slate-400">
                    <span className="inline-block w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mr-2" />
                    Loading payroll data...
                  </td>
                </tr>
              ) : payrolls.length === 0 ? (
                <tr>
                  <td colSpan={14} className="py-12 text-center text-slate-400">
                    No payroll computed for {monthNames[selectedMonth - 1]} {selectedYear} yet.
                    <br />
                    Click <strong>"Run Auto-Calculation"</strong> above to compute from attendance records.
                  </td>
                </tr>
              ) : (
                payrolls.map((p) => (
                  <tr key={p.payroll_id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3 font-semibold text-slate-900 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <img
                          src={p.avatar_url || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150'}
                          alt={p.employee_name || p.employee_id}
                          className="w-7 h-7 rounded-full object-cover border border-slate-200"
                        />
                        <div>
                          <span className="font-bold text-slate-900 block">{p.employee_name}</span>
                          <span className="text-[10px] text-slate-400 font-mono block">{p.employee_id} • {p.department}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-2 text-center font-mono text-slate-600">{p.working_days}</td>
                    <td className="py-3 px-2 text-center font-mono font-bold text-emerald-600">{p.present_days}</td>
                    <td className="py-3 px-2 text-center font-mono text-amber-600">{p.leave_days}</td>
                    <td className="py-3 px-2 text-center font-mono font-bold text-rose-600">{p.absent_days}</td>
                    <td className="py-3 px-2 text-center font-mono font-bold text-sky-600">{p.overtime_hours}</td>
                    <td className="py-3 px-3 text-right font-mono text-slate-600">₹{p.per_day_salary}</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">₹{p.basic_salary.toLocaleString('en-IN')}</td>
                    <td className="py-3 px-3 text-right font-mono text-sky-700">₹{p.overtime_salary.toLocaleString('en-IN')}</td>
                    <td className="py-3 px-2 text-right font-mono text-emerald-600">+{p.bonus}</td>
                    <td className="py-3 px-2 text-right font-mono text-rose-600">-{p.deductions}</td>
                    <td className="py-3 px-3 text-right font-mono font-black text-indigo-900 text-sm whitespace-nowrap">
                      ₹{p.net_salary.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] uppercase tracking-wider ${
                        p.status === 'Finalized' ? 'bg-indigo-100 text-indigo-800' :
                        p.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right no-print whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedSlip(p);
                            setIsSlipOpen(true);
                          }}
                          title="View & Print Official Payslip"
                          className="px-2 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold text-[11px] flex items-center gap-1"
                        >
                          <Printer className="w-3 h-3" /> Slip
                        </button>
                        <button
                          onClick={() => openEditModal(p)}
                          title="Adjust Bonus / Deductions"
                          className="p-1 rounded text-slate-500 hover:text-amber-600 hover:bg-amber-50"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* EDIT BONUS & DEDUCTIONS MODAL */}
      {isEditModalOpen && editingPayroll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-indigo-600" />
                Adjust Salary Components: {editingPayroll.employee_name}
              </h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="mt-4 space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex justify-between py-1 text-slate-600">
                  <span>Basic Calculated:</span>
                  <span className="font-mono font-bold text-slate-900">₹{editingPayroll.basic_salary}</span>
                </div>
                <div className="flex justify-between py-1 text-slate-600">
                  <span>Overtime ({editingPayroll.overtime_hours} hrs):</span>
                  <span className="font-mono font-bold text-sky-600">+₹{editingPayroll.overtime_salary}</span>
                </div>
                {editingPayroll.extra_day_salary > 0 && (
                  <div className="flex justify-between py-1 text-slate-600">
                    <span>Extra Days ({editingPayroll.extra_working_days} d):</span>
                    <span className="font-mono font-bold text-indigo-600">+₹{editingPayroll.extra_day_salary}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Performance / Special Bonus (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={editBonus}
                  onChange={(e) => setEditBonus(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-emerald-700 font-mono font-bold text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Total Deductions (PF, Tax, Penalties) (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={editDeductions}
                  onChange={(e) => setEditDeductions(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-rose-700 font-mono font-bold text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Disbursement Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Draft">Draft</option>
                  <option value="Finalized">Finalized</option>
                  <option value="Paid">Paid</option>
                </select>
              </div>

              {/* Dynamic preview of recalculated net salary */}
              <div className="p-3 bg-indigo-950 text-white rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-indigo-300 uppercase block font-semibold">New Net Salary</span>
                  <span className="text-xs text-indigo-200">Auto-updated on submit</span>
                </div>
                <span className="text-xl font-black text-white">
                  ₹{(
                    editingPayroll.basic_salary + 
                    editingPayroll.extra_day_salary + 
                    editingPayroll.overtime_salary + 
                    editBonus - 
                    editDeductions
                  ).toLocaleString('en-IN')}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-md"
                >
                  Save Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REUSABLE SALARY SLIP MODAL */}
      <SalarySlipModal
        isOpen={isSlipOpen}
        onClose={() => setIsSlipOpen(false)}
        payroll={selectedSlip}
        companyInfo={companySettings}
      />
    </div>
  );
};
