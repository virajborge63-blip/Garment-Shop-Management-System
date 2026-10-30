import React, { useState, useEffect } from 'react';
import { Employee } from '../../types.ts';
import { 
  UserPlus, Search, Filter, Edit3, Trash2, Eye, CheckCircle, 
  XCircle, AlertCircle, Building2, Phone, Mail, MapPin, Calendar, 
  DollarSign, X, Check, ArrowUpDown
} from 'lucide-react';

export const EmployeeManagement: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortField, setSortField] = useState<'employee_id' | 'name' | 'monthly_salary'>('employee_id');
  const [sortAsc, setSortAsc] = useState(true);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    department: 'Sales',
    designation: '',
    joining_date: new Date().toISOString().split('T')[0],
    per_day_salary: 800,
    monthly_salary: 20800,
    overtime_rate: 150,
    password: '',
    status: 'active',
  });

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    fetchEmployees();
  }, [searchTerm, deptFilter, statusFilter]);

  const fetchEmployees = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('erp_token');
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (deptFilter !== 'All') params.append('department', deptFilter);
      if (statusFilter !== 'All') params.append('status', statusFilter);

      const res = await fetch(`/api/admin/employees?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch employees');
      const data = await res.json();
      setEmployees(data.employees || []);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error fetching employees' });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePerDaySalaryChange = (perDay: number) => {
    const p = Math.max(0, perDay);
    setFormData({
      ...formData,
      per_day_salary: p,
      monthly_salary: p * 26 // Standard 26 working days auto-sync
    });
  };

  const handleMonthlySalaryChange = (monthly: number) => {
    const m = Math.max(0, monthly);
    setFormData({
      ...formData,
      monthly_salary: m,
      per_day_salary: Math.round(m / 26)
    });
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('erp_token');
      const res = await fetch('/api/admin/employees', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add employee');

      setFeedback({ type: 'success', message: data.message });
      setIsAddModalOpen(false);
      resetForm();
      fetchEmployees();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmp) return;

    try {
      const token = localStorage.getItem('erp_token');
      const res = await fetch(`/api/admin/employees/${selectedEmp.employee_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update employee');

      setFeedback({ type: 'success', message: data.message });
      setIsEditModalOpen(false);
      fetchEmployees();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedEmp) return;
    try {
      const token = localStorage.getItem('erp_token');
      const res = await fetch(`/api/admin/employees/${selectedEmp.employee_id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to archive employee');

      setFeedback({ type: 'success', message: data.message });
      setIsDeleteModalOpen(false);
      fetchEmployees();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const openEditModal = (emp: Employee) => {
    setSelectedEmp(emp);
    setFormData({
      name: emp.name,
      email: emp.email,
      phone: emp.phone,
      address: emp.address,
      department: emp.department,
      designation: emp.designation,
      joining_date: emp.joining_date,
      per_day_salary: emp.per_day_salary,
      monthly_salary: emp.monthly_salary,
      overtime_rate: emp.overtime_rate,
      password: '',
      status: emp.status,
    });
    setIsEditModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      address: '',
      department: 'Sales',
      designation: '',
      joining_date: new Date().toISOString().split('T')[0],
      per_day_salary: 800,
      monthly_salary: 20800,
      overtime_rate: 150,
      password: '',
      status: 'active',
    });
  };

  const departments = ['All', 'Sales', 'Billing', 'Cashier', 'Stock Management', 'Store Manager'];

  // Sorting
  const sortedEmployees = [...employees].sort((a, b) => {
    let comparison = 0;
    if (sortField === 'employee_id') comparison = a.employee_id.localeCompare(b.employee_id);
    else if (sortField === 'name') comparison = a.name.localeCompare(b.name);
    else if (sortField === 'monthly_salary') comparison = a.monthly_salary - b.monthly_salary;
    return sortAsc ? comparison : -comparison;
  });

  return (
    <div className="space-y-6">
      {/* Header and Add Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Employee Directory</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Administer personnel profiles, departments, designations, base wages and access credentials.
          </p>
        </div>
        <button
          id="add-employee-btn"
          onClick={() => {
            resetForm();
            setIsAddModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all"
        >
          <UserPlus className="w-4 h-4" />
          Add New Employee
        </button>
      </div>

      {feedback && (
        <div className={`p-3.5 rounded-xl text-xs flex items-center justify-between ${
          feedback.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-rose-50 border border-rose-200 text-rose-800'
        }`}>
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="employee-search-input"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, ID, or email..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs text-slate-500 font-medium">Department:</span>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-medium focus:outline-none"
            >
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-medium focus:outline-none"
            >
              <option value="All">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Employee Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[11px] font-bold">
              <tr>
                <th 
                  className="py-3.5 px-4 cursor-pointer hover:text-slate-800"
                  onClick={() => {
                    if (sortField === 'employee_id') setSortAsc(!sortAsc);
                    else { setSortField('employee_id'); setSortAsc(true); }
                  }}
                >
                  <div className="flex items-center gap-1">
                    ID <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th 
                  className="py-3.5 px-4 cursor-pointer hover:text-slate-800"
                  onClick={() => {
                    if (sortField === 'name') setSortAsc(!sortAsc);
                    else { setSortField('name'); setSortAsc(true); }
                  }}
                >
                  <div className="flex items-center gap-1">
                    Employee <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3.5 px-4">Department</th>
                <th className="py-3.5 px-4 text-center">Present (Mo)</th>
                <th className="py-3.5 px-4 text-center">Absent (Mo)</th>
                <th 
                  className="py-3.5 px-4 text-right cursor-pointer hover:text-slate-800"
                  onClick={() => {
                    if (sortField === 'monthly_salary') setSortAsc(!sortAsc);
                    else { setSortField('monthly_salary'); setSortAsc(false); }
                  }}
                >
                  <div className="flex items-center justify-end gap-1">
                    Monthly Salary <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <span className="inline-block w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mr-2" />
                    Loading employees...
                  </td>
                </tr>
              ) : sortedEmployees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No employees matching filters found.
                  </td>
                </tr>
              ) : (
                sortedEmployees.map((emp) => (
                  <tr key={emp.employee_id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{emp.employee_id}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={emp.avatar_url || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150'}
                          alt={emp.name}
                          className="w-8 h-8 rounded-full object-cover border border-slate-200"
                        />
                        <div>
                          <span className="font-bold text-slate-900 block">{emp.name}</span>
                          <span className="text-[11px] text-slate-400 block">{emp.designation}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-medium">{emp.department}</td>
                    <td className="py-3 px-4 text-center font-bold text-emerald-600">
                      {emp.present_days_month || 0}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-rose-600">
                      {emp.absent_days_month || 0}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      ₹{emp.monthly_salary.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wide ${
                        emp.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {emp.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedEmp(emp);
                            setIsViewModalOpen(true);
                          }}
                          title="View Profile"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openEditModal(emp)}
                          title="Edit Details & Salary"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedEmp(emp);
                            setIsDeleteModalOpen(true);
                          }}
                          title="Archive Employee"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
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

      {/* ADD EMPLOYEE MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-600" />
                Register New Employee
              </h2>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Company Email *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="e.g. ramesh@company.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91 98765 00000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Joining Date</label>
                  <input
                    type="date"
                    required
                    value={formData.joining_date}
                    onChange={(e) => setFormData({ ...formData, joining_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Department *</label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    {departments.filter(d => d !== 'All').map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Designation *</label>
                  <input
                    type="text"
                    required
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    placeholder="e.g. Sales Associate"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Salary Structure Configuration */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <span className="font-bold text-slate-800 uppercase tracking-wider block mb-2 text-[11px]">
                  Salary & Overtime Configuration
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Per-Day Salary (₹)</label>
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="0.01"
                      value={formData.per_day_salary}
                      onChange={(e) => handlePerDaySalaryChange(parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Monthly Salary (₹)</label>
                    <input
                      type="number"
                      required
                      value={formData.monthly_salary}
                      onChange={(e) => handleMonthlySalaryChange(parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Overtime Rate (₹/hr)</label>
                    <input
                      type="number"
                      required
                      value={formData.overtime_rate}
                      onChange={(e) => setFormData({ ...formData, overtime_rate: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono text-slate-900"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 mt-2">
                  * Monthly salary automatically synchronizes with standard 26 paid working days.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Residential Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Street, City, Pin Code"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Initial Portal Password</label>
                <input
                  type="password"
                  required
                  minLength={12}
                  autoComplete="new-password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="At least 12 characters"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-md"
                >
                  Save & Provision Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT EMPLOYEE MODAL */}
      {isEditModalOpen && selectedEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-600" />
                Edit Employee: {selectedEmp.name} ({selectedEmp.employee_id})
              </h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Department</label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                  >
                    {departments.filter(d => d !== 'All').map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Designation</label>
                  <input
                    type="text"
                    required
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-bold"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Salary Update */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <span className="font-bold text-slate-800 uppercase tracking-wider block mb-2 text-[11px]">
                  Salary & Wage Revisions
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Per-Day Salary (₹)</label>
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="0.01"
                      value={formData.per_day_salary}
                      onChange={(e) => handlePerDaySalaryChange(parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Monthly Salary (₹)</label>
                    <input
                      type="number"
                      required
                      value={formData.monthly_salary}
                      onChange={(e) => handleMonthlySalaryChange(parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Overtime Rate (₹/hr)</label>
                    <input
                      type="number"
                      required
                      value={formData.overtime_rate}
                      onChange={(e) => setFormData({ ...formData, overtime_rate: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono text-slate-900"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reset Password (Optional)</label>
                <input
                  type="password"
                  minLength={12}
                  autoComplete="new-password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Enter a new password (at least 12 characters)"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                />
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
                  className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-lg shadow-md"
                >
                  Apply Updates & Audit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW EMPLOYEE PROFILE MODAL */}
      {isViewModalOpen && selectedEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Employee Dossier</span>
              <button onClick={() => setIsViewModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 text-center pb-4 border-b border-slate-100">
              <img
                src={selectedEmp.avatar_url || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150'}
                alt={selectedEmp.name}
                className="w-20 h-20 rounded-full mx-auto object-cover border-2 border-indigo-600 shadow-md mb-2"
              />
              <h2 className="text-lg font-black text-slate-900">{selectedEmp.name}</h2>
              <span className="text-xs text-indigo-600 font-semibold">{selectedEmp.designation}</span>
              <div className="flex justify-center items-center gap-2 mt-2">
                <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-800 text-xs font-bold font-mono">
                  {selectedEmp.employee_id}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  selectedEmp.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                }`}>
                  {selectedEmp.status}
                </span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-150">
                <span className="text-slate-400 block text-[11px]">Department</span>
                <span className="font-bold text-slate-900">{selectedEmp.department}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-150">
                <span className="text-slate-400 block text-[11px]">Joining Date</span>
                <span className="font-bold text-slate-900">{selectedEmp.joining_date}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-150">
                <span className="text-slate-400 block text-[11px]">Per-Day Salary</span>
                <span className="font-bold text-slate-900 font-mono">₹{selectedEmp.per_day_salary}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-150">
                <span className="text-slate-400 block text-[11px]">Monthly Base</span>
                <span className="font-bold text-slate-900 font-mono">₹{selectedEmp.monthly_salary.toLocaleString('en-IN')}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-150">
                <span className="text-slate-400 block text-[11px]">Overtime Rate</span>
                <span className="font-bold text-sky-600 font-mono">₹{selectedEmp.overtime_rate}/hr</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-150">
                <span className="text-slate-400 block text-[11px]">Contact Phone</span>
                <span className="font-bold text-slate-900">{selectedEmp.phone || 'N/A'}</span>
              </div>
            </div>

            <div className="mt-3 p-2.5 rounded-lg bg-slate-50 border border-slate-150 text-xs">
              <span className="text-slate-400 block text-[11px]">Email Address</span>
              <span className="font-semibold text-slate-900">{selectedEmp.email}</span>
            </div>

            <div className="mt-3 p-2.5 rounded-lg bg-slate-50 border border-slate-150 text-xs">
              <span className="text-slate-400 block text-[11px]">Residential Address</span>
              <span className="font-semibold text-slate-900">{selectedEmp.address || 'N/A'}</span>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setIsViewModalOpen(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ARCHIVE CONFIRMATION MODAL */}
      {isDeleteModalOpen && selectedEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-rose-200 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Archive Employee Confirmation</h3>
            <p className="text-xs text-slate-600 mt-2">
              Are you sure you want to archive <strong className="text-slate-900">{selectedEmp.name} ({selectedEmp.employee_id})</strong>?
            </p>
            <p className="text-[11px] text-rose-600 mt-1 font-medium bg-rose-50 p-2 rounded-lg border border-rose-200">
              The employee will be hidden from active lists, their login will be disabled, and historical attendance and payroll records will be retained.
            </p>

            <div className="mt-6 flex justify-center gap-3">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold shadow-md shadow-rose-600/30"
              >
                Yes, Archive Employee
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
