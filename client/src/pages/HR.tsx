import React, { useState } from 'react';

export const HR: React.FC = () => {
  const [employees] = useState([
    { code: 'EMP-2026-001', name: 'Aditya Sakarkar', dept: 'Engineering', role: 'Lead Architect', status: 'PRESENT', leaveBalance: 16 },
    { code: 'EMP-2026-002', name: 'Chetan Gupta', dept: 'Backend', role: 'Database Engineer', status: 'PRESENT', leaveBalance: 18 },
    { code: 'EMP-2026-003', name: 'Pranav Rathi', dept: 'AI & Data', role: 'ML Pipeline Engineer', status: 'PRESENT', leaveBalance: 17 },
    { code: 'EMP-2026-004', name: 'Rohan Sharma', dept: 'Procurement', role: 'Logistics Officer', status: 'ON_LEAVE', leaveBalance: 12 }
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Human Resource Management</h2>
          <p className="text-xs text-slate-500 mt-0.5">Personnel directory, department rosters, and daily attendance tracking</p>
        </div>
      </div>

      {/* Directory Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Employee Organizational Directory</h3>
          <span className="text-xs text-slate-400 font-mono">4 Active Employees</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[10px] uppercase">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Employee Code</th>
                <th className="py-2.5 px-4 font-semibold">Full Name</th>
                <th className="py-2.5 px-4 font-semibold">Department</th>
                <th className="py-2.5 px-4 font-semibold">Designation</th>
                <th className="py-2.5 px-4 font-semibold text-center">Attendance Today</th>
                <th className="py-2.5 px-4 font-semibold text-right">PTO Leave Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {employees.map((emp) => (
                <tr key={emp.code} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-mono font-medium text-slate-900">{emp.code}</td>
                  <td className="py-3 px-4 font-medium text-slate-800">{emp.name}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px]">
                      {emp.dept}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600">{emp.role}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold
                      ${emp.status === 'PRESENT' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}
                    `}>
                      {emp.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-semibold text-slate-800">
                    {emp.leaveBalance} Days
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
