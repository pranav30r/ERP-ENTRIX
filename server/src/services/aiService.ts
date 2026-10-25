import axios from 'axios';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8008';
const TIMEOUT_MS = 2500;

export interface ForecastResult {
  sku_id: string;
  model: string;
  horizon_days: number;
  forecast: number[];
  recommended_reorder_qty: number;
  model_metrics?: Record<string, any>;
  is_fallback?: boolean;
}

export class AIService {
  public static async getDemandForecast(skuId: string, historicalSeries?: number[], tenantId?: string): Promise<ForecastResult> {
    try {
      const response = await axios.post(
        `${AI_SERVICE_URL}/api/v1/ml/forecast/demand`,
        {
          tenant_id: tenantId || null,
          sku_id: skuId,
          historical_series: historicalSeries,
          horizon_days: 30
        },
        { timeout: TIMEOUT_MS }
      );

      return response.data;
    } catch (error) {
      console.warn(`[AI Service] Warning: Microservice unavailable or timed out. Engaging SMA fallback protocol for SKU ${skuId}.`);
      
      // Fallback: 30-day Simple Moving Average (SMA)
      const validSeries = historicalSeries && Array.isArray(historicalSeries)
        ? historicalSeries.filter(n => typeof n === 'number' && !isNaN(n))
        : [];
      const baseValue = validSeries.length > 0
        ? validSeries.reduce((a, b) => a + b, 0) / validSeries.length
        : 45.0;

      const fallbackForecast = Array(30).fill(Math.round(baseValue * 10) / 10);
      const totalDemand = fallbackForecast.reduce((a, b) => a + b, 0);

      return {
        sku_id: skuId,
        model: 'Fallback Moving Average (SMA)',
        horizon_days: 30,
        forecast: fallbackForecast,
        recommended_reorder_qty: Math.round(totalDemand * 1.15),
        is_fallback: true
      };
    }
  }

  public static async detectAnomalies(transactions: any[], tenantId?: string): Promise<any> {
    try {
      const response = await axios.post(
        `${AI_SERVICE_URL}/api/v1/ml/anomaly/detect-expense`,
        {
          tenant_id: tenantId || null,
          transactions
        },
        { timeout: TIMEOUT_MS }
      );
      return response.data;
    } catch (error) {
      console.warn('[AI Service] Anomaly service unavailable. Rule-based heuristic fallback engaged.');
      // Rule-based heuristic fallback
      const safeList = Array.isArray(transactions) ? transactions : [];
      const flagged = safeList.filter(t => (Number(t?.amount) || 0) > 50000);
      return {
        total_analyzed: safeList.length,
        anomalies_detected: flagged.length,
        flagged_records: flagged.map(f => ({
          transaction_id: f?.id || 'UNKNOWN',
          amount: Number(f?.amount) || 0,
          risk_factors: ['Amount > ₹50,000 threshold (Heuristic Fallback)']
        })),
        is_fallback: true
      };
    }
  }
}
