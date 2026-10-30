import React, { useState, useEffect } from 'react';
import { getStoredAuthToken } from '../../utils/authToken.ts';
import { DollarSign, Calculator, Info, CheckCircle2, Shield, Calendar } from 'lucide-react';

export const EmployeeSalary: React.FC = () => {
  const [salaryData, setSalaryData] = useState<any>(null);
  const [selectedMonth, setSelectedMonth] = useState<number>(8); // Defaults to August
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSalary();
  }, [selectedMonth, selectedYear]);

  const fetchSalary = async () => {
    try {
      setIsLoading(true);
      const token = getStoredAuthToken();
      const res = await fetch(`/api/employee/salary?month=${selectedMonth}&year=${selectedYear}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setSalaryData(data);
    } catch (err) {
      console.error('Failed to load employee salary', err);
    } finally {
      setIsLoading(false);
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const details = salaryData?.details || {};

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">My Salary Breakdown</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Transparent view of your earnings, shift multipliers, overtime compensations, and net take-home salary.
          </p>
        </div>

        {/* Month Selector */}
        <div className="flex items-center gap-2">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            {monthNames.map((m, idx) => (
              <option key={m} value={idx + 1}>{m}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            {[2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
          <span className="inline-block w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mr-2" />
          Loading salary calculation...
        </div>
      ) : (
        <>
          {/* Status & Final Salary Card */}
          <div className="bg-gradient-to-r from-teal-900 via-slate-900 to-indigo-950 p-6 rounded-2xl text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-semibold text-teal-300 uppercase tracking-wider block">
                Take-Home Net Salary ({monthNames[selectedMonth - 1]} {selectedYear})
              </span>
              <span className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-1 block">
                ₹{(details.finalSalary || 0).toLocaleString('en-IN')}
              </span>
              <span className="text-xs text-slate-300 mt-1 block">
                Status: <strong className="text-emerald-400 font-semibold">{details.status || 'Verified'}</strong> • Formula: Basic + Extra Day + Overtime + Bonus − Deductions
              </span>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-xl border border-white/15 text-center">
              <span className="text-[10px] text-teal-200 uppercase tracking-wider block font-semibold">Per-Day Rate</span>
              <span className="text-xl font-black text-white font-mono mt-0.5 block">₹{details.perDaySalary}</span>
              <span className="text-[10px] text-teal-300 block">OT: ₹{details.overtimeRate}/hr</span>
            </div>
          </div>

          {/* Full Breakdown Parameter Grid */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
              Monthly Attendance & Computation Parameters
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block text-[11px]">Standard Working Days</span>
                <span className="text-lg font-bold text-slate-900 font-mono mt-0.5 block">{details.standardWorkingDays}</span>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950">
                <span className="text-emerald-700 block text-[11px]">Present Days</span>
                <span className="text-lg font-bold text-emerald-800 font-mono mt-0.5 block">{details.presentDays}</span>
              </div>
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-950">
                <span className="text-amber-700 block text-[11px]">Approved Leaves</span>
                <span className="text-lg font-bold text-amber-800 font-mono mt-0.5 block">{details.leaveDays}</span>
              </div>
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-950">
                <span className="text-rose-700 block text-[11px]">Absent Days</span>
                <span className="text-lg font-bold text-rose-800 font-mono mt-0.5 block">{details.absentDays}</span>
              </div>
              <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 text-purple-950">
                <span className="text-purple-700 block text-[11px]">Half Days</span>
                <span className="text-lg font-bold text-purple-800 font-mono mt-0.5 block">{details.halfDays || 0}</span>
              </div>
              <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-950">
                <span className="text-indigo-700 block text-[11px]">Extra Working Days</span>
                <span className="text-lg font-bold text-indigo-800 font-mono mt-0.5 block">{details.extraWorkingDays}</span>
              </div>
              <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-950">
                <span className="text-sky-700 block text-[11px]">Overtime Hours</span>
                <span className="text-lg font-bold text-sky-800 font-mono mt-0.5 block">{details.overtimeHours} hrs</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block text-[11px]">Effective Paid Days</span>
                <span className="text-lg font-bold text-slate-900 font-mono mt-0.5 block">{details.actualWorkingDays}</span>
              </div>
            </div>
          </div>

          {/* Mathematical Financial Breakdown */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-teal-600" />
              Formula & Financial Calculation Line Items
            </h2>

            <div className="space-y-3 text-xs">
              {/* Basic Salary */}
              <div className="p-3 rounded-xl bg-slate-50 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 block">Basic Working Salary</span>
                  <span className="text-[11px] text-slate-500">
                    Paid Working Days ({Math.min(details.actualWorkingDays, details.standardWorkingDays)}) × Per-Day Rate (₹{details.perDaySalary})
                  </span>
                </div>
                <span className="font-mono font-bold text-slate-900 text-sm">
                  ₹{(details.basicSalary || 0).toLocaleString('en-IN')}
                </span>
              </div>

              {/* Extra Day Salary */}
              {details.extraDaySalary > 0 && (
                <div className="p-3 rounded-xl bg-slate-50 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900 block">Extra Working Day Compensation</span>
                    <span className="text-[11px] text-slate-500">
                      Extra Days ({details.extraWorkingDays}) × Per-Day Rate (₹{details.perDaySalary})
                    </span>
                  </div>
                  <span className="font-mono font-bold text-indigo-700 text-sm">
                    +₹{(details.extraDaySalary || 0).toLocaleString('en-IN')}
                  </span>
                </div>
              )}

              {/* Overtime Salary */}
              <div className="p-3 rounded-xl bg-slate-50 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 block">Overtime Salary</span>
                  <span className="text-[11px] text-slate-500">
                    Overtime Hours ({details.overtimeHours} hrs) × Overtime Rate (₹{details.overtimeRate}/hr)
                  </span>
                </div>
                <span className="font-mono font-bold text-sky-700 text-sm">
                  +₹{(details.overtimeSalary || 0).toLocaleString('en-IN')}
                </span>
              </div>

              {/* Bonus */}
              <div className="p-3 rounded-xl bg-slate-50 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 block">Performance / Special Allowances</span>
                  <span className="text-[11px] text-slate-500">Authorized administrative bonus credit</span>
                </div>
                <span className="font-mono font-bold text-emerald-600 text-sm">
                  +₹{(details.bonus || 0).toLocaleString('en-IN')}
                </span>
              </div>

              {/* Deductions */}
              <div className="p-3 rounded-xl bg-slate-50 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 block">Deductions</span>
                  <span className="text-[11px] text-slate-500">PF, Professional Tax, & authorized withholdings</span>
                </div>
                <span className="font-mono font-bold text-rose-600 text-sm">
                  -₹{(details.deductions || 0).toLocaleString('en-IN')}
                </span>
              </div>

              {/* Total Final Line */}
              <div className="p-4 rounded-xl bg-slate-900 text-white flex items-center justify-between">
                <div>
                  <span className="font-black text-sm uppercase tracking-wider block">Net Take-Home Total</span>
                  <span className="text-[10px] text-slate-400">Total credited to bank account</span>
                </div>
                <span className="font-mono font-extrabold text-xl sm:text-2xl text-teal-300">
                  ₹{(details.finalSalary || 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
