# ENTRIX ERP — Academic Capstone Viva Voce & Defense Guide

**Project Title**: ENTRIX — AI-Powered Integrated Enterprise Resource Planning Platform  
**Target Academic Degree**: B.Tech. in Computer Science & Engineering (Semester V)  
**Institution**: Ramdeobaba University, Nagpur (Session 2026–27)  
**Authors**: Aditya Sakarkar, Chetan Gupta, Pranav Rathi  
**Technology Stack**: React 18, Node.js, PostgreSQL 16, Redis 7, Python 3.11, FastAPI, Scikit-learn, Socket.io  
**Infrastructure Cost**: ₹0 (Free Open-Source & Containerized Local Architecture)

---

## 1. Project Synopsis Objective Compliance

| Synopsis Objective | Architectural Implementation | Verification Method |
| :--- | :--- | :--- |
| **Unified ERP Modules** | HR, Finance, Inventory, Procurement, and Project Milestones in a single responsive UI | Live React SPA on port 5173 |
| **8-Stage Procurement Workflow** | Requisition ➔ Manager ➔ Finance ➔ PO ➔ GRN ➔ Invoice ➔ Closed / Rejected | Deterministic state machine in `procurementController.ts` |
| **Cryptographic Tamper-Evidence** | SHA-256 chained hash blocks on all state-mutating operations | B-Tree `audit_logs` table & `/api/v1/audit/verify-chain` |
| **AI Demand Forecasting** | Scikit-learn Random Forest Regressor predicting 30-day consumption trends | FastAPI container on port 8008 (`POST /ml/forecast/demand`) |
| **Expense Anomaly Detection** | Isolation Forest unsupervised outlier detection on departmental spending | FastAPI container on port 8008 (`POST /ml/anomaly/detect-expense`) |
| **Real-time Synchronization** | WebSocket push notifications on state machine mutations | Socket.io server on port 5000 broadcasting to frontend clients |
| **ACID Financial Integrity** | Double-entry journal balances ($\sum \text{Debits} - \sum \text{Credits} = 0$) | `ledger_entries` model & `/api/v1/finance/ledger` |

---

## 2. Mathematical & Algorithmic Formulations

### A. Cryptographic Audit Hash Chaining (SHA-256)
Every state mutation records a tamper-evident audit record where:

$$\text{Hash}_i = \text{SHA-256}(\text{Hash}_{i-1} \parallel \text{Actor ID} \parallel \text{Action} \parallel \text{Entity Name} \parallel \text{Entity ID} \parallel \text{Diff Payload} \parallel \text{Timestamp})$$

If an attacker manually modifies a database record in PostgreSQL, recalculating the hash chain reveals an immediate mismatch:

$$\text{Valid} \iff \forall i \in [1, N]: \text{Hash}_{i-1} = \text{Record}_i.\text{previous\_hash}$$

### B. Machine Learning Demand Forecasting
Features extracted from historical stock depletion series:
- $X_1 = \text{lag}_7$: Consumption 7 days prior
- $X_2 = \text{lag}_{14}$: Consumption 14 days prior
- $X_3 = \text{SMA}_7$: 7-day Simple Moving Average
- $X_4 = \text{DayOfWeek} \in [0, 6]$

Trained with 100 decision trees (`n_estimators=100`, `random_state=42`) using Mean Squared Error criterion:

$$\hat{y} = \frac{1}{B} \sum_{b=1}^B T_b(x)$$

### C. Isolation Forest Expense Anomaly Scoring
The anomaly score $s(x, n)$ for requisition transaction $x$ with sample size $n$:

$$s(x, n) = 2^{-\frac{\mathbb{E}(h(x))}{c(n)}}$$

Where:
- $h(x)$ is the path length to isolate sample $x$ across isolation trees
- $c(n) = 2 \ln(n - 1) + 0.5772156649 - \frac{2(n-1)}{n}$ is the average path length of unsuccessful searches in a Binary Search Tree (BST)
- When $\mathbb{E}(h(x)) \to 0 \implies s \to 1$ (High-confidence anomaly flag)

---

## 3. Five-Minute Live Demonstration Script for Examiners

1. **Overview & Login**:
   - Access `http://127.0.0.1:5173/`.
   - Highlight the Linear/Stripe design language, active Socket.io green status pill, and executive KPI cards.
2. **Requisition State Machine Execution**:
   - Navigate to `/procurement`.
   - Click **New Requisition**; select `RAW-STL-001`, enter quantity `15`, submit.
   - Show instant transition to `PENDING_MANAGER`.
   - Click **Approve** (value $< ₹10,000$ auto-approves to `APPROVED`).
3. **Automated Escalation Rule**:
   - Create requisition for `100` units of `ELEC-SMR-002` ($₹85,000 \ge ₹10,000$).
   - Manager approval escalates to `PENDING_FINANCE`.
   - Click **Finance Sign-off** to finalize approval.
4. **Perpetual Inventory Mutation**:
   - Navigate to `/inventory`.
   - Adjust `RAW-STL-001` with a stock receipt of `50` units.
   - Show stock level update persisting in PostgreSQL.
5. **Tamper-Evident Audit Verification**:
   - Navigate to `/audit`.
   - Show newly chained SHA-256 blocks for requisition mutations and stock adjustments.
   - Point to the **Chain Verified: Zero Breaks** badge.
6. **Predictive AI Insights**:
   - Navigate to `/ai-insights`.
   - Show the 14-day Random Forest projected demand curve and Isolation Forest outlier transaction flag.

---

## 4. Expected Viva Questions & Answers

**Q1: Why use a microservice architecture for the AI module instead of embedding it in Node.js?**  
*Answer*: Python's scientific ecosystem (NumPy, Scikit-learn, Pandas) provides optimized C-accelerated BLAS/LAPACK routines for ML inference. Decoupling it into a FastAPI microservice protects the Node.js event loop from CPU-bound matrix computations and enables independent horizontal scaling.

**Q2: What happens if the Python AI microservice goes down during production?**  
*Answer*: The backend implements a circuit-breaker pattern in `aiService.ts` with a 2,500ms timeout. If FastAPI fails or times out, the system automatically falls back to a 30-day Simple Moving Average (SMA) and rule-based expense heuristics with zero user interruption.

**Q3: How is data consistency guaranteed during Goods Receipt (GRN)?**  
*Answer*: GRN generation and stock incrementation execute inside an ACID-compliant PostgreSQL transaction (`sequelize.transaction()`). If either the GRN insertion or inventory counter update fails, the entire transaction rolls back cleanly, preventing phantom inventory.
