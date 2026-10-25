import { Request, Response } from 'express';
import { AIService } from '../services/aiService';

export const getDemandForecast = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sku_id, historical_series } = req.body;
    const sku = sku_id || 'RAW-STL-001';
    const result = await AIService.getDemandForecast(sku, historical_series);
    res.status(200).json({
      success: true,
      ...result
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Error executing demand forecast' });
  }
};

export const detectExpenseAnomalies = async (req: Request, res: Response): Promise<void> => {
  try {
    const { transactions } = req.body;
    const sample = transactions && transactions.length > 0 ? transactions : [
      { id: 'TX-901', amount: 1450, department_code: 'DEPT-ENG', vendor_name: 'Apex Steel', hour_of_day: 14, is_weekend: false },
      { id: 'TX-902', amount: 2100, department_code: 'DEPT-ENG', vendor_name: 'Apex Steel', hour_of_day: 10, is_weekend: false },
      { id: 'TX-903', amount: 84000, department_code: 'DEPT-ENG', vendor_name: 'Unknown Supplier', hour_of_day: 2, is_weekend: true },
      { id: 'TX-904', amount: 1800, department_code: 'DEPT-PROC', vendor_name: 'Office Pro', hour_of_day: 15, is_weekend: false }
    ];

    const result = await AIService.detectAnomalies(sample);
    res.status(200).json({
      success: true,
      ...result
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Error running anomaly detection' });
  }
};
