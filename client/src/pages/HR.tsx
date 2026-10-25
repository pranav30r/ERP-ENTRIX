import React, { useState, useEffect } from 'react';
import { RefreshCw, UserPlus, Calendar, Search, Edit2, X, Loader2, CheckCircle2 } from 'lucide-react';
import { apiClient, ensureAuthenticated } from '../services/api';
import { Button } from '../components/ui/Button';

export const HR: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'employees' | 'attendance'>('employees');
  const [employees, setEmployees] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [attendanceDate, setAttendanceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [forbiddenError, setForbiddenError] = useState<string | null>(null);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Add Employee Form State
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newDesignation, setNewDesignation] = useState('');
  const [newEmployeeCode, setNewEmployeeCode] = useState('');
  const [newBaseSalary, setNewBaseSalary] = useState('65000');
  const [newLeaveBalance, setNewLeaveBalance] = useState('18');

  // Edit Employee Form State
  const [editDesignation, setEditDesignation] = useState('');
  const [editBaseSalary, setEditBaseSalary] = useState('');
  const [editLeaveBalance, setEditLeaveBalance] = useState('');

  // Log Attendance Form State
  const [attEmployeeId, setAttEmployeeId] = useState('');
  const [attStatus, setAttStatus] = useState<'PRESENT' | 'ABSENT' | 'ON_LEAVE' | 'HALF_DAY'>('PRESENT');
  const [attCheckIn, setAttCheckIn] = useState('09:00');
  const [attCheckOut, setAttCheckOut] = useState('18:00');
  const [attNotes, setAttNotes] = useState('');

  const fetchEmployees = async () => {
    setLoading(true);
    setForbiddenError(null);
    try {
      await ensureAuthenticated();
      const res = await apiClient.get('/hr/employees', { params: { search } });
      if (res.data.success && Array.isArray(res.data.data)) {
        setEmployees(res.data.data);
      }
    } catch (err: any) {
      if (err.response?.status === 403) {
        setForbiddenError(err.response?.data?.error || 'Access Forbidden. Role does not have permission to view employee roster.');
      } else {
        console.error('Failed to load employee directory:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendance = async () => {
    setLoading(true);
    setForbiddenError(null);
    try {
      await ensureAuthenticated();
      const res = await apiClient.get('/hr/attendance', { params: { date: attendanceDate } });
      if (res.data.success && Array.isArray(res.data.data)) {
        setAttendance(res.data.data);
      }
    } catch (err: any) {
      if (err.response?.status === 403) {
        setForbiddenError(err.response?.data?.error || 'Access Forbidden.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'employees') {
      fetchEmployees();
    } else {
      fetchAttendance();
    }
  }, [activeTab, search, attendanceDate]);

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedbackMsg(null);
    try {
      await ensureAuthenticated();
      const res = await apiClient.post('/hr/employees', {
        first_name: newFirstName,
        last_name: newLastName,
        email: newEmail,
        designation: newDesignation,
        employee_code: newEmployeeCode,
        base_salary: Number(newBaseSalary),
        annual_leave_balance: Number(newLeaveBalance)
      });
      if (res.data.success) {
        setShowAddModal(false);
        setNewFirstName('');
        setNewLastName('');
        setNewEmail('');
        setNewDesignation('');
        setNewEmployeeCode('');
        setFeedbackMsg({ type: 'success', text: 'Employee registered successfully.' });
        await fetchEmployees();
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.response?.data?.error || 'Failed to create employee.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    setSubmitting(true);
    setFeedbackMsg(null);
    try {
      await ensureAuthenticated();
      const res = await apiClient.put(`/hr/employees/${selectedEmployee.id}`, {
        designation: editDesignation,
        base_salary: Number(editBaseSalary),
        annual_leave_balance: Number(editLeaveBalance)
      });
      if (res.data.success) {
        setShowEditModal(false);
        setFeedbackMsg({ type: 'success', text: 'Employee record updated.' });
        await fetchEmployees();
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.response?.data?.error || 'Update failed.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedbackMsg(null);
    try {
      await ensureAuthenticated();
      const res = await apiClient.post('/hr/attendance', {
        employee_id: attEmployeeId,
        date: attendanceDate,
        status: attStatus,
        check_in_time: attCheckIn,
        check_out_time: attCheckOut,
        notes: attNotes
      });
      if (res.data.success) {
        setShowAttendanceModal(false);
        setAttNotes('');
        setFeedbackMsg({ type: 'success', text: 'Attendance logged successfully.' });
        await fetchAttendance();
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.response?.data?.error || 'Failed to record attendance.' });
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (emp: any) => {
    setSelectedEmployee(emp);
    setEditDesignation(emp.designation || '');
    setEditBaseSalary(String(emp.base_salary || '0'));
    setEditLeaveBalance(String(emp.annual_leave_balance || '18'));
    setShowEditModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Human Resource Management</h2>
          <p className="text-xs text-slate-500 mt-0.5">Personnel directory, organizational records, and daily attendance tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={activeTab === 'employees' ? fetchEmployees : fetchAttendance} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {activeTab === 'employees' ? (
            <Button variant="primary" size="sm" onClick={() => setShowAddModal(true)}>
              <UserPlus className="w-3.5 h-3.5 mr-1.5" />
              Add Employee
            </Button>
          ) : (
            <Button variant="primary" size="sm" onClick={() => {
              if (employees.length > 0 && !attEmployeeId) setAttEmployeeId(employees[0].id);
              setShowAttendanceModal(true);
            }}>
              <Calendar className="w-3.5 h-3.5 mr-1.5" />
              Log Attendance
            </Button>
          )}
        </div>
      </div>

      {/* Feedback Alert */}
      {feedbackMsg && (
        <div
          role="alert"
          className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
            feedbackMsg.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{feedbackMsg.text}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="p-1 hover:opacity-75">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200 flex gap-6 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('employees')}
          className={`pb-2.5 transition-colors border-b-2 ${
            activeTab === 'employees'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Employee Directory ({employees.length})
        </button>
        <button
          onClick={() => setActiveTab('attendance')}
          className={`pb-2.5 transition-colors border-b-2 ${
            activeTab === 'attendance'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Daily Attendance Records
        </button>
      </div>

      {/* RBAC Forbidden Error State */}
      {forbiddenError ? (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto text-xl font-bold">
            403
          </div>
          <h3 className="text-sm font-bold text-slate-800">Access Restricted (RBAC Policy Enforced)</h3>
          <p className="text-xs text-slate-600 max-w-md mx-auto">{forbiddenError}</p>
          <span className="text-[11px] text-slate-400 block">Switch to HR Manager or Super Admin in the top-right header to view employee records.</span>
        </div>
      ) : activeTab === 'employees' ? (
        /* Tab 1: Employee Directory */
        <div className="space-y-4">
          {/* Search bar */}
          <div className="flex items-center gap-2 max-w-sm">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by code, designation..."
                className="w-full pl-9 pr-4 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[10px] uppercase">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Code</th>
                    <th className="py-2.5 px-4 font-semibold">Full Name</th>
                    <th className="py-2.5 px-4 font-semibold">Designation</th>
                    <th className="py-2.5 px-4 font-semibold">Email</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Base Salary</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Leave Balance</th>
                    <th className="py-2.5 px-4 font-semibold text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">Loading directory from PostgreSQL...</td>
                    </tr>
                  ) : employees.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">No matching employees found.</td>
                    </tr>
                  ) : (
                    employees.map((emp) => (
                      <tr key={emp.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-mono font-medium text-slate-900">{emp.employee_code}</td>
                        <td className="py-3 px-4 font-medium text-slate-800">
                          {emp.user ? `${emp.user.first_name} ${emp.user.last_name}` : 'Staff Member'}
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-medium">{emp.designation}</td>
                        <td className="py-3 px-4 font-mono text-slate-500">{emp.user?.email || '—'}</td>
                        <td className="py-3 px-4 text-right font-mono text-slate-900 font-semibold">
                          ₹{Number(emp.base_salary).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-700">
                          {emp.annual_leave_balance} Days
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => openEditModal(emp)}
                            aria-label={`Edit ${emp.employee_code}`}
                            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Tab 2: Attendance Records */
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-slate-600">Select Date:</label>
            <input
              type="date"
              value={attendanceDate}
              onChange={(e) => setAttendanceDate(e.target.value)}
              className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[10px] uppercase">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Employee</th>
                    <th className="py-2.5 px-4 font-semibold">Date</th>
                    <th className="py-2.5 px-4 font-semibold text-center">Status</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Check In</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Check Out</th>
                    <th className="py-2.5 px-4 font-semibold">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">Loading attendance data...</td>
                    </tr>
                  ) : attendance.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">No attendance entries recorded for this date.</td>
                    </tr>
                  ) : (
                    attendance.map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-medium text-slate-900">
                          {rec.employee?.user ? `${rec.employee.user.first_name} ${rec.employee.user.last_name}` : 'Employee'}
                          <span className="text-[10px] text-slate-400 font-mono block">{rec.employee?.employee_code}</span>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600">{rec.date}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            rec.status === 'PRESENT'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : rec.status === 'ON_LEAVE'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : rec.status === 'HALF_DAY'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {rec.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-800">{rec.check_in_time || '—'}</td>
                        <td className="py-3 px-4 text-right font-mono text-slate-800">{rec.check_out_time || '—'}</td>
                        <td className="py-3 px-4 text-slate-500">{rec.notes || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Add New Personnel Record</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateEmployee} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Corporate Email *</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Employee Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="EMP-ENG-005"
                    value={newEmployeeCode}
                    onChange={(e) => setNewEmployeeCode(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Designation *</label>
                  <input
                    type="text"
                    required
                    placeholder="DevOps Engineer"
                    value={newDesignation}
                    onChange={(e) => setNewDesignation(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Base Salary (₹)</label>
                  <input
                    type="number"
                    value={newBaseSalary}
                    onChange={(e) => setNewBaseSalary(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Leave Balance (Days)</label>
                  <input
                    type="number"
                    value={newLeaveBalance}
                    onChange={(e) => setNewLeaveBalance(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={submitting}>
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                  Create Record
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Update Employee: {selectedEmployee?.employee_code}</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleUpdateEmployee} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Designation</label>
                <input
                  type="text"
                  required
                  value={editDesignation}
                  onChange={(e) => setEditDesignation(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Base Salary (₹)</label>
                  <input
                    type="number"
                    required
                    value={editBaseSalary}
                    onChange={(e) => setEditBaseSalary(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Annual Leave Balance</label>
                  <input
                    type="number"
                    required
                    value={editLeaveBalance}
                    onChange={(e) => setEditLeaveBalance(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowEditModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={submitting}>
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Attendance Modal */}
      {showAttendanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Record Daily Attendance</h3>
              <button onClick={() => setShowAttendanceModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleLogAttendance} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Employee *</label>
                <select
                  required
                  value={attEmployeeId}
                  onChange={(e) => setAttEmployeeId(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500"
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.employee_code} — {emp.user ? `${emp.user.first_name} ${emp.user.last_name}` : 'Staff'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Attendance Status *</label>
                  <select
                    value={attStatus}
                    onChange={(e: any) => setAttStatus(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 font-mono"
                  >
                    <option value="PRESENT">PRESENT</option>
                    <option value="ABSENT">ABSENT</option>
                    <option value="ON_LEAVE">ON_LEAVE</option>
                    <option value="HALF_DAY">HALF_DAY</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={attendanceDate}
                    onChange={(e) => setAttendanceDate(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Check In Time</label>
                  <input
                    type="time"
                    value={attCheckIn}
                    onChange={(e) => setAttCheckIn(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Check Out Time</label>
                  <input
                    type="time"
                    value={attCheckOut}
                    onChange={(e) => setAttCheckOut(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notes / Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. Remote work approved"
                  value={attNotes}
                  onChange={(e) => setAttNotes(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAttendanceModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={submitting}>
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                  Submit Attendance
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HR;
