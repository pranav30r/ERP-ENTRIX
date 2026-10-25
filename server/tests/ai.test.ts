import { AIService } from '../src/services/aiService';

describe('AI Decision Intelligence Service', () => {
  it('Demand Forecasting returns 30-day predicted consumption series', async () => {
    const historical = [45, 52, 48, 60, 55, 53, 58, 62, 59, 64, 70, 68, 72, 75];
    const res = await AIService.getDemandForecast('RAW-STL-001', historical);

    expect(res).toBeDefined();
    expect(res.sku_id).toBe('RAW-STL-001');
    expect(res.horizon_days).toBe(30);
    expect(res.forecast.length).toBe(30);
    expect(res.recommended_reorder_qty).toBeGreaterThan(0);
  });

  it('Anomaly Detection flags out-of-boundary transactions', async () => {
    const sampleTransactions = [
      { id: 'tx-1', amount: 1200.0, department_code: 'DEPT-ENG', vendor_name: 'Steel Corp', hour_of_day: 14, is_weekend: false },
      { id: 'tx-2', amount: 1550.0, department_code: 'DEPT-ENG', vendor_name: 'Steel Corp', hour_of_day: 11, is_weekend: false },
      { id: 'tx-3', amount: 1300.0, department_code: 'DEPT-ENG', vendor_name: 'Steel Corp', hour_of_day: 16, is_weekend: false },
      { id: 'tx-4', amount: 89000.0, department_code: 'DEPT-ENG', vendor_name: 'Unknown Supplier', hour_of_day: 2, is_weekend: true } // Outlier!
    ];

    const res = await AIService.detectAnomalies(sampleTransactions);

    expect(res).toBeDefined();
    expect(res.total_analyzed).toBe(4);
    expect(res.anomalies_detected).toBeGreaterThanOrEqual(1);
    expect(res.flagged_records.some((r: any) => r.transaction_id === 'tx-4')).toBe(true);
  });
});
