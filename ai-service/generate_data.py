import numpy as np
import pandas as pd
from datetime import datetime, timedelta

def generate_synthetic_data(num_days: int = 365, output_file: str = "synthetic_erp_data.csv"):
    np.random.seed(42)
    start_date = datetime.now() - timedelta(days=num_days)
    
    dates = [start_date + timedelta(days=i) for i in range(num_days)]
    
    # 1. Seasonal Demand Curve for Steel & Electronics
    base_demand = 50 + 15 * np.sin(np.linspace(0, 8 * np.pi, num_days))
    noise = np.random.normal(0, 6, num_days)
    steel_consumption = np.maximum(10, np.round(base_demand + noise)).astype(int)
    
    # 2. Daily Procurement Invoices
    invoice_amounts = np.random.lognormal(mean=9.2, sigma=0.8, size=num_days)
    invoice_amounts = np.round(invoice_amounts, 2)
    
    df = pd.DataFrame({
        "date": [d.strftime("%Y-%m-%d") for d in dates],
        "steel_consumption_kg": steel_consumption,
        "procurement_spend_inr": invoice_amounts,
        "is_weekend": [d.weekday() >= 5 for d in dates]
    })
    
    df.to_csv(output_file, index=False)
    print(f"[OK] Generated {num_days} days of synthetic ERP telemetry in {output_file}")

if __name__ == "__main__":
    generate_synthetic_data()
