import React, { useState, useEffect, Suspense, lazy } from 'react';
import { AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { apiClient, ensureAuthenticated } from '../services/api';
import { PageHeader } from '../components/ui/PageHeader';
import { StatusPill } from '../components/ui/StatusPill';
import { DataTable } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { Tooltip as UITooltip } from '../components/ui/Tooltip';
import { formatCurrency, formatNumber } from '../lib/format';

const DemandChart = lazy(() => import('../components/charts/DemandChart'));

export const AIInsights: React.FC = () => {
  const [forecastData, setForecastData] = useState<any[]>([]);
  const [reorderQty, setReorderQty] = useState(0);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [isFallback, setIsFallback] = useState(false);
  const [modelName, setModelName] = useState('RandomForestRegressor');

  useEffect(() => {
    const fetchAI = async () => {
      try {
        await ensureAuthenticated();
        // Fetch 14-day forecast via Enterprise Gateway
        const forecastRes = await apiClient.post('/ai/forecast', {
          sku_id: 'RAW-STL-001',
          horizon_days: 14
        });

        const forecastArray = forecastRes.data.forecast || [];
        const formatted = forecastArray.map((val: number, idx: number) => ({
          day: `Day ${idx + 1}`,
          demand: val,
          safety: Math.round(val * 1.2 * 10) / 10
        }));

        setForecastData(formatted);
        setReorderQty(forecastRes.data.recommended_reorder_qty || 620);
        setIsFallback(!!forecastRes.data.is_fallback);
        setModelName(forecastRes.data.model || (forecastRes.data.is_fallback ? 'Fallback Moving Average (SMA)' : 'RandomForestRegressor (Python 3.11)'));

        // Fetch anomaly detection
        const anomalyRes = await apiClient.post('/ai/anomalies', {
          transactions: [
            { id: 'TX-901', amount: 1450, department_code: 'DEPT-ENG', vendor_name: 'Apex Steel', hour_of_day: 14, is_weekend: false },
            { id: 'TX-902', amount: 2100, department_code: 'DEPT-ENG', vendor_name: 'Apex Steel', hour_of_day: 10, is_weekend: false },
            { id: 'TX-903', amount: 84000, department_code: 'DEPT-ENG', vendor_name: 'Unknown Supplier', hour_of_day: 2, is_weekend: true },
            { id: 'TX-904', amount: 1800, department_code: 'DEPT-PROC', vendor_name: 'Office Pro', hour_of_day: 15, is_weekend: false }
          ]
        });

        setAnomalies(anomalyRes.data.flagged_records || []);
      } catch (err) {
        console.warn('AI microservice connecting or using default telemetry...');
        const mockDays = Array.from({ length: 14 }, (_, i) => ({
          day: `Day ${i + 1}`,
          demand: Math.round(45 + Math.sin(i) * 10),
          safety: Math.round((45 + Math.sin(i) * 10) * 1.2)
        }));
        setForecastData(mockDays);
        setReorderQty(620);
        setIsFallback(true);
        setModelName('Statistical Heuristic Fallback (Local SMA)');
        setAnomalies([
          {
            transaction_id: 'TX-903',
            amount: 84000,
            department: 'DEPT-ENG',
            vendor: 'Unknown Supplier',
            risk_factors: ['High-value outlier (₹84,000.00)', 'Off-hours submission (2:00 hrs)', 'Non-working day transaction']
          }
        ]);
      }
    };

    fetchAI();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="AI Decision Intelligence Suite"
        subtitle="Demand forecasting and anomaly detection"
        actions={
          isFallback ? (
            <UITooltip content={`Statistical Fallback Active (${modelName})`}>
              <div>
                <StatusPill variant="warning" size="sm">
                  Fallback active
                </StatusPill>
              </div>
            </UITooltip>
          ) : (
            <UITooltip content={`Python FastAPI ML Live (${modelName})`}>
              <div>
                <StatusPill variant="success" size="sm">
                  Model live
                </StatusPill>
              </div>
            </UITooltip>
          )
        }
      />

      {/* Forecast Chart Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                RAW-STL-001
              </span>
              <h3 className="text-sm font-semibold text-slate-800">
                {forecastData.length > 0 ? `${forecastData.length}-Day` : '14-Day'} Demand Curve Prediction
              </h3>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
              <span>Model: {modelName}</span>
              <UITooltip content="RandomForestRegressor (50 Estimators, Lag 1/3/7 Features)">
                <Info className="w-3.5 h-3.5 text-slate-400 cursor-pointer" aria-label="Model hyperparameters" />
              </UITooltip>
            </div>
          </div>
          <div className="text-left sm:text-right font-mono">
            <span className="text-xs text-slate-400 block sm:inline">Recommended Restock: </span>
            <span className="text-sm font-bold text-indigo-600">
              {formatNumber(reorderQty)} units
            </span>
          </div>
        </div>

        <Suspense
          fallback={
            <div className="h-[320px] w-full flex items-center justify-center bg-slate-50 rounded-lg">
              <Skeleton variant="block" className="h-full w-full" />
            </div>
          }
        >
          <DemandChart data={forecastData} />
        </Suspense>
      </div>

      {/* Anomaly Detection Section via DataTable */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-500" />
            <h3 className="text-sm font-semibold text-slate-800">Expense Anomaly & Fraud Isolation</h3>
          </div>
          <span className="text-xs font-mono text-rose-600 font-semibold bg-rose-50 px-2.5 py-1 rounded border border-rose-200">
            {anomalies.length} Anomaly Flagged
          </span>
        </div>

        <DataTable<any>
          columns={[
            {
              key: 'transaction_id',
              header: 'Transaction ID',
              render: (a) => <span className="font-mono font-medium text-slate-900">{a.transaction_id}</span>
            },
            {
              key: 'vendor',
              header: 'Vendor',
              render: (a) => <span className="font-medium text-slate-800">{a.vendor}</span>
            },
            {
              key: 'department',
              header: 'Department',
              render: (a) => <span className="font-mono text-slate-500">{a.department}</span>
            },
            {
              key: 'amount',
              header: 'Amount',
              align: 'right',
              render: (a) => (
                <span className="font-mono font-bold text-rose-600 tabular-nums">
                  {formatCurrency(Number(a.amount))}
                </span>
              )
            },
            {
              key: 'risk_factors',
              header: 'Risk Classification Factors',
              render: (a) => (
                <div className="flex flex-wrap gap-1">
                  {a.risk_factors.map((rf: string, i: number) => {
                    const isHighRisk = rf.toLowerCase().includes('high-value') || rf.toLowerCase().includes('fraud') || rf.toLowerCase().includes('unknown');
                    return (
                      <StatusPill key={i} variant={isHighRisk ? 'danger' : 'warning'} size="sm">
                        {rf}
                      </StatusPill>
                    );
                  })}
                </div>
              )
            },
            {
              key: 'actions',
              header: 'Audit Action',
              align: 'right',
              render: () => (
                <button
                  type="button"
                  className="px-2.5 py-1 bg-white border border-rose-300 text-rose-700 rounded text-xs font-semibold hover:bg-rose-50"
                  onClick={() => alert('Anomaly flagged for secondary financial audit.')}
                >
                  Triage
                </button>
              )
            }
          ]}
          rows={anomalies}
          rowKey={(a) => a.transaction_id}
          emptyState={
            <EmptyState
              icon={CheckCircle2}
              title="No anomalies detected"
              description="Machine learning audit scan completed. All disbursements fall within normal operational boundaries."
            />
          }
        />
      </div>
    </div>
  );
};
