import React, { useState, useEffect } from 'react';
import { Building2, Users, Shield, Plus, CheckCircle, AlertCircle, RefreshCw, Download, Trash2, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../services/api';

interface CompanyProfile {
  id: string;
  name: string;
  slug: string;
  status: string;
  memberCount: number;
  subscription: {
    tier: string;
    status: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
  } | null;
  planEntitlement: {
    tier: string;
    name: string;
    maxUsers: number;
    maxMonthlyAiInferences: number;
    maxStorageMB: number;
    allowedModules: string[];
  };
}

interface Member {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role_id: number;
  role?: { name: string };
  department?: { name: string; code: string };
  is_active: boolean;
  created_at: string;
}

export const CompanySettings: React.FC = () => {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    roleId: 2, // Staff User default
    designation: ''
  });
  const [inviting, setInviting] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [confirmSlugInput, setConfirmSlugInput] = useState('');
  const [closing, setClosing] = useState(false);

  const fetchProfileAndMembers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('entrix_token') || localStorage.getItem('token') || localStorage.getItem('access_token');
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      };

      const [profRes, membRes] = await Promise.all([
        fetch(`${API_BASE_URL}/company/profile`, { headers }),
        fetch(`${API_BASE_URL}/company/members`, { headers })
      ]);

      if (profRes.ok) {
        const profData = await profRes.json();
        setProfile(profData.company);
        setCompanyName(profData.company.name);
      }

      if (membRes.ok) {
        const membData = await membRes.json();
        setMembers(membData.members || []);
      }
    } catch (err) {
      console.error('Failed to load company settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileAndMembers();
  }, []);

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) return;

    try {
      setSavingName(true);
      const token = localStorage.getItem('entrix_token') || localStorage.getItem('token') || localStorage.getItem('access_token');
      const res = await fetch(`${API_BASE_URL}/company/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: companyName.trim() })
      });

      if (res.ok) {
        setIsEditingName(false);
        setNotification({ type: 'success', message: 'Company name updated successfully.' });
        fetchProfileAndMembers();
      } else {
        const err = await res.json();
        setNotification({ type: 'error', message: err.error || 'Failed to update company name.' });
      }
    } catch (err) {
      setNotification({ type: 'error', message: 'Network error updating company profile.' });
    } finally {
      setSavingName(false);
    }
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setInviting(true);
      const token = localStorage.getItem('entrix_token') || localStorage.getItem('token') || localStorage.getItem('access_token');
      const res = await fetch(`${API_BASE_URL}/company/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(inviteForm)
      });

      if (res.ok) {
        setInviteModalOpen(false);
        setInviteForm({ firstName: '', lastName: '', email: '', roleId: 2, designation: '' });
        setNotification({ type: 'success', message: `Invited ${inviteForm.email} successfully.` });
        fetchProfileAndMembers();
      } else {
        const err = await res.json();
        setNotification({ type: 'error', message: err.message || err.error || 'Failed to invite member.' });
      }
    } catch (err) {
      setNotification({ type: 'error', message: 'Network error inviting member.' });
    } finally {
      setInviting(false);
    }
  };

  const handleToggleMemberStatus = async (memberId: string, currentActive: boolean) => {
    try {
      const token = localStorage.getItem('entrix_token') || localStorage.getItem('token') || localStorage.getItem('access_token');
      const res = await fetch(`${API_BASE_URL}/company/members/${memberId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ isActive: !currentActive })
      });

      if (res.ok) {
        fetchProfileAndMembers();
      }
    } catch (err) {
      console.error('Failed to toggle member status:', err);
    }
  };

  const handleExportData = async () => {
    try {
      setExporting(true);
      const token = localStorage.getItem('entrix_token') || localStorage.getItem('token') || localStorage.getItem('access_token');
      const res = await fetch(`${API_BASE_URL}/company/export`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `entrix_backup_${profile?.slug || 'tenant'}_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setNotification({ type: 'success', message: 'Tenant data export package generated and downloaded successfully.' });
      } else {
        const err = await res.json();
        setNotification({ type: 'error', message: err.error || 'Failed to export tenant data.' });
      }
    } catch (err) {
      setNotification({ type: 'error', message: 'Network error exporting tenant data.' });
    } finally {
      setExporting(false);
    }
  };

  const handleCloseAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    try {
      setClosing(true);
      const token = localStorage.getItem('entrix_token') || localStorage.getItem('token') || localStorage.getItem('access_token');
      const res = await fetch(`${API_BASE_URL}/company/close-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          confirmSlug: confirmSlugInput.trim(),
          reason: 'Company administrator requested account deactivation'
        })
      });

      if (res.ok) {
        setCloseModalOpen(false);
        setNotification({
          type: 'success',
          message: 'Company account successfully closed. Access credentials suspended.'
        });
        setTimeout(() => {
          localStorage.clear();
          window.location.href = '/';
        }, 1500);
      } else {
        const err = await res.json();
        setNotification({ type: 'error', message: err.error || 'Failed to close company account.' });
      }
    } catch (err) {
      setNotification({ type: 'error', message: 'Network error closing account.' });
    } finally {
      setClosing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[350px]">
        <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  const maxUsers = profile?.planEntitlement?.maxUsers || 10;
  const currentMembersCount = members.filter(m => m.is_active).length;
  const isSeatLimitReached = currentMembersCount >= maxUsers;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Organization Settings</h1>
          <p className="text-sm text-slate-500 dark:text-charcoal-300">
            Manage your company profile, enterprise team members, and role assignments.
          </p>
        </div>

        <button
          onClick={() => setInviteModalOpen(true)}
          disabled={isSeatLimitReached}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition shadow-sm ${
            isSeatLimitReached
              ? 'bg-slate-300 text-slate-500 cursor-not-allowed dark:bg-charcoal-700 dark:text-charcoal-400'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20'
          }`}
        >
          <Plus className="w-4 h-4" />
          Invite Team Member
        </button>
      </div>

      {notification && (
        <div
          className={`p-4 rounded-lg flex items-center justify-between text-sm ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
              : 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="font-semibold text-xs opacity-70 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {/* Profile & Entitlement Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Company Card */}
        <div className="bg-white dark:bg-charcoal-900 p-6 rounded-xl border border-slate-200 dark:border-charcoal-800 shadow-sm col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Company Identity</h2>
                <span className="text-xs font-mono text-slate-400">slug: {profile?.slug}</span>
              </div>
            </div>

            <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              {profile?.status}
            </span>
          </div>

          {isEditingName ? (
            <form onSubmit={handleUpdateName} className="flex items-center gap-3 mt-4">
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-charcoal-700 bg-white dark:bg-charcoal-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
              <button
                type="submit"
                disabled={savingName}
                className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {savingName ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEditingName(false);
                  setCompanyName(profile?.name || '');
                }}
                className="px-3 py-2 text-slate-600 dark:text-charcoal-300 text-xs font-medium hover:bg-slate-100 dark:hover:bg-charcoal-800 rounded-lg"
              >
                Cancel
              </button>
            </form>
          ) : (
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-charcoal-800">
              <div>
                <p className="text-xs text-slate-500 dark:text-charcoal-400">Legal Company Name</p>
                <p className="text-lg font-semibold text-slate-900 dark:text-white">{profile?.name}</p>
              </div>
              <button
                onClick={() => setIsEditingName(true)}
                className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 font-medium"
              >
                Edit
              </button>
            </div>
          )}
        </div>

        {/* Plan & Seat Usage Card */}
        <div className="bg-white dark:bg-charcoal-900 p-6 rounded-xl border border-slate-200 dark:border-charcoal-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-indigo-500" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Active Subscription</h3>
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                {profile?.planEntitlement?.name}
              </span>
            </div>

            <div className="mt-4">
              <div className="flex justify-between text-xs text-slate-500 dark:text-charcoal-400 mb-1">
                <span>Active Seats</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {currentMembersCount} / {maxUsers >= 999999 ? 'Unlimited' : maxUsers}
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-charcoal-800 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all ${
                    isSeatLimitReached ? 'bg-rose-500' : 'bg-indigo-600'
                  }`}
                  style={{ width: `${Math.min(100, (currentMembersCount / (maxUsers || 1)) * 100)}%` }}
                />
              </div>
              {isSeatLimitReached && (
                <p className="text-xs text-rose-500 mt-2 font-medium">
                  Seat limit reached. Upgrade plan to invite more team members.
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-charcoal-800">
            <Link
              to="/settings/billing"
              className="w-full block text-center py-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition"
            >
              Manage Plans & Invoices &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Team Members Roster */}
      <div className="bg-white dark:bg-charcoal-900 rounded-xl border border-slate-200 dark:border-charcoal-800 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-charcoal-800 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-500" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Team Directory</h2>
          </div>
          <span className="text-xs text-slate-500 dark:text-charcoal-400">
            {members.length} registered member{members.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-charcoal-300">
            <thead className="bg-slate-50 dark:bg-charcoal-800/60 text-xs font-semibold text-slate-500 dark:text-charcoal-400 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3">Member</th>
                <th className="px-6 py-3">Assigned Role</th>
                <th className="px-6 py-3">Designation</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-charcoal-800">
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-charcoal-800/40 transition">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900 dark:text-white">
                      {m.first_name} {m.last_name}
                    </div>
                    <div className="text-xs text-slate-400">{m.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-slate-100 text-slate-700 dark:bg-charcoal-800 dark:text-charcoal-300 border border-slate-200 dark:border-charcoal-700">
                      {m.role?.name || `Role #${m.role_id}`}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs">
                    {(m as any).employee?.designation || m.department?.name || 'Standard Personnel'}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        m.is_active
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                          : 'bg-slate-100 text-slate-500 dark:bg-charcoal-800 dark:text-charcoal-400'
                      }`}
                    >
                      {m.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleToggleMemberStatus(m.id, m.is_active)}
                      className={`text-xs font-medium transition ${
                        m.is_active
                          ? 'text-rose-600 hover:text-rose-700 dark:text-rose-400'
                          : 'text-indigo-600 hover:text-indigo-700 dark:text-indigo-400'
                      }`}
                    >
                      {m.is_active ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Data Portability & Danger Zone */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Data Portability */}
        <div className="bg-white dark:bg-charcoal-900 rounded-xl border border-slate-200 dark:border-charcoal-800 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Download className="w-5 h-5 text-indigo-500" />
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Data Portability & Export</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-charcoal-400 mb-4">
              Download a complete JSON snapshot of your organization's ERP records, team members, inventory, procurement requests, and subscriptions for archival or compliance.
            </p>
          </div>
          <button
            onClick={handleExportData}
            disabled={exporting}
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-charcoal-800 dark:hover:bg-charcoal-700 dark:text-white rounded-lg text-xs font-semibold transition"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Generating JSON Snapshot...' : 'Export All Organization Data'}
          </button>
        </div>

        {/* Danger Zone: Account Closure */}
        <div className="bg-white dark:bg-charcoal-900 rounded-xl border border-rose-200 dark:border-rose-950/60 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
              <h3 className="text-base font-semibold text-rose-600 dark:text-rose-400">Organization Danger Zone</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-charcoal-400 mb-4">
              Closing your account will suspend all company tenant workspaces, cancel ongoing subscriptions, and revoke member authentication immediately.
            </p>
          </div>
          <button
            onClick={() => setCloseModalOpen(true)}
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 dark:bg-rose-950/30 dark:hover:bg-rose-950/50 dark:border-rose-900 dark:text-rose-400 rounded-lg text-xs font-semibold transition"
          >
            <Trash2 className="w-4 h-4" />
            Close & Suspend Organization
          </button>
        </div>
      </div>

      {/* Close Account Confirmation Modal */}
      {closeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-charcoal-900 rounded-xl max-w-md w-full border border-rose-300 dark:border-rose-900 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-rose-50 dark:bg-rose-950/40 border-b border-rose-100 dark:border-rose-900/60 flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-sm font-bold">Confirm Organization Closure</h3>
              </div>
              <button
                onClick={() => setCloseModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-semibold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCloseAccount} className="p-6 space-y-4">
              <p className="text-xs text-slate-600 dark:text-charcoal-300 leading-relaxed">
                This action is irreversible. To confirm closure of <strong>{profile?.name}</strong>, type its exact slug below:
              </p>

              <div className="p-2 bg-slate-100 dark:bg-charcoal-800 rounded font-mono text-xs text-center font-bold text-slate-800 dark:text-white select-all">
                {profile?.slug}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-charcoal-300 mb-1">
                  Type Company Slug to Confirm
                </label>
                <input
                  type="text"
                  required
                  value={confirmSlugInput}
                  onChange={(e) => setConfirmSlugInput(e.target.value)}
                  placeholder={profile?.slug}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-rose-300 dark:border-rose-800 bg-white dark:bg-charcoal-800 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 dark:border-charcoal-800">
                <button
                  type="button"
                  onClick={() => setCloseModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-charcoal-300 hover:bg-slate-100 dark:hover:bg-charcoal-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={closing || confirmSlugInput.trim() !== profile?.slug}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white text-xs font-semibold rounded-lg shadow-sm"
                >
                  {closing ? 'Closing Account...' : 'Permanently Deactivate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-charcoal-900 rounded-xl max-w-md w-full border border-slate-200 dark:border-charcoal-800 shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-charcoal-800 flex justify-between items-center">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Invite Team Member</h3>
              <button
                onClick={() => setInviteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleInviteMember} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-charcoal-300 mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    required
                    value={inviteForm.firstName}
                    onChange={(e) => setInviteForm({ ...inviteForm, firstName: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-charcoal-700 bg-white dark:bg-charcoal-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-charcoal-300 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    required
                    value={inviteForm.lastName}
                    onChange={(e) => setInviteForm({ ...inviteForm, lastName: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-charcoal-700 bg-white dark:bg-charcoal-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-charcoal-300 mb-1">
                  Work Email Address
                </label>
                <input
                  type="email"
                  required
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-charcoal-700 bg-white dark:bg-charcoal-800 text-slate-900 dark:text-white"
                  placeholder="alex@company.com"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-charcoal-300 mb-1">
                  Assigned ERP Role
                </label>
                <select
                  value={inviteForm.roleId}
                  onChange={(e) => setInviteForm({ ...inviteForm, roleId: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-charcoal-700 bg-white dark:bg-charcoal-800 text-slate-900 dark:text-white"
                >
                  <option value={2}>Staff User (Standard Access)</option>
                  <option value={3}>Procurement Officer</option>
                  <option value={4}>Finance Officer</option>
                  <option value={5}>HR Manager</option>
                  <option value={6}>Company Admin (Tenant Full Control)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-charcoal-300 mb-1">
                  Job Designation (Optional)
                </label>
                <input
                  type="text"
                  value={inviteForm.designation}
                  onChange={(e) => setInviteForm({ ...inviteForm, designation: e.target.value })}
                  placeholder="e.g. Senior Inventory Analyst"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-charcoal-700 bg-white dark:bg-charcoal-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 dark:border-charcoal-800">
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-charcoal-300 hover:bg-slate-100 dark:hover:bg-charcoal-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm disabled:opacity-50"
                >
                  {inviting ? 'Inviting...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanySettings;
