import React, { useState, useEffect } from 'react';
import { getStoredAuthToken } from '../../utils/authToken.ts';
import { getBusinessDateParts } from '../../../shared/businessDate.ts';
import { Printer, Download, Filter, BarChart3, Clock, DollarSign, Calendar } from 'lucide-react';

export const ReportsManagement: React.FC = () => {
  const [reportType, setReportType] = useState<'attendance' | 'salary' | 'overtime'>('attendance');
  const [selectedMonth, setSelectedMonth] = useState<number>(() => getBusinessDateParts().month);
  const [selectedYear, setSelectedYear] = useState<number>(() => getBusinessDateParts().year);
  const [selectedDept, setSelectedDept] = useState('All');
  const [data, setData] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchReport();
  }, [reportType, selectedMonth, selectedYear, selectedDept]);

  const fetchReport = async () => {
    try {
      setIsLoading(true);
      const token = getStoredAuthToken();
      const params = new URLSearchParams({
        type: reportType,
        month: String(selectedMonth),
        year: String(selectedYear),
      });
      if (selectedDept !== 'All') params.append('department', selectedDept);

      const res = await fetch(`/api/admin/reports?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const resData = await res.json();
      setData(resData.data || []);
      setSummary(resData.summary || {});
    } catch (err) {
      console.error('Error fetching report', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map((row) =>
        headers.map((h) => JSON.stringify(row[h] ?? '')).join(',')
      ),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportType}_report_${selectedMonth}_${selectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const departments = ['All', 'Sales', 'Billing', 'Cashier', 'Stock Management', 'Store Manager'];
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Executive Reports & Audits</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Generate and export comprehensive compliance reports for attendance records, payroll disbursements, and overtime expenditures.
          </p>
        </div>
        <div className="flex items-center gap-2 no-print">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print Report
          </button>
          <button
            onClick={handleExportCSV}
            disabled={data.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filter and Report Type Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col lg:flex-row gap-4 items-center justify-between no-print">
        {/* Report Type Selector */}
        <div className="flex items-center p-1 bg-slate-100 rounded-xl w-full lg:w-auto text-xs font-bold">
          <button
            onClick={() => setReportType('attendance')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              reportType === 'attendance' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'
            }`}
          >
            Attendance Report
          </button>
          <button
            onClick={() => setReportType('salary')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              reportType === 'salary' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'
            }`}
          >
            Salary / Payroll Report
          </button>
          <button
            onClick={() => setReportType('overtime')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              reportType === 'overtime' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'
            }`}
          >
            Overtime Report
          </button>
        </div>

        {/* Period & Department */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Month:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-bold focus:outline-none"
            >
              {monthNames.map((m, idx) => (
                <option key={m} value={idx + 1}>{m}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Year:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-bold focus:outline-none"
            >
              {[2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Department:</span>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium focus:outline-none"
            >
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {reportType === 'attendance' && (
          <>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Total Tracked</span>
              <span className="text-2xl font-black text-slate-900 block mt-1">{summary.totalRecords || 0}</span>
              <span className="text-[11px] text-slate-500 font-medium block">Logged days</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Present Entries</span>
              <span className="text-2xl font-black text-emerald-600 block mt-1">{summary.totalPresent || 0}</span>
              <span className="text-[11px] text-slate-500 font-medium block">Full shifts worked</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Absent Entries</span>
              <span className="text-2xl font-black text-rose-600 block mt-1">{summary.totalAbsent || 0}</span>
              <span className="text-[11px] text-slate-500 font-medium block">Unattended shifts</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Total Overtime</span>
              <span className="text-2xl font-black text-sky-600 block mt-1">{summary.totalOvertimeHours || 0} hrs</span>
              <span className="text-[11px] text-slate-500 font-medium block">Extra logged hours</span>
            </div>
          </>
        )}

        {reportType === 'salary' && (
          <>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Total Net Payroll</span>
              <span className="text-xl sm:text-2xl font-black text-indigo-950 block mt-1">₹{(summary.totalNetSalary || 0).toLocaleString('en-IN')}</span>
              <span className="text-[11px] text-slate-500 font-medium block">Disbursed amount</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Basic Payroll</span>
              <span className="text-xl sm:text-2xl font-black text-slate-800 block mt-1">₹{(summary.totalBasicSalary || 0).toLocaleString('en-IN')}</span>
              <span className="text-[11px] text-slate-500 font-medium block">Base compensation</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Overtime Paid</span>
              <span className="text-xl sm:text-2xl font-black text-sky-600 block mt-1">₹{(summary.totalOvertimeSalary || 0).toLocaleString('en-IN')}</span>
              <span className="text-[11px] text-slate-500 font-medium block">Extra hour wages</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Withheld Deductions</span>
              <span className="text-xl sm:text-2xl font-black text-rose-600 block mt-1">₹{(summary.totalDeductions || 0).toLocaleString('en-IN')}</span>
              <span className="text-[11px] text-slate-500 font-medium block">Statutory / penalty</span>
            </div>
          </>
        )}

        {reportType === 'overtime' && (
          <>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Overtime Incidents</span>
              <span className="text-2xl font-black text-slate-900 block mt-1">{summary.totalOvertimeIncidents || 0}</span>
              <span className="text-[11px] text-slate-500 font-medium block">Logged OT events</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Total Hours</span>
              <span className="text-2xl font-black text-sky-600 block mt-1">{summary.totalHours || 0} hrs</span>
              <span className="text-[11px] text-slate-500 font-medium block">Accumulated extra hours</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Est. Financial Cost</span>
              <span className="text-xl sm:text-2xl font-black text-amber-600 block mt-1">₹{(summary.totalCost || 0).toLocaleString('en-IN')}</span>
              <span className="text-[11px] text-slate-500 font-medium block">Overtime cost</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Employees Active</span>
              <span className="text-2xl font-black text-emerald-600 block mt-1">{summary.employeesCount || 0}</span>
              <span className="text-[11px] text-slate-500 font-medium block">Working overtime</span>
            </div>
          </>
        )}
      </div>

      {/* Report Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            {reportType.toUpperCase()} AUDIT TABLE: {monthNames[selectedMonth - 1]} {selectedYear}
          </h2>
          <span className="text-xs text-slate-500 font-medium">Department Filter: {selectedDept}</span>
        </div>

        <div className="overflow-x-auto">
          {reportType === 'attendance' && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Employee ID</th>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Working Hours</th>
                  <th className="py-3 px-4 text-center">Overtime Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr><td colSpan={7} className="py-8 text-center text-slate-400">Loading records...</td></tr>
                ) : data.length === 0 ? (
                  <tr><td colSpan={7} className="py-8 text-center text-slate-400">No records found.</td></tr>
                ) : (
                  data.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-mono">{r.date}</td>
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-800">{r.employee_id}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900">{r.employee_name}</td>
                      <td className="py-2.5 px-4 text-slate-600">{r.department}</td>
                      <td className="py-2.5 px-4 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100">{r.status}</span>
                      </td>
                      <td className="py-2.5 px-4 text-center font-mono">{r.working_hours}h</td>
                      <td className="py-2.5 px-4 text-center font-mono font-bold text-sky-600">{r.overtime_hours}h</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {reportType === 'salary' && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold">
                <tr>
                  <th className="py-3 px-4">Employee ID</th>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4 text-center">Present Days</th>
                  <th className="py-3 px-4 text-center">OT Hours</th>
                  <th className="py-3 px-4 text-right">Basic (₹)</th>
                  <th className="py-3 px-4 text-right">OT Pay (₹)</th>
                  <th className="py-3 px-4 text-right">Bonus (₹)</th>
                  <th className="py-3 px-4 text-right">Deductions (₹)</th>
                  <th className="py-3 px-4 text-right font-black">Net Salary (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr><td colSpan={10} className="py-8 text-center text-slate-400">Loading payroll records...</td></tr>
                ) : data.length === 0 ? (
                  <tr><td colSpan={10} className="py-8 text-center text-slate-400">No payroll data for this selection.</td></tr>
                ) : (
                  data.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-800">{r.employee_id}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900">{r.employee_name}</td>
                      <td className="py-2.5 px-4 text-slate-600">{r.department}</td>
                      <td className="py-2.5 px-4 text-center font-mono font-bold text-emerald-600">{r.present_days}</td>
                      <td className="py-2.5 px-4 text-center font-mono font-bold text-sky-600">{r.overtime_hours}</td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold">₹{r.basic_salary?.toLocaleString('en-IN')}</td>
                      <td className="py-2.5 px-4 text-right font-mono text-sky-600">₹{r.overtime_salary?.toLocaleString('en-IN')}</td>
                      <td className="py-2.5 px-4 text-right font-mono text-emerald-600">+{r.bonus}</td>
                      <td className="py-2.5 px-4 text-right font-mono text-rose-600">-{r.deductions}</td>
                      <td className="py-2.5 px-4 text-right font-mono font-black text-indigo-900">₹{r.net_salary?.toLocaleString('en-IN')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {reportType === 'overtime' && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4 text-center">OT Hours</th>
                  <th className="py-3 px-4 text-right">Hourly Rate</th>
                  <th className="py-3 px-4 text-right">Computed Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr><td colSpan={6} className="py-8 text-center text-slate-400">Loading overtime records...</td></tr>
                ) : data.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-slate-400">No overtime records logged.</td></tr>
                ) : (
                  data.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-mono">{r.date}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900">{r.employee_name} ({r.employee_id})</td>
                      <td className="py-2.5 px-4 text-slate-600">{r.department}</td>
                      <td className="py-2.5 px-4 text-center font-mono font-bold text-sky-600">{r.overtime_hours} hrs</td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-600">₹{r.overtime_rate}/hr</td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-amber-600">₹{r.computed_ot_pay?.toLocaleString('en-IN')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
