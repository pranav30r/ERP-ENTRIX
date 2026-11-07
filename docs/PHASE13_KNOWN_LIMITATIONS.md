# ENTRIX ERP — Phase 13: Product, Architecture & Commercial Known Limitations

**Release Candidate:** v1.0.0-rc1  
**Target:** Stakeholders, Pilot Evaluators, Compliance Reviewers & Developers

---

## 1. Artificial Intelligence & Forecasting Limitations

| Item | Current Implementation Status | Limitation / Unmet Commercial Criteria | Operational Mitigation |
| :--- | :--- | :--- | :--- |
| **Demand Forecasting** | Microservice adapter with 30-day Simple Moving Average (SMA) heuristic fallback. | **Prototype Status:** No historical RMSE benchmarks, backtested datasets, or seasonality adjustments. | Labeled as "AI-Enabled Heuristic Prototype" in UI and reports. |
| **Expense Anomaly Detection** | Microservice adapter with rule-based threshold heuristic (> ₹50,000). | **Prototype Status:** Does not employ unsupervised clustering or vendor-specific probability scoring. | Heuristic fallback flags outliers; requires human finance officer review. |
| **Model Drift Monitoring** | Telemetry logs request durations and token metrics. | No automated drift alerting or continuous retraining pipeline. | Pilot administrators must review prediction accuracy manually. |

---

## 2. Commercial SaaS & Monetization Limitations

| Item | Current Implementation Status | Limitation / Unmet Commercial Criteria | Operational Mitigation |
| :--- | :--- | :--- | :--- |
| **Payment Gateway** | Deterministic Mock Billing Adapter (`mockBillingAdapter.ts`). | **Simulated Sandbox:** Live Stripe/Razorpay webhooks are simulated. No live credit card charge processing. | Pilot accounts provisioned in sandbox mode (`ALLOW_MOCK_BILLING=true`). |
| **Tax & Invoicing Compliance** | Single-currency (`INR`) electronic receipts. | No automated GST/VAT tax breakdown or country-specific e-invoicing compliance rails. | External accounting software must generate legal tax invoices. |
| **Automated Dunning** | Webhook handles simulated `invoice.payment_failed`. | No automated email dunning sequence or payment retry schedules. | Tenant status flags `PAST_DUE`; manual SRE intervention required. |

---

## 3. Infrastructure, Database & High Availability Limitations

| Item | Current Implementation Status | Limitation / Unmet Commercial Criteria | Operational Mitigation |
| :--- | :--- | :--- | :--- |
| **Cloud High Availability** | Local Docker Compose container (`entrix-postgres`). | **Single-Point of Failure:** No automated Multi-AZ failover, read replica pooling, or streaming replication. | Pilot limited to single-region supervised operations. |
| **Secrets Management** | `.env` file environment variable injection. | Production secrets vault (AWS Secrets Manager, HashiCorp Vault) is not configured. | Restrict `.env` permissions on host OS; rotate keys manually. |
| **File / Document Storage** | Electronic receipts generated on-demand via browser. | No S3 / Cloud Storage bucket integration for storing heavy PDF invoices. | Invoices generated dynamically on client print view. |

---

## 4. ERP Workflow & Regional Limitations

- **Currency:** System operates in single baseline currency (`INR`). Multi-currency FX translation gains/losses are not supported in this release candidate.
- **Bank Settlement Rails:** Supplier payments are tracked as internal ledger settlements against Operating Cash (`1010`). Direct integration with banking APIs (e.g. NACH, NEFT, ACH) requires manual export.
- **External Audits:** The software has undergone rigorous internal adversarial testing, but has not received an independent SOC2 Type II or ISO 27001 certification.
