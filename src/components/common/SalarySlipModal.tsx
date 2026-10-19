import React from 'react';
import { PayrollRecord } from '../../types.ts';
import { Printer, X, Building2, CheckCircle2, Shield, ArrowLeft } from 'lucide-react';

interface CompanyInfo {
  company_name?: string;
  company_address?: string;
  company_phone?: string;
  company_email?: string;
  currency_symbol?: string;
  [key: string]: string | undefined;
}

interface SalarySlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  payroll: PayrollRecord | null;
  companyInfo?: CompanyInfo;
}

export function SalarySlipModal({
  isOpen,
  onClose,
  payroll,
  companyInfo = {} as CompanyInfo
}: SalarySlipModalProps) {
  if (!isOpen || !payroll) return null;

  const currency = companyInfo.currency_symbol || '₹';
  const companyName = companyInfo.company_name || 'H.M. RAJPAL GARMENT SHOP';
  const companyAddress = companyInfo.company_address || 'Shop No. 12-14, Cloth Market, Main Bazaar';
  const companyPhone = companyInfo.company_phone || '+91 98234 56789';
  const companyEmail = companyInfo.company_email || 'contact@rajpalgarments.com';

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const salaryMonth = `${monthNames[payroll.month - 1]} ${payroll.year}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white text-slate-900 rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden my-8 border border-slate-200">
        {/* Top Control Bar (Hidden on print) */}
        <div className="no-print flex items-center justify-between px-5 py-3.5 bg-slate-900 text-white border-b border-slate-800">
          <div className="flex items-center gap-3">
            <button
              id="back-salary-slip-btn"
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold transition-all border border-slate-700 active:scale-95 shadow-sm"
              title="Go back to list"
            >
              <ArrowLeft className="w-4 h-4 text-slate-300" />
              <span>← Go Back</span>
            </button>
            <div className="h-4 w-px bg-slate-700 hidden sm:block" />
            <div className="hidden sm:flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-semibold tracking-wide uppercase text-slate-300">
                Official Salary Slip Preview
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              id="print-salary-slip-btn"
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / Save PDF
            </button>
            <button
              id="close-salary-slip-btn"
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Close window"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Official Printable Salary Slip Document */}
        <div id="printable-salary-slip" className="p-8 sm:p-10 bg-white">
          {/* Company Details Header */}
          <div className="border-b-2 border-slate-900 pb-6 mb-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl font-extrabold text-slate-950 tracking-tight">{companyName}</h1>
                  <p className="text-xs text-slate-600 mt-0.5">{companyAddress}</p>
                  <p className="text-xs text-slate-500">Contact: {companyPhone} | Email: {companyEmail}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="inline-block px-3 py-1 rounded bg-slate-100 text-slate-800 font-bold text-xs uppercase tracking-wider border border-slate-300">
                  Payslip
                </span>
                <p className="text-sm font-semibold text-slate-900 mt-1">{salaryMonth}</p>
                <p className="text-[11px] text-slate-500">Ref: SLIP-{payroll.payroll_id.toString().padStart(5, '0')}</p>
              </div>
            </div>
          </div>

          {/* Employee Details Grid */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 mb-6">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Employee Information
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-slate-500 block">Employee ID</span>
                <span className="font-bold text-slate-900">{payroll.employee_id}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Employee Name</span>
                <span className="font-bold text-slate-900">{payroll.employee_name || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Department</span>
                <span className="font-semibold text-slate-800">{payroll.department || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Designation</span>
                <span className="font-semibold text-slate-800">{payroll.designation || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Attendance Summary */}
          <div className="mb-6">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">
              Attendance Summary ({salaryMonth})
            </h2>
            <div className="grid grid-cols-3 sm:grid-cols-7 gap-2 text-center text-xs">
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                <span className="text-slate-500 block text-[11px]">Working Days</span>
                <span className="font-bold text-slate-900 text-sm">{payroll.working_days}</span>
              </div>
              <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-200 text-emerald-900">
                <span className="text-emerald-700 block text-[11px]">Present</span>
                <span className="font-bold text-sm">{payroll.present_days}</span>
              </div>
              <div className="bg-rose-50 p-2 rounded-lg border border-rose-200 text-rose-900">
                <span className="text-rose-700 block text-[11px]">Absent</span>
                <span className="font-bold text-sm">{payroll.absent_days}</span>
              </div>
              <div className="bg-amber-50 p-2 rounded-lg border border-amber-200 text-amber-900">
                <span className="text-amber-700 block text-[11px]">Leave</span>
                <span className="font-bold text-sm">{payroll.leave_days}</span>
              </div>
              <div className="bg-purple-50 p-2 rounded-lg border border-purple-200 text-purple-900">
                <span className="text-purple-700 block text-[11px]">Half Days</span>
                <span className="font-bold text-sm">{payroll.half_days}</span>
              </div>
              <div className="bg-sky-50 p-2 rounded-lg border border-sky-200 text-sky-900">
                <span className="text-sky-700 block text-[11px]">Overtime</span>
                <span className="font-bold text-sm">{payroll.overtime_hours} hrs</span>
              </div>
              <div className="bg-indigo-50 p-2 rounded-lg border border-indigo-200 text-indigo-900">
                <span className="text-indigo-700 block text-[11px]">Extra Days</span>
                <span className="font-bold text-sm">{payroll.extra_working_days}</span>
              </div>
            </div>
          </div>

          {/* Earnings & Deductions Tables */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
            {/* Earnings */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 font-bold text-xs uppercase tracking-wider text-slate-800">
                Earnings Breakdown
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                <div className="flex justify-between px-4 py-2 text-slate-700">
                  <span>Basic Working Salary</span>
                  <span className="font-semibold text-slate-900">{currency}{payroll.basic_salary.toLocaleString('en-IN')}</span>
                </div>
                {payroll.extra_day_salary > 0 && (
                  <div className="flex justify-between px-4 py-2 text-slate-700">
                    <span>Extra Day Pay ({payroll.extra_working_days} days)</span>
                    <span className="font-semibold text-slate-900">{currency}{payroll.extra_day_salary.toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="flex justify-between px-4 py-2 text-slate-700">
                  <span>Overtime Pay ({payroll.overtime_hours} hrs)</span>
                  <span className="font-semibold text-slate-900">{currency}{payroll.overtime_salary.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between px-4 py-2 text-slate-700">
                  <span>Performance / Special Bonus</span>
                  <span className="font-semibold text-emerald-600">+{currency}{payroll.bonus.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between px-4 py-2.5 bg-slate-50 font-bold text-slate-900 border-t border-slate-200">
                  <span>Gross Earnings</span>
                  <span>{currency}{(payroll.basic_salary + payroll.extra_day_salary + payroll.overtime_salary + payroll.bonus).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            {/* Deductions */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 font-bold text-xs uppercase tracking-wider text-slate-800">
                Deductions
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                <div className="flex justify-between px-4 py-2 text-slate-700">
                  <span>Provident Fund (PF) / Professional Tax</span>
                  <span className="font-semibold text-slate-900">{currency}{payroll.deductions.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between px-4 py-2 text-slate-700">
                  <span>Unpaid Leave / Absent Penalties</span>
                  <span className="font-semibold text-slate-900">{currency}0</span>
                </div>
                <div className="flex justify-between px-4 py-2 text-slate-400 italic">
                  <span>Other Statutory Deductions</span>
                  <span>{currency}0</span>
                </div>
                <div className="flex justify-between px-4 py-2.5 bg-slate-50 font-bold text-slate-900 border-t border-slate-200">
                  <span>Total Deductions</span>
                  <span className="text-rose-600">-{currency}{payroll.deductions.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Final Net Salary Box */}
          <div className="bg-indigo-900 text-white rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-semibold text-indigo-200 uppercase tracking-wider block">
                Final Take-Home / Net Salary
              </span>
              <p className="text-xs text-indigo-300 mt-0.5">
                Formula: Basic + Extra Day + Overtime + Bonus − Deductions
              </p>
            </div>
            <div className="text-right">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {currency}{payroll.net_salary.toLocaleString('en-IN')}
              </span>
              <div className="flex items-center gap-1 text-[11px] text-emerald-300 justify-end mt-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Status: {payroll.status}</span>
              </div>
            </div>
          </div>

          {/* Signatures & Disclaimers */}
          <div className="mt-8 pt-6 border-t border-slate-200 flex items-end justify-between text-xs text-slate-500">
            <div>
              <p className="font-semibold text-slate-700">Employer Signature</p>
              <div className="w-36 h-12 border-b border-slate-300 flex items-end pb-1 font-serif text-slate-400 italic">
                Authorized Signatory
              </div>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-slate-400">This is a system-generated salary slip and requires no physical signature.</p>
              <p className="text-[10px] text-slate-400 mt-0.5">H.M. RAJPAL GARMENT SHOP HRMS Portal • Generated {new Date(payroll.created_at).toLocaleDateString()}</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-slate-700">Employee Signature</p>
              <div className="w-36 h-12 border-b border-slate-300 flex items-end justify-end pb-1 font-serif text-slate-400 italic">
                Acknowledged
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Navigation & Action Bar (Hidden on print) */}
        <div className="no-print flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-200">
          <button
            id="bottom-back-salary-slip-btn"
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-bold shadow-sm transition-all active:scale-95"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600" />
            ← Go Back
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition-all active:scale-95"
            >
              <Printer className="w-4 h-4" />
              Print / Save PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
