import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { apiClient, ensureAuthenticated } from '../services/api';
import { Button } from '../components/ui/Button';

export const HR: React.FC = () => {
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      await ensureAuthenticated();
      const res = await apiClient.get('/hr/employees');
      if (res.data.success && Array.isArray(res.data.data)) {
        setEmployees(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load employee directory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Human Resource Management</h2>
          <p className="text-xs text-slate-500 mt-0.5">Personnel directory, department rosters, and daily attendance tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchEmployees} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Roster
          </Button>
        </div>
      </div>

      {/* Directory Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Employee Organizational Directory</h3>
          <span className="text-xs text-slate-400 font-mono">{employees.length} Active Personnel</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[10px] uppercase">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Employee Code</th>
                <th className="py-2.5 px-4 font-semibold">Full Name</th>
                <th className="py-2.5 px-4 font-semibold">Designation</th>
                <th className="py-2.5 px-4 font-semibold">Email</th>
                <th className="py-2.5 px-4 font-semibold text-center">Status</th>
                <th className="py-2.5 px-4 font-semibold text-right">PTO Leave Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">Loading employee directory from PostgreSQL...</td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">No employee records found.</td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-medium text-slate-900">{emp.employee_code}</td>
                    <td className="py-3 px-4 font-medium text-slate-800">
                      {emp.user ? `${emp.user.first_name} ${emp.user.last_name}` : 'Staff Member'}
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-medium">
                      {emp.designation}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500">{emp.user?.email || '—'}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        ACTIVE
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-slate-800">
                      {emp.annual_leave_balance} Days
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

export default HR;
