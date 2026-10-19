import React, { useState, useEffect } from 'react';
import { AdminAccount } from '../../types.ts';
import { 
  ShieldCheck, UserPlus, Lock, Mail, User, 
  Trash2, AlertCircle, CheckCircle2, X, RefreshCw, KeyRound
} from 'lucide-react';

export const AdminAccountsManagement: React.FC = () => {
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // New Admin Form Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'ADMIN' as 'ADMIN' | 'SUPER_ADMIN',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Password reset modal
  const [resetModalUser, setResetModalUser] = useState<AdminAccount | null>(null);
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('erp_token');
      const res = await fetch('/api/super-admin/admins', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch admin accounts');
      setAdmins(data.admins || []);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username || !formData.email || !formData.password) return;

    try {
      setIsSubmitting(true);
      const token = localStorage.getItem('erp_token');
      const res = await fetch('/api/super-admin/admins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create manager account');

      setFeedback({ type: 'success', message: data.message });
      setIsCreateModalOpen(false);
      setFormData({ username: '', email: '', password: '', role: 'ADMIN' });
      fetchAdmins();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (admin: AdminAccount) => {
    const nextStatus = admin.status === 'active' ? 'inactive' : 'active';
    try {
      const token = localStorage.getItem('erp_token');
      const res = await fetch(`/api/super-admin/admins/${admin.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update account status');

      setFeedback({ type: 'success', message: `Account @${admin.username} is now ${nextStatus}.` });
      fetchAdmins();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalUser || !newPassword) return;

    try {
      const token = localStorage.getItem('erp_token');
      const res = await fetch(`/api/super-admin/admins/${resetModalUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset password');

      setFeedback({ type: 'success', message: `Password reset successfully for @${resetModalUser.username}.` });
      setResetModalUser(null);
      setNewPassword('');
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleDeleteAdmin = async (admin: AdminAccount) => {
    if (!window.confirm(`Permanently delete account @${admin.username}?`)) return;

    try {
      const token = localStorage.getItem('erp_token');
      const res = await fetch(`/api/super-admin/admins/${admin.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete account');

      setFeedback({ type: 'success', message: data.message });
      fetchAdmins();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-amber-500" />
            Manager & Admin Accounts Control
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Store Owner executive console to provision manager logins, set access permissions, and revoke admin rights.
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 transition-all flex items-center gap-1.5 self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          Create Store Manager
        </button>
      </div>

      {feedback && (
        <div className={`p-3.5 rounded-xl text-xs flex items-center justify-between ${
          feedback.type === 'success' 
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' 
            : 'bg-rose-50 border border-rose-200 text-rose-800'
        }`}>
          <div className="flex items-center gap-2 font-medium">
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Admin Accounts Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold">
              <tr>
                <th className="py-3 px-4">Account ID</th>
                <th className="py-3 px-4">Username</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Role Privileges</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4">Created Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <span className="inline-block w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mr-2" />
                    Loading admin accounts...
                  </td>
                </tr>
              ) : admins.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No admin accounts found.
                  </td>
                </tr>
              ) : (
                admins.map((adm) => {
                  const isOwner = adm.role === 'SUPER_ADMIN';
                  return (
                    <tr key={adm.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono font-bold text-slate-500">#{adm.id}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        <span className="flex items-center gap-1.5">
                          {isOwner && <span>👑</span>}
                          @{adm.username}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-mono">{adm.email}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wider ${
                          isOwner 
                            ? 'bg-amber-100 text-amber-800 border border-amber-300' 
                            : 'bg-indigo-100 text-indigo-800'
                        }`}>
                          {isOwner ? '👑 Owner (Super Admin)' : 'Store Manager (Admin)'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          adm.status === 'active' 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {adm.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                        {new Date(adm.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isOwner && (
                            <>
                              <button
                                onClick={() => handleToggleStatus(adm)}
                                className={`px-2 py-1 rounded text-[11px] font-bold ${
                                  adm.status === 'active'
                                    ? 'text-amber-700 bg-amber-50 hover:bg-amber-100'
                                    : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                                }`}
                              >
                                {adm.status === 'active' ? 'Deactivate' : 'Activate'}
                              </button>
                              <button
                                onClick={() => {
                                  setResetModalUser(adm);
                                  setNewPassword('');
                                }}
                                title="Reset Password"
                                className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteAdmin(adm)}
                                title="Delete Admin Account"
                                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          {isOwner && (
                            <span className="text-[10px] text-amber-600 font-bold px-2 py-0.5 bg-amber-50 rounded">
                              Protected Owner
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE ADMIN MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-amber-500" />
                Provision Store Manager Account
              </h2>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAdmin} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Username *</label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="e.g. manager_ravi"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="e.g. ravi@rajpalgarments.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Initial Password *</label>
                <input
                  type="password"
                  required
                  minLength={4}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Minimum 4 characters"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Privilege Level</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-bold focus:ring-2 focus:ring-amber-500"
                >
                  <option value="ADMIN">Store Manager (Operational Admin)</option>
                  <option value="SUPER_ADMIN">Owner / Executive Board (Super Admin)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-lg shadow-md transition-all"
                >
                  {isSubmitting ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {resetModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-indigo-600" />
              Reset Password
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Set a new password for manager <strong>@{resetModalUser.username}</strong>
            </p>

            <form onSubmit={handleResetPassword} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">New Password</label>
                <input
                  type="password"
                  required
                  minLength={4}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetModalUser(null)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg font-bold shadow-md"
                >
                  Save Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
