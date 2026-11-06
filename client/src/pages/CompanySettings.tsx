import React, { useState, useEffect, useMemo } from 'react';
import { Building2, Users, Shield, Plus, CheckCircle, AlertCircle, RefreshCw, Download, Trash2, AlertTriangle, UserX, UserCheck, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { IconButton } from '../components/ui/IconButton';
import { PageHeader } from '../components/ui/PageHeader';
import { StatusPill } from '../components/ui/StatusPill';
import { DataTable } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { TestDataToggle } from '../components/ui/TestDataToggle';
import { useTestDataToggle } from '../hooks/useTestDataToggle';
import { isTestRecord } from '../lib/testData';

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
  const { user } = useAuth();
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
  const [memberToDeactivate, setMemberToDeactivate] = useState<Member | null>(null);
  const [deactivatingMember, setDeactivatingMember] = useState(false);

  const { showTestData, toggle: toggleTestData } = useTestDataToggle();
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('All');
  const [memberPage, setMemberPage] = useState(1);
  const pageSize = 25;

  const roles = useMemo(() => {
    const set = new Set<string>();
    members.forEach((m) => {
      const r = m.role?.name || `Role #${m.role_id}`;
      if (r) set.add(r);
    });
    return ['All', ...Array.from(set)];
  }, [members]);

  const hiddenMemberTestCount = useMemo(() => {
    return members.filter(m => isTestRecord(m.email) || isTestRecord(m.first_name) || isTestRecord(m.last_name)).length;
  }, [members]);

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      if (!showTestData && (isTestRecord(m.email) || isTestRecord(m.first_name) || isTestRecord(m.last_name))) {
        return false;
      }
      const fullName = `${m.first_name} ${m.last_name}`.toLowerCase();
      const matchesSearch = !memberSearch ||
        fullName.includes(memberSearch.toLowerCase()) ||
        m.email.toLowerCase().includes(memberSearch.toLowerCase());

      const r = m.role?.name || `Role #${m.role_id}`;
      const matchesRole = selectedRole === 'All' || r === selectedRole;

      return matchesSearch && matchesRole;
    });
  }, [members, showTestData, memberSearch, selectedRole]);

  const paginatedMembers = useMemo(() => {
    const start = (memberPage - 1) * pageSize;
    return filteredMembers.slice(start, start + pageSize);
  }, [filteredMembers, memberPage, pageSize]);

  useEffect(() => {
    setMemberPage(1);
  }, [memberSearch, selectedRole, showTestData]);

  const handleConfirmDeactivate = async () => {
    if (!memberToDeactivate) return;
    try {
      setDeactivatingMember(true);
      await handleToggleMemberStatus(memberToDeactivate.id, true);
      setMemberToDeactivate(null);
    } catch (err) {
      console.error('Failed to deactivate member:', err);
    } finally {
      setDeactivatingMember(false);
    }
  };

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
      <PageHeader
        title="Organization Settings"
        subtitle="Manage your company profile, enterprise team members, and role assignments."
        actions={
          <button
            onClick={() => setInviteModalOpen(true)}
            disabled={isSeatLimitReached}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition shadow-sm ${
              isSeatLimitReached
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20'
            }`}
          >
            <Plus className="w-4 h-4" />
            Invite Team Member
          </button>
        }
      />

      {notification && (
        <div
          className={`p-4 rounded-lg flex items-center justify-between text-sm ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
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
        <div className="bg-surface p-6 rounded-lg border border-border shadow-card col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">Company Identity</h2>
                <span className="text-xs font-mono text-slate-400">slug: {profile?.slug}</span>
              </div>
            </div>

            <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              {profile?.status}
            </span>
          </div>

          {isEditingName ? (
            <form onSubmit={handleUpdateName} className="flex items-center gap-3 mt-4">
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                className="px-3 py-2 text-slate-600 text-xs font-medium hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
            </form>
          ) : (
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
              <div>
                <p className="text-xs text-slate-500">Legal Company Name</p>
                <p className="text-lg font-semibold text-slate-900">{profile?.name}</p>
              </div>
              <button
                onClick={() => setIsEditingName(true)}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Edit
              </button>
            </div>
          )}
        </div>

        {/* Plan & Seat Usage Card */}
        <div className="bg-surface p-6 rounded-lg border border-border shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-indigo-500" />
                <h3 className="text-sm font-semibold text-slate-900">Active Subscription</h3>
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                {profile?.planEntitlement?.name}
              </span>
            </div>

            <div className="mt-4">
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>Active Seats</span>
                <span className="font-semibold text-slate-900">
                  {currentMembersCount} / {maxUsers >= 999999 ? 'Unlimited' : maxUsers}
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
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

          <div className="mt-6 pt-4 border-t border-border">
            <Link
              to="/settings/billing"
              className="w-full block text-center py-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
            >
              Manage Plans & Invoices &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Team Members Roster */}
      <div className="space-y-4">
        {/* Search, Role Filter, and Test Data Toggle */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Search member or email..."
                className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
              />
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span>Role:</span>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <TestDataToggle
            showTestData={showTestData}
            onToggle={toggleTestData}
            hiddenCount={hiddenMemberTestCount}
          />
        </div>

        <DataTable<Member>
          columns={[
            {
              key: 'member',
              header: 'Member',
              render: (m) => (
                <div>
                  <div className="font-medium text-slate-900">
                    {m.first_name} {m.last_name}
                  </div>
                  <div className="text-xs text-slate-400 font-mono">{m.email}</div>
                </div>
              )
            },
            {
              key: 'role',
              header: 'Assigned Role',
              render: (m) => {
                const roleName = m.role?.name || `Role #${m.role_id}`;
                const variant =
                  roleName.includes('SUPER_ADMIN') || roleName.includes('ADMIN') ? 'danger' :
                  roleName.includes('OFFICER') || roleName.includes('MANAGER') ? 'info' : 'neutral';
                return <StatusPill variant={variant}>{roleName}</StatusPill>;
              }
            },
            {
              key: 'designation',
              header: 'Designation',
              render: (m) => (
                <span className="text-xs font-medium text-slate-700">
                  {(m as any).employee?.designation || m.department?.name || 'Standard Personnel'}
                </span>
              )
            },
            {
              key: 'status',
              header: 'Status',
              render: (m) => (
                <StatusPill variant={m.is_active ? 'success' : 'neutral'}>
                  {m.is_active ? 'Active' : 'Disabled'}
                </StatusPill>
              )
            },
            {
              key: 'actions',
              header: 'Actions',
              align: 'right',
              render: (m) => {
                const isCurrentUser = Boolean(
                  (user?.id && String(m.id) === String(user.id)) ||
                  (user?.email && m.email.toLowerCase() === user.email.toLowerCase())
                );
                if (isCurrentUser) {
                  return <span className="text-xs text-slate-400 font-medium italic">Current Account</span>;
                }
                if (m.is_active) {
                  return (
                    <IconButton
                      icon={UserX}
                      variant="danger"
                      tooltip="Deactivate team member"
                      aria-label={`Deactivate ${m.first_name} ${m.last_name}`}
                      onClick={() => setMemberToDeactivate(m)}
                    />
                  );
                }
                return (
                  <IconButton
                    icon={UserCheck}
                    variant="ghost"
                    tooltip="Reactivate team member"
                    aria-label={`Reactivate ${m.first_name} ${m.last_name}`}
                    onClick={() => handleToggleMemberStatus(m.id, false)}
                  />
                );
              }
            }
          ]}
          rows={paginatedMembers}
          rowKey={(m) => m.id}
          loading={loading}
          pagination={{
            page: memberPage,
            pageSize,
            total: filteredMembers.length,
            onPageChange: setMemberPage
          }}
          emptyState={
            <EmptyState
              icon={Users}
              title="No team members found"
              description={
                memberSearch || selectedRole !== 'All' || !showTestData
                  ? "No team members match your filter criteria."
                  : "Invite your first colleague to join this workspace."
              }
              action={
                (memberSearch || selectedRole !== 'All') ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMemberSearch('');
                      setSelectedRole('All');
                    }}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                  >
                    Clear filters
                  </button>
                ) : undefined
              }
            />
          }
        />
      </div>

      {/* Data Portability & Danger Zone */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Data Portability */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Download className="w-5 h-5 text-indigo-500" />
              <h3 className="text-base font-semibold text-slate-900">Data Portability & Export</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Download a complete JSON snapshot of your organization's ERP records, team members, inventory, procurement requests, and subscriptions for archival or compliance.
            </p>
          </div>
          <button
            onClick={handleExportData}
            disabled={exporting}
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Generating JSON Snapshot...' : 'Export All Organization Data'}
          </button>
        </div>

        {/* Danger Zone: Account Closure */}
        <div className="bg-white rounded-xl border border-rose-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
              <h3 className="text-base font-semibold text-rose-600">Organization Danger Zone</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Closing your account will suspend all company tenant workspaces, cancel ongoing subscriptions, and revoke member authentication immediately.
            </p>
          </div>
          <button
            onClick={() => setCloseModalOpen(true)}
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-lg text-xs font-semibold transition"
          >
            <Trash2 className="w-4 h-4" />
            Close & Suspend Organization
          </button>
        </div>
      </div>

      {/* Close Account Confirmation Modal */}
      {closeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface rounded-lg max-w-md w-full border border-rose-300 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-700">
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
              <p className="text-xs text-slate-600 leading-relaxed">
                This action is irreversible. To confirm closure of <strong>{profile?.name}</strong>, type its exact slug below:
              </p>

              <div className="p-2 bg-slate-100 rounded font-mono text-xs text-center font-bold text-slate-800 select-all">
                {profile?.slug}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Type Company Slug to Confirm
                </label>
                <input
                  type="text"
                  required
                  value={confirmSlugInput}
                  onChange={(e) => setConfirmSlugInput(e.target.value)}
                  placeholder={profile?.slug}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-rose-300 bg-surface text-slate-900 font-mono"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setCloseModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
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
          <div className="bg-surface rounded-lg max-w-md w-full border border-border shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center">
              <h3 className="text-base font-semibold text-slate-900">Invite Team Member</h3>
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
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    required
                    value={inviteForm.firstName}
                    onChange={(e) => setInviteForm({ ...inviteForm, firstName: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    required
                    value={inviteForm.lastName}
                    onChange={(e) => setInviteForm({ ...inviteForm, lastName: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Work Email Address
                </label>
                <input
                  type="email"
                  required
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface text-slate-900"
                  placeholder="alex@company.com"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Assigned ERP Role
                </label>
                <select
                  value={inviteForm.roleId}
                  onChange={(e) => setInviteForm({ ...inviteForm, roleId: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface text-slate-900"
                >
                  <option value={2}>Staff User (Standard Access)</option>
                  <option value={3}>Procurement Officer</option>
                  <option value={4}>Finance Officer</option>
                  <option value={5}>HR Manager</option>
                  <option value={6}>Company Admin (Tenant Full Control)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Job Designation (Optional)
                </label>
                <input
                  type="text"
                  value={inviteForm.designation}
                  onChange={(e) => setInviteForm({ ...inviteForm, designation: e.target.value })}
                  placeholder="e.g. Senior Inventory Analyst"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface text-slate-900"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
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
      {/* Deactivate Member Confirmation Modal */}
      <ConfirmDialog
        open={Boolean(memberToDeactivate)}
        onCancel={() => setMemberToDeactivate(null)}
        title="Confirm Member Deactivation"
        description={`Are you sure you want to deactivate ${memberToDeactivate?.first_name} ${memberToDeactivate?.last_name} (${memberToDeactivate?.email})? They will immediately lose access to the ENTRIX ERP organization.`}
        confirmLabel={deactivatingMember ? 'Deactivating...' : 'Deactivate Member'}
        cancelLabel="Cancel"
        variant="danger"
        loading={deactivatingMember}
        onConfirm={handleConfirmDeactivate}
      />
    </div>
  );
};

export default CompanySettings;
