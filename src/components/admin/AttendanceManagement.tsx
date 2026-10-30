import React, { useState, useEffect, useMemo } from 'react';
import { AttendanceRecord, Employee, AttendanceStatus, RosterEmployeeRow } from '../../types.ts';
import { addCalendarDays, getBusinessDate, getBusinessDateParts } from '../../../shared/businessDate.ts';
import {
  ATTENDANCE_PAGE_SIZE_DEFAULT,
  ATTENDANCE_PAGE_SIZE_MAX,
  EMPLOYEE_PAGE_SIZE_MAX,
} from '../../../shared/pagination.ts';
import { 
  Calendar as CalendarIcon, CheckCircle2, Clock, 
  Edit2, Trash2, Users, CheckCheck, 
  Search, X, Check, AlertCircle, Sparkles, Filter,
  Save, RotateCcw, ChevronLeft, ChevronRight, UserPlus, SlidersHorizontal
} from 'lucide-react';

export const AttendanceManagement: React.FC = () => {
  // Navigation & Tabs
  // Default to 'roster' (line-by-line entry) as requested by user
  const [activeTab, setActiveTab] = useState<'roster' | 'records' | 'calendar'>('roster');

  // Date selection
  const todayStr = getBusinessDate();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Line-by-Line Roster state
  const [roster, setRoster] = useState<RosterEmployeeRow[]>([]);
  const [rosterSummary, setRosterSummary] = useState({
    totalWorkers: 0,
    presentCount: 0,
    absentCount: 0,
    halfDayCount: 0,
    leaveCount: 0,
    unmarkedCount: 0,
  });
  const [isRosterLoading, setIsRosterLoading] = useState(false);
  const [isSavingBatch, setIsSavingBatch] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Roster Filters
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterDeptFilter, setRosterDeptFilter] = useState('All');
  const [rosterStatusFilter, setRosterStatusFilter] = useState('All');

  // Table & Calendar records state
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isRecordsLoading, setIsRecordsLoading] = useState(false);
  const [filterMode, setFilterMode] = useState<'date' | 'month' | 'range'>('date');
  const [selectedMonth, setSelectedMonth] = useState<number>(() => getBusinessDateParts().month);
  const [selectedYear, setSelectedYear] = useState<number>(() => getBusinessDateParts().year);
  const [rangeStartDate, setRangeStartDate] = useState(todayStr);
  const [rangeEndDate, setRangeEndDate] = useState(todayStr);
  const [recordsPage, setRecordsPage] = useState(1);
  const [recordsTotal, setRecordsTotal] = useState(0);
  const [empFilter, setEmpFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Single Edit Modal state
  const [isMarkModalOpen, setIsMarkModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [modalFormData, setModalFormData] = useState<{
    employee_id: string;
    date: string;
    status: AttendanceStatus;
    working_hours: number;
    overtime_hours: number;
    notes: string;
  }>({
    employee_id: '',
    date: todayStr,
    status: 'Present',
    working_hours: 8,
    overtime_hours: 0,
    notes: '',
  });

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Load initial data
  useEffect(() => {
    fetchEmployees();
  }, []);

  // Fetch roster whenever selectedDate changes or activeTab is 'roster'
  useEffect(() => {
    if (activeTab === 'roster') {
      fetchRoster(selectedDate);
    } else if (activeTab === 'records' || activeTab === 'calendar') {
      fetchAttendanceRecords();
    }
  }, [
    selectedDate,
    activeTab,
    filterMode,
    selectedMonth,
    selectedYear,
    rangeStartDate,
    rangeEndDate,
    empFilter,
    statusFilter,
    recordsPage,
  ]);

  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem('erp_token');
      const firstParams = new URLSearchParams({
        page: '1',
        limit: String(EMPLOYEE_PAGE_SIZE_MAX),
      });
      const res = await fetch(`/api/admin/employees?${firstParams.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch employees.');
      const pageCount = Math.ceil(data.total / data.limit);
      const remainingPages = await Promise.all(
        Array.from({ length: Math.max(0, pageCount - 1) }, async (_, index) => {
          const pageParams = new URLSearchParams({
            page: String(index + 2),
            limit: String(EMPLOYEE_PAGE_SIZE_MAX),
          });
          const pageResponse = await fetch(`/api/admin/employees?${pageParams.toString()}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const pageData = await pageResponse.json();
          if (!pageResponse.ok) throw new Error(pageData.error || 'Failed to fetch employee page.');
          return pageData.data || [];
        })
      );
      setEmployees([...(data.data || []), ...remainingPages.flat()]);
    } catch (err) {
      console.error('Error loading employees', err);
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error loading employees.',
      });
    }
  };

  // Fetch line-by-line roster for the selected date
  const fetchRoster = async (date: string) => {
    try {
      setIsRosterLoading(true);
      const token = localStorage.getItem('erp_token');
      const res = await fetch(`/api/admin/attendance/roster?date=${date}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch roster.');

      const mapped = (data.roster || []).map((r: any) => ({
        ...r,
        is_dirty: false,
      }));
      setRoster(mapped);
      if (data.summary) {
        setRosterSummary(data.summary);
      }
      setHasUnsavedChanges(false);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error loading attendance roster.' });
    } finally {
      setIsRosterLoading(false);
    }
  };

  // Fetch records for history table
  const fetchAttendanceRecords = async () => {
    try {
      setIsRecordsLoading(true);
      const token = localStorage.getItem('erp_token');
      const params = new URLSearchParams();

      if (filterMode === 'date' && selectedDate) {
        params.append('date', selectedDate);
      } else if (filterMode === 'month') {
        const monthPrefix = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
        const lastDay = new Date(Date.UTC(selectedYear, selectedMonth, 0)).getUTCDate();
        params.append('start_date', `${monthPrefix}-01`);
        params.append('end_date', `${monthPrefix}-${String(lastDay).padStart(2, '0')}`);
      } else {
        if (rangeStartDate) params.append('start_date', rangeStartDate);
        if (rangeEndDate) params.append('end_date', rangeEndDate);
      }

      if (empFilter !== 'All') params.append('employee_id', empFilter);
      if (statusFilter !== 'All') params.append('status', statusFilter);
      const isCalendarView = activeTab === 'calendar';
      const pageLimit = isCalendarView ? ATTENDANCE_PAGE_SIZE_MAX : ATTENDANCE_PAGE_SIZE_DEFAULT;
      params.append('page', String(isCalendarView ? 1 : recordsPage));
      params.append('limit', String(pageLimit));

      const res = await fetch(`/api/admin/attendance?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch attendance.');
      setRecordsTotal(data.total);
      const totalPages = Math.max(1, Math.ceil(data.total / data.limit));
      if (!isCalendarView && recordsPage > totalPages) {
        setRecordsPage(totalPages);
        return;
      }

      if (isCalendarView && totalPages > 1) {
        const remainingPages = await Promise.all(
          Array.from({ length: totalPages - 1 }, async (_, index) => {
            const pageParams = new URLSearchParams(params);
            pageParams.set('page', String(index + 2));
            const pageResponse = await fetch(`/api/admin/attendance?${pageParams.toString()}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const pageData = await pageResponse.json();
            if (!pageResponse.ok) {
              throw new Error(pageData.error || 'Failed to fetch attendance page.');
            }
            return pageData.data || [];
          })
        );
        setRecords([...(data.data || []), ...remainingPages.flat()]);
      } else {
        setRecords(data.data || []);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to fetch attendance.' });
    } finally {
      setIsRecordsLoading(false);
    }
  };

  // ==========================================
  // ROSTER LINE-BY-LINE HANDLERS
  // ==========================================
  const handleRosterStatusChange = (empId: string, newStatus: AttendanceStatus) => {
    setRoster((prev) =>
      prev.map((row) => {
        if (row.employee_id !== empId) return row;
        let hrs = row.working_hours;
        let ot = row.overtime_hours;
        if (newStatus === 'Present') {
          hrs = hrs === 0 ? 8 : hrs;
        } else if (newStatus === 'Half Day') {
          hrs = 4;
        } else if (newStatus === 'Absent') {
          hrs = 0;
          ot = 0;
        } else if (newStatus === 'Leave') {
          hrs = 8;
          ot = 0;
        }
        return {
          ...row,
          status: newStatus,
          working_hours: hrs,
          overtime_hours: ot,
          is_dirty: true,
        };
      })
    );
    setHasUnsavedChanges(true);
  };

  const handleRosterHoursChange = (empId: string, hours: number) => {
    setRoster((prev) =>
      prev.map((row) =>
        row.employee_id === empId && row.status !== 'Unmarked'
          ? { ...row, working_hours: isNaN(hours) ? 0 : hours, is_dirty: true }
          : row
      )
    );
    setHasUnsavedChanges(true);
  };

  const handleRosterOtChange = (empId: string, ot: number) => {
    setRoster((prev) =>
      prev.map((row) =>
        row.employee_id === empId && row.status !== 'Unmarked'
          ? { ...row, overtime_hours: isNaN(ot) ? 0 : ot, is_dirty: true }
          : row
      )
    );
    setHasUnsavedChanges(true);
  };

  const handleRosterNotesChange = (empId: string, notes: string) => {
    setRoster((prev) =>
      prev.map((row) =>
        row.employee_id === empId && row.status !== 'Unmarked'
          ? { ...row, notes, is_dirty: true }
          : row
      )
    );
    setHasUnsavedChanges(true);
  };

  // Bulk actions on roster
  const handleBulkMarkAll = (targetStatus: AttendanceStatus) => {
    setRoster((prev) =>
      prev.map((row) => {
        // Only modify if matches filter or all
        let hrs = 8;
        if (targetStatus === 'Absent') hrs = 0;
        if (targetStatus === 'Half Day') hrs = 4;
        return {
          ...row,
          status: targetStatus,
          working_hours: hrs,
          overtime_hours: targetStatus === 'Absent' || targetStatus === 'Leave' ? 0 : row.overtime_hours,
          is_dirty: true,
        };
      })
    );
    setHasUnsavedChanges(true);
  };

  const handleMarkUnmarkedPresent = () => {
    setRoster((prev) =>
      prev.map((row) => {
        if (row.status === 'Unmarked') {
          return {
            ...row,
            status: 'Present',
            working_hours: 8,
            is_dirty: true,
          };
        }
        return row;
      })
    );
    setHasUnsavedChanges(true);
  };

  // Only marked attendance rows are eligible for bulk save.
  const handleSaveAllRoster = async () => {
    try {
      setIsSavingBatch(true);
      const token = localStorage.getItem('erp_token');
      
      // Get all rows that are either dirty or currently marked
      const rowsToSave = roster.filter((row) => row.status !== 'Unmarked');
      if (rowsToSave.length === 0) {
        const hasUnmarkedChanges = roster.some((row) => row.is_dirty && row.status === 'Unmarked');
        setFeedback({
          type: hasUnmarkedChanges ? 'error' : 'success',
          message: hasUnmarkedChanges
            ? 'Choose an attendance status before saving these changes.'
            : 'No attendance changes to save.',
        });
        return;
      }

      const payload = {
        date: selectedDate,
        records: rowsToSave.map((r) => ({
          employee_id: r.employee_id,
          status: r.status,
          working_hours: r.working_hours,
          overtime_hours: r.overtime_hours,
          notes: r.notes || '',
        })),
      };

      const res = await fetch('/api/admin/attendance/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save batch attendance.');

      setFeedback({ type: 'success', message: data.message });
      setHasUnsavedChanges(false);
      // Reload roster to get updated DB timestamps
      fetchRoster(selectedDate);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error saving line-by-line attendance.' });
    } finally {
      setIsSavingBatch(false);
    }
  };

  // Save a single row inline
  const handleSaveSingleRow = async (empId: string) => {
    const row = roster.find((r) => r.employee_id === empId);
    if (!row) return;
    if (row.status === 'Unmarked') {
      setFeedback({ type: 'error', message: 'Choose an attendance status before saving this row.' });
      return;
    }

    try {
      const token = localStorage.getItem('erp_token');
      const res = await fetch('/api/admin/attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          employee_id: row.employee_id,
          date: selectedDate,
          status: row.status,
          working_hours: row.working_hours,
          overtime_hours: row.overtime_hours,
          notes: row.notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save row');

      setRoster((prev) =>
        prev.map((r) => (r.employee_id === empId ? { ...r, is_dirty: false } : r))
      );
      setFeedback({ type: 'success', message: `Saved attendance for ${row.name}.` });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

 
  // Date stepper
  const changeDateBy = (days: number) => {
    if (hasUnsavedChanges) {
      if (!window.confirm('You have unsaved line-by-line attendance changes. Discard and switch date?')) {
        return;
      }
    }
    setSelectedDate(addCalendarDays(selectedDate, days));
  };

  // Filtered roster rows
  const filteredRoster = useMemo(() => {
    return roster.filter((row) => {
      const matchSearch =
        !rosterSearch ||
        row.name.toLowerCase().includes(rosterSearch.toLowerCase()) ||
        row.employee_id.toLowerCase().includes(rosterSearch.toLowerCase()) ||
        row.designation.toLowerCase().includes(rosterSearch.toLowerCase());

      const matchDept = rosterDeptFilter === 'All' || row.department === rosterDeptFilter;
      const matchStatus =
        rosterStatusFilter === 'All' ||
        (rosterStatusFilter === 'Unmarked'
          ? row.status === 'Unmarked'
          : row.status === rosterStatusFilter);

      return matchSearch && matchDept && matchStatus;
    });
  }, [roster, rosterSearch, rosterDeptFilter, rosterStatusFilter]);

  // Unique departments in roster
  const departments = useMemo(() => {
    const set = new Set<string>();
    roster.forEach((r) => { if (r.department) set.add(r.department); });
    return Array.from(set).sort();
  }, [roster]);

  // Computed live status counts of current roster
  const liveCounts = useMemo(() => {
    let p = 0;
    let a = 0;
    let h = 0;
    let l = 0;
    let u = 0;
    let dirtyCount = 0;

    roster.forEach((r) => {
      if (r.is_dirty) dirtyCount++;
      if (r.status === 'Present') p++;
      else if (r.status === 'Absent') a++;
      else if (r.status === 'Half Day') h++;
      else if (r.status === 'Leave') l++;
      else u++;
    });

    return {
      total: roster.length,
      present: p,
      absent: a,
      halfDay: h,
      leave: l,
      unmarked: u,
      dirtyCount,
    };
  }, [roster]);

  // Single modal handlers
  const handleSingleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('erp_token');
      const res = await fetch('/api/admin/attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(modalFormData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save attendance record');

      setFeedback({ type: 'success', message: data.message });
      setIsMarkModalOpen(false);
      setEditingRecord(null);
      if (activeTab === 'roster') fetchRoster(selectedDate);
      else fetchAttendanceRecords();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleDeleteRecord = async (attendanceId: number | string) => {
    if (!window.confirm('Delete this attendance record?')) return;
    try {
      const token = localStorage.getItem('erp_token');
      const res = await fetch(`/api/admin/attendance/${attendanceId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete attendance record');

      setFeedback({ type: 'success', message: data.message });
      fetchAttendanceRecords();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const openMarkModalForEdit = (rec: AttendanceRecord) => {
    setEditingRecord(rec);
    setModalFormData({
      employee_id: rec.employee_id,
      date: rec.date,
      status: rec.status,
      working_hours: rec.working_hours,
      overtime_hours: rec.overtime_hours,
      notes: rec.notes || '',
    });
    setIsMarkModalOpen(true);
  };

  const openMarkModalForNew = () => {
    setEditingRecord(null);
    setModalFormData({
      employee_id: employees[0]?.employee_id || '',
      date: selectedDate,
      status: 'Present',
      working_hours: 8,
      overtime_hours: 0,
      notes: '',
    });
    setIsMarkModalOpen(true);
  };

  // Calendar matrix days
  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const dayNumbers = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="space-y-5">
      {/* Top Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Attendance Roster & Daily Log
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-700">
              {roster.length} Staff
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Line-by-line roster attendance entry for 100+ garment workers. Mark status, adjust shift hours, record overtime, and save in bulk.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-2">
          <div className="grid grid-cols-3 p-1 bg-slate-200/80 rounded-xl text-xs font-bold text-slate-600">
            <button
              id="view-roster-tab"
              onClick={() => setActiveTab('roster')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'roster'
                  ? 'bg-white text-indigo-600 shadow-sm font-black'
                  : 'hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Line-by-Line Roster
            </button>
            <button
              id="view-records-tab"
              onClick={() => setActiveTab('records')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'records'
                  ? 'bg-white text-indigo-600 shadow-sm font-black'
                  : 'hover:text-slate-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              History Records
            </button>
            <button
              id="view-calendar-tab"
              onClick={() => {
                setActiveTab('calendar');
                setFilterMode('month');
              }}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'calendar'
                  ? 'bg-white text-indigo-600 shadow-sm font-black'
                  : 'hover:text-slate-900'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              Monthly Matrix
            </button>
          </div>

         
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div className={`p-3.5 rounded-xl text-xs flex items-center justify-between shadow-sm animate-in fade-in duration-200 ${
          feedback.type === 'success' 
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' 
            : 'bg-rose-50 border border-rose-200 text-rose-800'
        }`}>
          <div className="flex items-center gap-2 font-medium">
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* 1. LINE-BY-LINE ROSTER VIEW (PRIMARY WORKHORSE FOR 100+ WORKERS) */}
      {/* ======================================================== */}
      {activeTab === 'roster' && (
        <div className="space-y-4">
          {/* Top Control Bar: Date Selector, Quick Actions, Counters */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Date Navigation */}
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200">
                  <button
                    onClick={() => changeDateBy(-1)}
                    title="Previous Day"
                    className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="px-3 py-1 flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-indigo-600" />
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => {
                        if (hasUnsavedChanges && !window.confirm('Discard unsaved attendance changes?')) return;
                        setSelectedDate(e.target.value);
                      }}
                      className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer"
                    />
                  </div>
                  <button
                    onClick={() => changeDateBy(1)}
                    title="Next Day"
                    className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 transition-all"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <button
                  onClick={() => {
                    if (hasUnsavedChanges && !window.confirm('Discard unsaved attendance changes?')) return;
                    setSelectedDate(todayStr);
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                    selectedDate === todayStr 
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Today
                </button>
              </div>

              {/* Mass Fill Actions */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                  Quick Fill:
                </span>
                <button
                  type="button"
                  id="mark-all-present-btn"
                  onClick={() => handleBulkMarkAll('Present')}
                  className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                  All Present (8h)
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkMarkAll('Absent')}
                  className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <X className="w-3.5 h-3.5 text-rose-600" />
                  All Absent
                </button>
                <button
                  type="button"
                  onClick={handleMarkUnmarkedPresent}
                  className="px-3 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5 text-sky-600" />
                  Fill Unmarked → Present
                </button>
                <button
                  type="button"
                  onClick={() => fetchRoster(selectedDate)}
                  title="Reload from server and discard unsaved edits"
                  className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Primary Sticky Save Button */}
              <button
                type="button"
                id="save-all-attendance-btn"
                onClick={handleSaveAllRoster}
                disabled={isSavingBatch}
                className={`px-4 py-2 rounded-xl text-xs font-black shadow-lg transition-all flex items-center gap-2 ${
                  hasUnsavedChanges
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-600/30 ring-2 ring-emerald-400 animate-pulse'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'
                }`}
              >
                {isSavingBatch ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving All 100+ Lines...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>
                      {hasUnsavedChanges
                        ? `Save Attendance (${liveCounts.dirtyCount} Modified)`
                        : 'Save All Attendance'}
                    </span>
                  </>
                )}
              </button>
            </div>

            {/* Attendance Status Counter Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-3 border-t border-slate-100 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Total Workers</span>
                <span className="font-mono font-black text-slate-900 text-sm">{liveCounts.total}</span>
              </div>
              <div className="bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200 flex items-center justify-between">
                <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  Present
                </span>
                <span className="font-mono font-black text-emerald-800 text-sm">{liveCounts.present}</span>
              </div>
              <div className="bg-rose-50/70 p-2.5 rounded-xl border border-rose-200 flex items-center justify-between">
                <span className="text-rose-700 font-semibold flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  Absent
                </span>
                <span className="font-mono font-black text-rose-800 text-sm">{liveCounts.absent}</span>
              </div>
              <div className="bg-purple-50/70 p-2.5 rounded-xl border border-purple-200 flex items-center justify-between">
                <span className="text-purple-700 font-semibold flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                  Half Day
                </span>
                <span className="font-mono font-black text-purple-800 text-sm">{liveCounts.halfDay}</span>
              </div>
              <div className="bg-amber-50/70 p-2.5 rounded-xl border border-amber-200 flex items-center justify-between">
                <span className="text-amber-700 font-semibold flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  Leave
                </span>
                <span className="font-mono font-black text-amber-800 text-sm">{liveCounts.leave}</span>
              </div>
              <div className="bg-slate-100/70 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between">
                <span className="text-slate-600 font-semibold flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                  Unmarked
                </span>
                <span className="font-mono font-black text-slate-700 text-sm">{liveCounts.unmarked}</span>
              </div>
            </div>

            {/* Live Filter & Search Row */}
            <div className="flex flex-col md:flex-row items-center gap-3 pt-1">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={rosterSearch}
                  onChange={(e) => setRosterSearch(e.target.value)}
                  placeholder="Search among 100+ workers by name, ID (e.g. EMP042), or job title..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                />
                {rosterSearch && (
                  <button
                    onClick={() => setRosterSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Department Dropdown Filter */}
              <div className="flex items-center gap-2 w-full md:w-auto">
                <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <select
                  value={rosterDeptFilter}
                  onChange={(e) => setRosterDeptFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full md:w-44"
                >
                  <option value="All">All Departments ({roster.length})</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d} ({roster.filter((r) => r.department === d).length})
                    </option>
                  ))}
                </select>

                {/* Status Filter */}
                <select
                  value={rosterStatusFilter}
                  onChange={(e) => setRosterStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full md:w-36"
                >
                  <option value="All">All Statuses</option>
                  <option value="Present">Present ({liveCounts.present})</option>
                  <option value="Absent">Absent ({liveCounts.absent})</option>
                  <option value="Half Day">Half Day ({liveCounts.halfDay})</option>
                  <option value="Leave">Leave ({liveCounts.leave})</option>
                  <option value="Unmarked">Unmarked ({liveCounts.unmarked})</option>
                </select>
              </div>
            </div>
          </div>

          {/* THE LINE-BY-LINE SPREADSHEET TABLE */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto max-h-[700px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 uppercase text-[11px] font-bold sticky top-0 z-20 shadow-sm">
                  <tr>
                    <th className="py-3 px-3 w-12 text-center">#</th>
                    <th className="py-3 px-3 min-w-[200px]">Worker & Employee ID</th>
                    <th className="py-3 px-3 min-w-[140px]">Department</th>
                    <th className="py-3 px-3 min-w-[150px]">Attendance Status</th>
                    <th className="py-3 px-3 w-28 text-center">Work Hours</th>
                    <th className="py-3 px-3 w-28 text-center">Overtime (OT)</th>
                    <th className="py-3 px-3 min-w-[180px]">Notes / Counter / Shift</th>
                    <th className="py-3 px-3 w-24 text-center">Save Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isRosterLoading ? (
                    <tr>
                      <td colSpan={8} className="py-16 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <span className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                          <span className="font-semibold text-xs">Loading line-by-line worker roster...</span>
                        </div>
                      </td>
                    </tr>
                  ) : roster.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-16 text-center">
                        <div className="max-w-sm mx-auto flex flex-col items-center">
                          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xl mb-3">
                            👔
                          </div>
                          <p className="font-bold text-slate-800 text-sm">No Store Workers Registered Yet</p>
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                            Your system is clean and ready! Add your store staff in the <strong>Workforce Directory</strong> tab, and every worker will appear right here in this line-by-line roster for instant daily attendance marking.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredRoster.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-16 text-center text-slate-400">
                        <p className="font-semibold text-slate-600">No workers match the current filters.</p>
                        <p className="text-[11px] text-slate-400 mt-1">Try resetting the search keyword or department dropdown.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredRoster.map((row, idx) => {
                      const isRowUnmarked = row.status === 'Unmarked';
                      const isRowPresent = row.status === 'Present';
                      const isRowAbsent = row.status === 'Absent';
                      const isRowHalfDay = row.status === 'Half Day';
                      const isRowLeave = row.status === 'Leave';

                      return (
                        <tr
                          key={row.employee_id}
                          className={`transition-colors ${
                            row.is_dirty
                              ? 'bg-amber-50/40 hover:bg-amber-50/70'
                              : isRowAbsent
                              ? 'bg-rose-50/20 hover:bg-rose-50/40'
                              : isRowUnmarked
                              ? 'bg-slate-50/50 hover:bg-slate-50'
                              : 'hover:bg-slate-50/80'
                          }`}
                        >
                          {/* Row Index */}
                          <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-400 font-bold">
                            {idx + 1}
                          </td>

                          {/* Worker Name & ID */}
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2.5">
                              <img
                                src={row.avatar_url || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'}
                                alt={row.name}
                                className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                              />
                              <div className="min-w-0">
                                <span className="font-bold text-slate-900 block truncate" title={row.name}>
                                  {row.name}
                                </span>
                                <div className="flex items-center gap-1.5 text-[10px]">
                                  <span className="font-mono text-slate-500 font-semibold">{row.employee_id}</span>
                                  <span className="text-slate-300">•</span>
                                  <span className="text-slate-500 truncate max-w-[130px]">{row.designation}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Department */}
                          <td className="py-2.5 px-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md font-semibold text-[11px] bg-slate-100 text-slate-700 border border-slate-200">
                              {row.department}
                            </span>
                          </td>

                          {/* STATUS DROPDOWN (LINE-BY-LINE CORE) */}
                          <td className="py-2.5 px-3">
                            <div className="relative">
                              <select
                                value={row.status}
                                onChange={(e) => handleRosterStatusChange(row.employee_id, e.target.value as AttendanceStatus)}
                                className={`w-full py-1.5 pl-2.5 pr-8 rounded-lg font-bold text-xs border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                                  isRowPresent
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                    : isRowAbsent
                                    ? 'bg-rose-50 text-rose-800 border-rose-300'
                                    : isRowHalfDay
                                    ? 'bg-purple-50 text-purple-800 border-purple-300'
                                    : isRowLeave
                                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                                    : 'bg-slate-100 text-slate-500 border-dashed border-slate-300'
                                }`}
                              >
                                {isRowUnmarked && <option value="Unmarked">⚪ Unmarked</option>}
                                <option value="Present">🟢 Present</option>
                                <option value="Absent">🔴 Absent</option>
                                <option value="Half Day">🟣 Half Day</option>
                                <option value="Leave">🟡 Leave</option>
                              </select>
                            </div>
                          </td>

                          {/* WORKING HOURS */}
                          <td className="py-2.5 px-3 text-center">
                            <div className="inline-flex items-center gap-1">
                              <input
                                type="number"
                                disabled={isRowUnmarked}
                                min="0"
                                max="16"
                                step="0.5"
                                value={row.working_hours}
                                onChange={(e) => handleRosterHoursChange(row.employee_id, parseFloat(e.target.value))}
                                className="w-16 px-2 py-1 bg-white border border-slate-200 rounded-lg text-center font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                              <span className="text-[11px] text-slate-400 font-semibold">h</span>
                            </div>
                          </td>

                          {/* OVERTIME (OT) HOURS */}
                          <td className="py-2.5 px-3 text-center">
                            <div className="inline-flex items-center gap-1">
                              <input
                                type="number"
                                disabled={isRowUnmarked}
                                min="0"
                                max="2"
                                step="0.5"
                                value={row.overtime_hours}
                                onChange={(e) => handleRosterOtChange(row.employee_id, parseFloat(e.target.value))}
                                className={`w-16 px-2 py-1 border rounded-lg text-center font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                                  row.overtime_hours > 0
                                    ? 'bg-sky-50 text-sky-700 border-sky-300'
                                    : 'bg-white text-slate-700 border-slate-200'
                                }`}
                              />
                              <span className="text-[11px] text-slate-400 font-semibold">h</span>
                            </div>
                          </td>

                          {/* NOTES / REMARKS */}
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              disabled={isRowUnmarked}
                              value={row.notes}
                              onChange={(e) => handleRosterNotesChange(row.employee_id, e.target.value)}
                              placeholder="e.g. Counter 2, Alteration rush, Late 20m"
                              className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </td>

                          {/* SAVE STATUS / QUICK SAVE */}
                          <td className="py-2.5 px-3 text-center">
                            {row.is_dirty ? (
                              <button
                                type="button"
                                onClick={() => handleSaveSingleRow(row.employee_id)}
                                title="Click to save this line now"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] shadow-sm transition-all"
                              >
                                <Save className="w-3 h-3" />
                                Save
                              </button>
                            ) : !isRowUnmarked ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                                <Check className="w-3.5 h-3.5" />
                                Saved
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 font-mono">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom table status summary & bulk save reminder */}
            <div className="bg-slate-50 p-3 px-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <span className="text-slate-500 font-medium">
                Showing {filteredRoster.length} of {roster.length} workers for{' '}
                <strong className="text-slate-800 font-mono">{selectedDate}</strong>
              </span>

              {hasUnsavedChanges && (
                <div className="flex items-center gap-3">
                  <span className="text-amber-700 font-bold flex items-center gap-1.5 animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    {liveCounts.dirtyCount} unsaved line changes!
                  </span>
                  <button
                    onClick={handleSaveAllRoster}
                    disabled={isSavingBatch}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Save All Now
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. HISTORY RECORDS VIEW */}
      {/* ======================================================== */}
      {activeTab === 'records' && (
        <div className="space-y-4">
          {/* Filter Toolbar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col lg:flex-row gap-4 items-center justify-between">
            <div className="flex items-center gap-2 w-full lg:w-auto">
              <div className="grid grid-cols-3 p-1 bg-slate-100 rounded-lg text-xs font-semibold">
                <button
                  onClick={() => {
                    setFilterMode('date');
                    setRecordsPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-md transition-all ${
                    filterMode === 'date' ? 'bg-white shadow-sm text-indigo-600 font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  By Single Date
                </button>
                <button
                  onClick={() => {
                    setFilterMode('month');
                    setRecordsPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-md transition-all ${
                    filterMode === 'month' ? 'bg-white shadow-sm text-indigo-600 font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  By Full Month
                </button>
                <button
                  onClick={() => {
                    setFilterMode('range');
                    setRecordsPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-md transition-all ${
                    filterMode === 'range' ? 'bg-white shadow-sm text-indigo-600 font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Date Range
                </button>
              </div>

              {filterMode === 'date' ? (
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setRecordsPage(1);
                  }}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              ) : filterMode === 'month' ? (
                <div className="flex items-center gap-2">
                  <select
                    value={selectedMonth}
                    onChange={(e) => {
                      setSelectedMonth(parseInt(e.target.value));
                      setRecordsPage(1);
                    }}
                    className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none"
                  >
                    {[
                      'January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'
                    ].map((m, idx) => (
                      <option key={m} value={idx + 1}>{m}</option>
                    ))}
                  </select>
                  <select
                    value={selectedYear}
                    onChange={(e) => {
                      setSelectedYear(parseInt(e.target.value));
                      setRecordsPage(1);
                    }}
                    className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none"
                  >
                    {[2025, 2026, 2027].map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <label className="text-[11px] text-slate-500">From</label>
                  <input
                    type="date"
                    value={rangeStartDate}
                    onChange={(e) => {
                      setRangeStartDate(e.target.value);
                      setRecordsPage(1);
                    }}
                    className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                  <label className="text-[11px] text-slate-500">To</label>
                  <input
                    type="date"
                    value={rangeEndDate}
                    onChange={(e) => {
                      setRangeEndDate(e.target.value);
                      setRecordsPage(1);
                    }}
                    className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 font-medium">Employee:</span>
                <select
                  value={empFilter}
                  onChange={(e) => {
                    setEmpFilter(e.target.value);
                    setRecordsPage(1);
                  }}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium focus:outline-none max-w-[160px]"
                >
                  <option value="All">All Staff</option>
                  {employees.map((emp) => (
                    <option key={emp.employee_id} value={emp.employee_id}>
                      {emp.name} ({emp.employee_id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 font-medium">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setRecordsPage(1);
                  }}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium focus:outline-none"
                >
                  <option value="All">All Statuses</option>
                  <option value="Present">Present</option>
                  <option value="Absent">Absent</option>
                  <option value="Leave">Leave</option>
                  <option value="Half Day">Half Day</option>
                </select>
              </div>

              <button
                onClick={openMarkModalForNew}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-sm"
              >
                + Single Entry
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[11px] font-bold">
                  <tr>
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-4">Employee</th>
                    <th className="py-3.5 px-4">Department</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4 text-center">Working Hours</th>
                    <th className="py-3.5 px-4 text-center">Overtime Hours</th>
                    <th className="py-3.5 px-4">Notes</th>
                    <th className="py-3.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isRecordsLoading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <span className="inline-block w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mr-2" />
                        Loading attendance records...
                      </td>
                    </tr>
                  ) : records.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        No attendance records found for this period. Use "Line-by-Line Roster" to mark attendance for today.
                      </td>
                    </tr>
                  ) : (
                    records.map((rec) => (
                      <tr key={rec.attendance_id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono font-medium text-slate-900 whitespace-nowrap">
                          {rec.date}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <img
                              src={rec.avatar_url || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150'}
                              alt={rec.employee_name || rec.employee_id}
                              className="w-7 h-7 rounded-full object-cover border border-slate-200"
                            />
                            <div>
                              <span className="font-bold text-slate-900 block">{rec.employee_name}</span>
                              <span className="text-[10px] text-slate-400 font-mono block">{rec.employee_id}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-700 font-medium">{rec.department}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wider ${
                            rec.status === 'Present' ? 'bg-emerald-100 text-emerald-800' :
                            rec.status === 'Absent' ? 'bg-rose-100 text-rose-800' :
                            rec.status === 'Half Day' ? 'bg-purple-100 text-purple-800' :
                            'bg-amber-100 text-amber-800'
                          }`}>
                            {rec.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-800 font-mono">
                          {rec.working_hours} hrs
                        </td>
                        <td className="py-3 px-4 text-center">
                          {rec.overtime_hours > 0 ? (
                            <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-800 font-mono font-bold text-[11px]">
                              +{rec.overtime_hours} hrs
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono text-[11px]">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                          {rec.notes || '-'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openMarkModalForEdit(rec)}
                              title="Edit Record"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteRecord(rec.attendance_id)}
                              title="Delete Record"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing {recordsTotal === 0 ? 0 : (recordsPage - 1) * ATTENDANCE_PAGE_SIZE_DEFAULT + 1}
              –{Math.min(recordsPage * ATTENDANCE_PAGE_SIZE_DEFAULT, recordsTotal)} of {recordsTotal} attendance records
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={recordsPage <= 1 || isRecordsLoading}
                onClick={() => setRecordsPage((page) => page - 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40"
              >
                Previous
              </button>
              <span>
                Page {recordsPage} of {Math.max(1, Math.ceil(recordsTotal / ATTENDANCE_PAGE_SIZE_DEFAULT))}
              </span>
              <button
                type="button"
                disabled={
                  recordsPage >= Math.max(1, Math.ceil(recordsTotal / ATTENDANCE_PAGE_SIZE_DEFAULT)) ||
                  isRecordsLoading
                }
                onClick={() => setRecordsPage((page) => page + 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. MONTHLY ATTENDANCE HEATMAP MATRIX */}
      {/* ======================================================== */}
      {activeTab === 'calendar' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 overflow-x-auto">
          <div className="flex items-center justify-between mb-3 text-xs">
            <span className="font-bold text-slate-900 uppercase tracking-wider">
              Monthly Attendance Heatmap Matrix: {selectedMonth}/{selectedYear}
            </span>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> P: Present</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-rose-500 inline-block" /> A: Absent</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500 inline-block" /> L: Leave</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-purple-500 inline-block" /> H: Half Day</span>
            </div>
          </div>

          <table className="w-full text-center text-[10px] border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-600">
                <th className="py-2 px-3 text-left font-bold w-44 sticky left-0 bg-slate-100 z-10 border border-slate-200">
                  Staff Member
                </th>
                {dayNumbers.map((d) => (
                  <th key={d} className="p-1 min-w-[24px] border border-slate-200 font-mono font-bold">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.slice(0, 50).map((emp) => {
                const empRecords = records.filter((r) => r.employee_id === emp.employee_id);
                const recordMap: Record<number, AttendanceRecord> = {};
                empRecords.forEach((r) => {
                  const dayNum = parseInt(r.date.split('-')[2], 10);
                  recordMap[dayNum] = r;
                });

                return (
                  <tr key={emp.employee_id} className="hover:bg-slate-50">
                    <td className="py-2 px-3 text-left font-bold text-slate-800 sticky left-0 bg-white border border-slate-200 shadow-sm">
                      <div className="truncate w-40" title={emp.name}>
                        {emp.name}
                      </div>
                      <span className="text-[9px] text-slate-400 font-mono block">{emp.employee_id}</span>
                    </td>
                    {dayNumbers.map((d) => {
                      const rec = recordMap[d];
                      let bg = 'bg-slate-50 text-slate-300';
                      let letter = '·';
                      let title = `Day ${d}: Unrecorded`;

                      if (rec) {
                        title = `${emp.name} on ${rec.date}: ${rec.status} (${rec.working_hours}h, OT: ${rec.overtime_hours}h)`;
                        if (rec.status === 'Present') {
                          bg = 'bg-emerald-500 text-white font-bold';
                          letter = 'P';
                        } else if (rec.status === 'Absent') {
                          bg = 'bg-rose-500 text-white font-bold';
                          letter = 'A';
                        } else if (rec.status === 'Leave') {
                          bg = 'bg-amber-500 text-white font-bold';
                          letter = 'L';
                        } else if (rec.status === 'Half Day') {
                          bg = 'bg-purple-500 text-white font-bold';
                          letter = 'H';
                        }
                      }

                      return (
                        <td
                          key={d}
                          title={title}
                          className={`p-1 border border-slate-200 cursor-pointer ${bg}`}
                          onClick={() => {
                            const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                            if (rec) {
                              openMarkModalForEdit(rec);
                            } else {
                              setEditingRecord(null);
                              setModalFormData({
                                employee_id: emp.employee_id,
                                date: dateStr,
                                status: 'Present',
                                working_hours: 8,
                                overtime_hours: 0,
                                notes: '',
                              });
                              setIsMarkModalOpen(true);
                            }
                          }}
                        >
                          {letter}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {employees.length > 50 && (
            <p className="text-[11px] text-slate-400 text-center mt-3">
              Showing first 50 staff in heatmap matrix. Use Line-by-Line Roster to view all {employees.length} workers.
            </p>
          )}
        </div>
      )}

      {/* SINGLE ENTRY MODAL */}
      {isMarkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-600" />
                {editingRecord ? 'Edit Attendance Record' : 'Log Single Entry'}
              </h2>
              <button onClick={() => setIsMarkModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSingleFormSubmit} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Employee *</label>
                <select
                  required
                  disabled={!!editingRecord}
                  value={modalFormData.employee_id}
                  onChange={(e) => setModalFormData({ ...modalFormData, employee_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
                >
                  {employees.map((emp) => (
                    <option key={emp.employee_id} value={emp.employee_id}>
                      {emp.name} ({emp.employee_id} - {emp.department})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Attendance Date *</label>
                <input
                  type="date"
                  required
                  value={modalFormData.date}
                  onChange={(e) => setModalFormData({ ...modalFormData, date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Attendance Status *</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['Present', 'Absent', 'Leave', 'Half Day'] as AttendanceStatus[]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => {
                        let hrs = 8;
                        if (st === 'Absent') hrs = 0;
                        if (st === 'Half Day') hrs = 4;
                        setModalFormData({ ...modalFormData, status: st, working_hours: hrs });
                      }}
                      className={`py-2 px-2 rounded-lg text-xs font-bold border transition-all ${
                        modalFormData.status === st
                          ? st === 'Present' ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                            : st === 'Absent' ? 'bg-rose-600 text-white border-rose-600 shadow-md'
                            : st === 'Leave' ? 'bg-amber-600 text-white border-amber-600 shadow-md'
                            : 'bg-purple-600 text-white border-purple-600 shadow-md'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Working Hours (hrs)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="24"
                    value={modalFormData.working_hours}
                    onChange={(e) => setModalFormData({ ...modalFormData, working_hours: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Overtime Hours (hrs)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="16"
                    value={modalFormData.overtime_hours}
                    onChange={(e) => setModalFormData({ ...modalFormData, overtime_hours: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono text-sky-600 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notes / Remarks</label>
                <input
                  type="text"
                  value={modalFormData.notes}
                  onChange={(e) => setModalFormData({ ...modalFormData, notes: e.target.value })}
                  placeholder="e.g. Counter 1, Field errand, Doctor visit"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsMarkModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-md"
                >
                  {editingRecord ? 'Save Changes' : 'Record Attendance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
