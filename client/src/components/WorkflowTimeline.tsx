import React from 'react';
import { CheckCircle2, Clock } from 'lucide-react';

export type ProcurementStage =
  | 'DRAFT'
  | 'PENDING_MANAGER'
  | 'PENDING_FINANCE'
  | 'APPROVED'
  | 'PO_ISSUED'
  | 'GOODS_RECEIVED'
  | 'INVOICE_MATCHED'
  | 'CLOSED'
  | 'REJECTED';

interface WorkflowTimelineProps {
  currentStage: ProcurementStage;
  amount: number;
}

const STAGES = [
  { key: 'REQUEST', label: '1. Request', desc: 'Requisition Created' },
  { key: 'MANAGER', label: '2. Manager Sign-off', desc: 'Dept Review' },
  { key: 'FINANCE', label: '3. Finance Sign-off', desc: 'Budget Clearance' },
  { key: 'PO', label: '4. Purchase Order', desc: 'Vendor Dispatched' },
  { key: 'GRN', label: '5. Goods Received', desc: 'Warehouse Verification' },
  { key: 'INVOICE', label: '6. Invoice Cleared', desc: 'Ledger Settled' }
];

export const WorkflowTimeline: React.FC<WorkflowTimelineProps> = ({ currentStage, amount }) => {
  const isFinanceBypassed = amount < 10000;

  const getStageIndex = (stage: ProcurementStage): number => {
    switch (stage) {
      case 'DRAFT': return 0;
      case 'PENDING_MANAGER': return 1;
      case 'PENDING_FINANCE': return 2;
      case 'APPROVED': return isFinanceBypassed ? 2 : 2.5;
      case 'PO_ISSUED': return 3;
      case 'GOODS_RECEIVED': return 4;
      case 'INVOICE_MATCHED':
      case 'CLOSED': return 5;
      case 'REJECTED': return -1;
      default: return 0;
    }
  };

  const currentIndex = getStageIndex(currentStage);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 xl:p-7 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-100">
        <div>
          <h3 className="text-lg lg:text-xl font-semibold text-slate-900 tracking-tight">ENTRIX Procurement State Machine</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Automated multi-stage approval workflow with ₹10,000 threshold branching
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isFinanceBypassed ? (
            <span className="text-xs font-mono font-medium bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg border border-emerald-200">
              Low-Value Fast Track (&lt; ₹10k)
            </span>
          ) : (
            <span className="text-xs font-mono font-medium bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg border border-amber-200">
              Dual-Tier Sign-off Required (&ge; ₹10k)
            </span>
          )}
        </div>
      </div>

      {/* Stepper Steps (6 steps equally spaced across full width) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 w-full">
        {STAGES.map((step, idx) => {
          const isCompleted = idx < currentIndex;
          const isCurrent = idx === Math.floor(currentIndex);

          return (
            <div
              key={step.key}
              className={`
                relative p-4 xl:p-5 rounded-xl border transition-all text-left flex flex-col justify-between
                ${isCurrent
                  ? 'bg-indigo-50/70 border-indigo-400 ring-2 ring-indigo-300 shadow-sm'
                  : isCompleted
                  ? 'bg-slate-50/80 border-slate-200 text-slate-700'
                  : 'bg-white border-slate-100 text-slate-400'
                }
              `}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-mono font-semibold uppercase tracking-wider ${isCurrent ? 'text-indigo-600' : 'text-slate-500'}`}>
                  {step.label}
                </span>
                {isCompleted ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : isCurrent ? (
                  <Clock className="w-5 h-5 text-indigo-600 animate-spin shrink-0" />
                ) : (
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-200"></div>
                )}
              </div>
              <p className={`text-sm xl:text-[15px] font-semibold truncate ${isCurrent ? 'text-slate-900' : 'text-slate-700'}`}>
                {step.desc}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
