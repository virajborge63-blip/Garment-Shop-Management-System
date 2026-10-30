import React, { useState, useEffect } from 'react';
import { Employee } from '../../types.ts';
import { getStoredAuthToken } from '../../utils/authToken.ts';
import { Shield, Building2, Phone, Mail, MapPin, Calendar, DollarSign, Clock, UserCheck } from 'lucide-react';

export const EmployeeProfile: React.FC = () => {
  const [profile, setProfile] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setIsLoading(true);
      const token = getStoredAuthToken();
      const res = await fetch('/api/employee/profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setProfile(data.employee || null);
    } catch (err) {
      console.error('Error fetching profile', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !profile) {
    return (
      <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
        Loading employee profile...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">My Profile & Employment Details</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Verified company record, assigned designation, compensation tiers, and contact dossier.
        </p>
      </div>

      {/* Read-only notification */}
      <div className="p-3.5 bg-teal-50 border border-teal-200 rounded-xl text-xs text-teal-900 flex items-start gap-2.5">
        <Shield className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="font-bold block text-teal-950">Administrative Read-Only Protection</strong>
          Employee profiles are managed strictly under corporate governance by HR Administration. Any corrections to contact information, bank account, or designation require official HR submission.
        </div>
      </div>

      {/* Main Profile Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b border-slate-150">
          <img
            src={profile.avatar_url || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'}
            alt={profile.name}
            className="w-24 h-24 rounded-2xl object-cover border-4 border-teal-500/20 shadow-lg"
          />
          <div className="text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-lg bg-teal-50 text-teal-700 font-mono font-bold text-xs">
                {profile.employee_id}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase">
                {profile.status}
              </span>
            </div>
            <h2 className="text-2xl font-black text-slate-900">{profile.name}</h2>
            <p className="text-sm font-semibold text-teal-600 mt-0.5">
              {profile.designation} • {profile.department} Department
            </p>
          </div>
        </div>

        {/* Details Grid */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-150 flex items-start gap-3">
            <Mail className="w-4 h-4 text-slate-400 mt-0.5" />
            <div>
              <span className="text-slate-400 block text-[11px]">Official Email</span>
              <span className="font-bold text-slate-900">{profile.email}</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-150 flex items-start gap-3">
            <Phone className="w-4 h-4 text-slate-400 mt-0.5" />
            <div>
              <span className="text-slate-400 block text-[11px]">Contact Phone</span>
              <span className="font-bold text-slate-900">{profile.phone || 'N/A'}</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-150 flex items-start gap-3">
            <Calendar className="w-4 h-4 text-slate-400 mt-0.5" />
            <div>
              <span className="text-slate-400 block text-[11px]">Date of Joining</span>
              <span className="font-bold text-slate-900">{profile.joining_date}</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-150 flex items-start gap-3">
            <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
            <div>
              <span className="text-slate-400 block text-[11px]">Residential Address</span>
              <span className="font-bold text-slate-900">{profile.address || 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Compensation Tiers */}
        <div className="mt-6 pt-6 border-t border-slate-150">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Compensation & Wage Architecture
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-teal-50/70 border border-teal-200">
              <span className="text-teal-700 block text-[11px]">Per-Day Salary</span>
              <span className="text-lg font-black text-teal-950 font-mono mt-0.5 block">
                ₹{profile.per_day_salary}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-teal-50/70 border border-teal-200">
              <span className="text-teal-700 block text-[11px]">Monthly Base Standard</span>
              <span className="text-lg font-black text-teal-950 font-mono mt-0.5 block">
                ₹{profile.monthly_salary.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-teal-50/70 border border-teal-200">
              <span className="text-teal-700 block text-[11px]">Overtime Hourly Rate</span>
              <span className="text-lg font-black text-teal-950 font-mono mt-0.5 block">
                ₹{profile.overtime_rate}/hr
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
