import React, { useState, useEffect } from 'react';
import { PayrollRecord } from '../../types.ts';
import { Award, CheckCircle2, Clock, Calendar, Shield } from 'lucide-react';

export const EmployeePayroll: React.FC = () => {
  const [payrollHistory, setPayrollHistory] = useState<PayrollRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchPayroll();
  }, []);

  const fetchPayroll = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('erp_token');
      const res = await fetch('/api/employee/payroll', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setPayrollHistory(data.payroll || []);
    } catch (err) {
      console.error('Failed to load employee payroll', err);
    } finally {
      setIsLoading(false);
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">My Payroll History</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Archived monthly disbursement records, finalized earnings, and compliance status.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold">
              <tr>
                <th className="py-3 px-4">Period</th>
                <th className="py-3 px-4 text-center">Working Days</th>
                <th className="py-3 px-4 text-center">Present</th>
                <th className="py-3 px-4 text-center">Overtime</th>
                <th className="py-3 px-4 text-right">Basic Salary</th>
                <th className="py-3 px-4 text-right">Bonus</th>
                <th className="py-3 px-4 text-right">Deductions</th>
                <th className="py-3 px-4 text-right font-black">Net Salary</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Loading payroll history...
                  </td>
                </tr>
              ) : payrollHistory.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No finalized payroll records found on your profile yet.
                  </td>
                </tr>
              ) : (
                payrollHistory.map((p) => (
                  <tr key={p.payroll_id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {monthNames[p.month - 1]} {p.year}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-slate-600">{p.working_days}</td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-emerald-600">{p.present_days}</td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-sky-600">{p.overtime_hours} hrs</td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-slate-800">
                      ₹{p.basic_salary.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-600">+{p.bonus}</td>
                    <td className="py-3 px-4 text-right font-mono text-rose-600">-{p.deductions}</td>
                    <td className="py-3 px-4 text-right font-mono font-black text-teal-900 text-sm">
                      ₹{p.net_salary.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] uppercase tracking-wider ${
                        p.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-teal-100 text-teal-800'
                      }`}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
