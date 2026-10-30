import React, { useState, useEffect } from 'react';
import { AttendanceRecord } from '../../types.ts';
import { getBusinessDateParts, getWeekdayName } from '../../../shared/businessDate.ts';
import { getStoredAuthToken } from '../../utils/authToken.ts';
import { Calendar, CheckCircle2, Clock, Info, Shield } from 'lucide-react';

export const EmployeeAttendance: React.FC = () => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<number>(() => getBusinessDateParts().month);
  const [selectedYear, setSelectedYear] = useState<number>(() => getBusinessDateParts().year);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAttendance();
  }, [selectedMonth, selectedYear]);

  const fetchAttendance = async () => {
    try {
      setIsLoading(true);
      const token = getStoredAuthToken();
      const res = await fetch(`/api/employee/attendance?month=${selectedMonth}&year=${selectedYear}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setRecords(data.attendance || []);
    } catch (err) {
      console.error('Failed to load employee attendance', err);
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">My Attendance Log</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Verified records of your shift check-ins, recorded working hours, and approved overtime.
          </p>
        </div>

        {/* Month / Year Selector */}
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

      {/* Strict RBAC Read-Only Notice */}
      <div className="p-3.5 bg-teal-50 border border-teal-200 rounded-xl text-xs text-teal-900 flex items-start gap-2.5">
        <Shield className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="font-bold block text-teal-950">Read-Only Employee Access</strong>
          In compliance with organizational RBAC policy, attendance records are strictly verified and maintained by the HR and Administration Department. If you spot a discrepancy, please reach out to your HR manager.
        </div>
      </div>

      {/* Attendance History Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Day of the Week</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Working Hours</th>
                <th className="py-3 px-4 text-center">Overtime Hours</th>
                <th className="py-3 px-4">Notes / Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Loading your attendance history...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No attendance records found for {monthNames[selectedMonth - 1]} {selectedYear}.
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.attendance_id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                      {r.date}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-700">
                      {r.day || getWeekdayName(r.date, 'long')}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wider ${
                        r.status === 'Present' ? 'bg-emerald-100 text-emerald-800' :
                        r.status === 'Absent' ? 'bg-rose-100 text-rose-800' :
                        r.status === 'Half Day' ? 'bg-purple-100 text-purple-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">
                      {r.working_hours} hrs
                    </td>
                    <td className="py-3 px-4 text-center font-mono">
                      {r.overtime_hours > 0 ? (
                        <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-800 font-bold text-[11px]">
                          +{r.overtime_hours} hrs
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {r.notes || '-'}
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
