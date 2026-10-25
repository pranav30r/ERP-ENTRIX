import React, { useState, useEffect } from 'react';
import { apiClient, ensureAuthenticated } from '../services/api';
import { Button } from '../components/ui/Button';
import { RefreshCw } from 'lucide-react';

export const Projects: React.FC = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      await ensureAuthenticated();
      const res = await apiClient.get('/projects');
      if (res.data.success && Array.isArray(res.data.data)) {
        setProjects(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Project Milestones & Resource Operations</h2>
          <p className="text-xs text-slate-500 mt-0.5">Tracking developer hours, milestone completion, and budget burndown</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchProjects} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-400 bg-white rounded-xl border border-slate-200">
          Loading project telemetry from backend...
        </div>
      ) : projects.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-400 bg-white rounded-xl border border-slate-200">
          No active projects recorded.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((p) => {
            const progress = p.milestones_total > 0 
              ? Math.round((p.milestones_completed / p.milestones_total) * 100) 
              : 0;

            return (
              <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                      {p.code}
                    </span>
                    <h3 className="text-sm font-bold text-slate-800 mt-1.5">{p.name}</h3>
                    <p className="text-xs text-slate-400 font-medium">{p.department_code || 'General'} Department</p>
                  </div>
                  <span className="text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                    {p.status}
                  </span>
                </div>

                {/* Progress Bar */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500">Milestone Progress</span>
                    <span className="font-mono font-bold text-slate-700">{progress}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-xs">
                  <div>
                    <span className="text-[11px] text-slate-400">Budget</span>
                    <p className="font-mono font-bold text-slate-800">
                      ₹{Number(p.consumed_budget || 0).toLocaleString()} / ₹{Number(p.allocated_budget || 0).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400">Milestones</span>
                    <p className="font-mono font-bold text-slate-800">
                      {p.milestones_completed} / {p.milestones_total}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400">Dev Hours</span>
                    <p className="font-mono font-bold text-slate-800">
                      {p.logged_hours} / {p.estimated_hours} hrs
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Projects;
