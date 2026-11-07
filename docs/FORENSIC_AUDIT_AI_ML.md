# FORENSIC AUDIT: AI/ML SERVICE & ANOMALY DETECTION (STAGE 10)

**Audit Date:** 2026-10-26  
**Auditor:** Principal AI/ML Engineer & Systems Reliability Specialist  
**Status:** FULLY VERIFIED (PASS WITH RESILIENT FALLBACK)  

---

## 1. Executive Summary

ENTRIX ERP features an independent Python microservice ([`ai-service/`](file:///d:/E-comm/ai-service)) built on **FastAPI**, **scikit-learn**, and **pandas**, running in Docker container `entrix-ai` on port `8008`. The Node.js backend communicates with it via a circuit-breaker HTTP client ([`server/src/services/aiService.ts`](file:///d:/E-comm/server/src/services/aiService.ts)) equipped with a deterministic statistical fallback (Simple Moving Average / Z-score detector).

---

## 2. Model Architecture & Implementation

### 2.1 Demand Forecasting Model
- **Algorithm:** `RandomForestRegressor` (n_estimators=100, max_depth=10) combined with lag-based feature extraction.
- **Input Features:** Historic daily inventory consumption, day of week, seasonal month index, and promotional flags.
- **Fallback Logic in Node.js:** If `ai-service` is unreachable, timed out (>1500ms), or degraded, the Node.js backend automatically invokes a 7-day weighted moving average with safety stock buffer multiplier, returning `isFallback: true` with zero downtime.

### 2.2 Expense & Inventory Anomaly Detection
- **Algorithm:** `IsolationForest` (contamination=0.05, random_state=42).
- **Inference Output:** Anomaly score, outlier boolean flag, and z-score deviation.
- **Node.js Fallback:** Rolling window mean and standard deviation ($Z > 2.5$) evaluated in pure TypeScript.

---

## 3. Microservice Endpoints & Contracts

| Endpoint Path | Method | Payload Contract | AI Logic | Fallback Behavior | Verification |
|---|---|---|---|---|---|
| `/health` | `GET` | Empty | Microservice alive check | Returns 200 OK | RUNTIME VERIFIED |
| `/predict/demand` | `POST` | `{ history: number[], horizon: number }` | Random Forest Inference | Local SMA fallback | TEST & RUNTIME VERIFIED |
| `/detect/anomalies` | `POST` | `{ series: number[], sensitivity: number }` | Isolation Forest scoring | Local Z-Score fallback | TEST & RUNTIME VERIFIED |

---

## 4. Empirical Test Verification

Tests executed in [`server/tests/ai.test.ts`](file:///d:/E-comm/server/tests/ai.test.ts) verify:
1. Smooth forecast generation when microservice is reachable.
2. Graceful degradation to local statistical fallback when network timeout occurs.
3. Circuit-breaker state transitions (CLOSED $\to$ OPEN $\to$ HALF-OPEN).
