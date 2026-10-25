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
  public static async getDemandForecast(skuId: string, historicalSeries?: number[]): Promise<ForecastResult> {
    try {
      const response = await axios.post(
        `${AI_SERVICE_URL}/api/v1/ml/forecast/demand`,
        {
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
      const baseValue = historicalSeries && historicalSeries.length > 0
        ? historicalSeries.reduce((a, b) => a + b, 0) / historicalSeries.length
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

  public static async detectAnomalies(transactions: any[]): Promise<any> {
    try {
      const response = await axios.post(
        `${AI_SERVICE_URL}/api/v1/ml/anomaly/detect-expense`,
        { transactions },
        { timeout: TIMEOUT_MS }
      );
      return response.data;
    } catch (error) {
      console.warn('[AI Service] Anomaly service unavailable. Rule-based heuristic fallback engaged.');
      // Rule-based heuristic fallback
      const flagged = transactions.filter(t => t.amount > 50000);
      return {
        total_analyzed: transactions.length,
        anomalies_detected: flagged.length,
        flagged_records: flagged.map(f => ({
          transaction_id: f.id,
          amount: f.amount,
          risk_factors: ['Amount > ₹50,000 threshold (Heuristic Fallback)']
        })),
        is_fallback: true
      };
    }
  }
}
