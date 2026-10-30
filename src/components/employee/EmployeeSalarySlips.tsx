import React, { useState, useEffect } from 'react';
import { PayrollRecord } from '../../types.ts';
import { getStoredAuthToken } from '../../utils/authToken.ts';
import { SalarySlipModal } from '../common/SalarySlipModal.tsx';
import { FileText, Printer, CheckCircle2, Building2 } from 'lucide-react';

export const EmployeeSalarySlips: React.FC = () => {
  const [slips, setSlips] = useState<PayrollRecord[]>([]);
  const [selectedSlip, setSelectedSlip] = useState<PayrollRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [companySettings, setCompanySettings] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSlips();
  }, []);

  const fetchSlips = async () => {
    try {
      setIsLoading(true);
      const token = getStoredAuthToken();
      const res = await fetch('/api/employee/salary-slips', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setSlips(data.salarySlips || []);
    } catch (err) {
      console.error('Error fetching slips', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenSlip = async (payrollId: number | string) => {
    try {
      const token = getStoredAuthToken();
      const res = await fetch(`/api/employee/salary-slips/${payrollId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.salarySlip) {
        setSelectedSlip(data.salarySlip);
        setCompanySettings(data.company || {});
        setIsModalOpen(true);
      }
    } catch (err) {
      console.error('Failed to load slip', err);
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Official Salary Slips</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Download, preview, and print verifiable corporate payslips with itemized deductions and earnings.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {isLoading ? (
          <div className="col-span-2 p-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
            Loading your salary slips...
          </div>
        ) : slips.length === 0 ? (
          <div className="col-span-2 p-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
            No salary slips available yet. Slips appear here once administration finalizes your monthly payroll.
          </div>
        ) : (
          slips.map((s) => (
            <div
              key={s.payroll_id}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-teal-600 uppercase tracking-wider">
                    Payslip Voucher
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    {s.status}
                  </span>
                </div>
                <h2 className="text-lg font-black text-slate-900 mt-1">
                  {monthNames[s.month - 1]} {s.year}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ref: SLIP-{s.payroll_id.toString().padStart(5, '0')}
                </p>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase block font-medium">Net Disbursed</span>
                    <span className="text-xl font-black text-slate-900 font-mono">
                      ₹{s.net_salary.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <button
                    onClick={() => handleOpenSlip(s.payroll_id)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-md shadow-teal-600/20 transition-all"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print / View Slip
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <SalarySlipModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        payroll={selectedSlip}
        companyInfo={companySettings}
      />
    </div>
  );
};
