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
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">ENTRIX Procurement State Machine</h3>
          <p className="text-xs text-slate-500">
            Automated multi-stage approval workflow with ₹10,000 threshold branching
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isFinanceBypassed ? (
            <span className="text-[11px] font-medium bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-md border border-emerald-200">
              Low-Value Fast Track (&lt; ₹10k)
            </span>
          ) : (
            <span className="text-[11px] font-medium bg-amber-50 text-amber-700 px-2.5 py-1 rounded-md border border-amber-200">
              Dual-Tier Sign-off Required (&ge; ₹10k)
            </span>
          )}
        </div>
      </div>

      {/* Stepper Steps */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
        {STAGES.map((step, idx) => {
          const isCompleted = idx < currentIndex;
          const isCurrent = idx === Math.floor(currentIndex);

          return (
            <div
              key={step.key}
              className={`
                relative p-3 rounded-lg border transition-all text-left
                ${isCurrent
                  ? 'bg-indigo-50/70 border-indigo-400 ring-1 ring-indigo-300'
                  : isCompleted
                  ? 'bg-slate-50/80 border-slate-200 text-slate-700'
                  : 'bg-white border-slate-100 text-slate-400'
                }
              `}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-[10px] font-mono font-semibold uppercase ${isCurrent ? 'text-indigo-600' : 'text-slate-500'}`}>
                  {step.label}
                </span>
                {isCompleted ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                ) : isCurrent ? (
                  <Clock className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-slate-200"></div>
                )}
              </div>
              <p className={`text-xs font-medium truncate ${isCurrent ? 'text-slate-900 font-semibold' : 'text-slate-600'}`}>
                {step.desc}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
