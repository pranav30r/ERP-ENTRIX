import React, { useState, useEffect } from 'react';
import { apiClient, ensureAuthenticated } from '../services/api';
import { Button } from '../components/ui/Button';
import { RefreshCw, Plus, CheckCircle, X, Loader2, PlayCircle } from 'lucide-react';

export const Projects: React.FC = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Create Project Form
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [departmentCode, setDepartmentCode] = useState('DEPT-ENG');
  const [allocatedBudget, setAllocatedBudget] = useState('120000');
  const [estimatedHours, setEstimatedHours] = useState('160');
  const [milestonesTotal, setMilestonesTotal] = useState('8');

  // Progress Form
  const [advanceMilestones, setAdvanceMilestones] = useState(1);
  const [additionalHours, setAdditionalHours] = useState(15);
  const [additionalCost, setAdditionalCost] = useState(12500);

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

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      await ensureAuthenticated();
      const res = await apiClient.post('/projects', {
        name,
        code,
        department_code: departmentCode,
        allocated_budget: Number(allocatedBudget),
        estimated_hours: Number(estimatedHours),
        milestones_total: Number(milestonesTotal)
      });
      if (res.data.success) {
        setShowCreateModal(false);
        setName('');
        setCode('');
        setFeedback('Project initiative created successfully.');
        await fetchProjects();
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create project.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    setSubmitting(true);
    try {
      await ensureAuthenticated();
      const res = await apiClient.put(`/projects/${selectedProject.id}/progress`, {
        advance_milestones: Number(advanceMilestones),
        additional_hours: Number(additionalHours),
        additional_cost: Number(additionalCost)
      });
      if (res.data.success) {
        setShowProgressModal(false);
        setFeedback(`Milestone advanced for ${selectedProject.code}.`);
        await fetchProjects();
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to advance milestone.');
    } finally {
      setSubmitting(false);
    }
  };

  const openProgressModal = (project: any) => {
    setSelectedProject(project);
    setAdvanceMilestones(1);
    setAdditionalHours(15);
    setAdditionalCost(12500);
    setShowProgressModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
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
          <Button variant="primary" size="sm" onClick={() => setShowCreateModal(true)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            New Project
          </Button>
        </div>
      </div>

      {feedback && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>{feedback}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="p-1 text-emerald-600 hover:opacity-75">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-400 bg-white rounded-xl border border-slate-200">
          Loading project telemetry from backend...
        </div>
      ) : projects.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-400 bg-white rounded-xl border border-slate-200">
          No active projects recorded. Click "New Project" to launch an initiative.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((p) => {
            const progress = p.milestones_total > 0
              ? Math.min(100, Math.round((p.milestones_completed / p.milestones_total) * 100))
              : 0;

            const isCompleted = p.status === 'COMPLETED' || progress >= 100;

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
                  <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${
                    isCompleted
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-blue-50 text-blue-700 border-blue-200'
                  }`}>
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
                      className={`h-2 rounded-full transition-all duration-300 ${
                        isCompleted ? 'bg-emerald-500' : 'bg-indigo-600'
                      }`}
                      style={{ width: `${progress}%` }}
                    />
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

                {/* Actions */}
                {!isCompleted && (
                  <div className="pt-2 border-t border-slate-50 flex justify-end">
                    <Button variant="outline" size="sm" onClick={() => openProgressModal(p)}>
                      <PlayCircle className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
                      Advance Milestone
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Launch New Project Initiative</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateProject} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Project Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Automated Supplier Invoicing Engine"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Project Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="PRJ-AUTO-INV"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Department</label>
                  <select
                    value={departmentCode}
                    onChange={(e) => setDepartmentCode(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="DEPT-ENG">Engineering</option>
                    <option value="DEPT-PROC">Procurement</option>
                    <option value="DEPT-FIN">Finance</option>
                    <option value="DEPT-HR">Human Resources</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Budget (₹) *</label>
                  <input
                    type="number"
                    required
                    value={allocatedBudget}
                    onChange={(e) => setAllocatedBudget(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Hours *</label>
                  <input
                    type="number"
                    required
                    value={estimatedHours}
                    onChange={(e) => setEstimatedHours(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Milestones *</label>
                  <input
                    type="number"
                    required
                    value={milestonesTotal}
                    onChange={(e) => setMilestonesTotal(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={submitting}>
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                  Launch Project
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Progress Advance Modal */}
      {showProgressModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Advance Milestone: {selectedProject?.code}</h3>
              <button onClick={() => setShowProgressModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleUpdateProgress} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Milestones Completed This Sprint</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={advanceMilestones}
                  onChange={(e) => setAdvanceMilestones(Number(e.target.value))}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Developer Hours Logged</label>
                <input
                  type="number"
                  min="0"
                  value={additionalHours}
                  onChange={(e) => setAdditionalHours(Number(e.target.value))}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Additional Cost Incurred (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={additionalCost}
                  onChange={(e) => setAdditionalCost(Number(e.target.value))}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 font-mono"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowProgressModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={submitting}>
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                  Record Progress
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Projects;
