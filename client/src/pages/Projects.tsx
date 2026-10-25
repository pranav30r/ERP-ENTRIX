import React, { useState } from 'react';

export const Projects: React.FC = () => {
  const [projects] = useState([
    {
      id: 'prj-001',
      name: 'Project Apollo — Core ERP Architecture',
      code: 'PRJ-APOLLO',
      dept: 'Engineering',
      allocated: 150000,
      consumed: 85000,
      milestones: '6 / 10',
      hours: '120 / 180 hrs',
      status: 'IN_PROGRESS',
      progress: 60
    },
    {
      id: 'prj-002',
      name: 'Warehouse Automation & RFID Tagging',
      code: 'PRJ-RFID',
      dept: 'Procurement',
      allocated: 80000,
      consumed: 32000,
      milestones: '4 / 6',
      hours: '65 / 90 hrs',
      status: 'IN_PROGRESS',
      progress: 66
    }
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Project Milestones & Resource Operations</h2>
          <p className="text-xs text-slate-500 mt-0.5">Tracking developer hours, milestone completion, and budget burndown</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projects.map((p) => (
          <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                  {p.code}
                </span>
                <h3 className="text-sm font-bold text-slate-800 mt-1.5">{p.name}</h3>
                <p className="text-xs text-slate-400 font-medium">{p.dept} Department</p>
              </div>
              <span className="text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                {p.status}
              </span>
            </div>

            {/* Progress Bar */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-500">Milestone Progress</span>
                <span className="font-mono font-bold text-slate-700">{p.progress}%</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-indigo-600 h-full rounded-full transition-all" style={{ width: `${p.progress}%` }}></div>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
              <div>
                <p className="text-slate-400 text-[11px]">Budget Burn</p>
                <p className="font-mono font-bold text-slate-900">
                  ₹{p.consumed.toLocaleString('en-IN')} <span className="text-slate-400 font-normal">/ ₹{p.allocated.toLocaleString('en-IN')}</span>
                </p>
              </div>
              <div>
                <p className="text-slate-400 text-[11px]">Developer Effort</p>
                <p className="font-mono font-bold text-slate-900">{p.hours}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
