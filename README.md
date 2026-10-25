# ENTRIX — AI-Powered Integrated Enterprise Resource Planning Platform

[![CI Pipeline](https://github.com/pranav30r/ERP-ENTRIX/actions/workflows/ci.yml/badge.svg)](https://github.com/pranav30r/ERP-ENTRIX/actions/workflows/ci.yml)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/postgresql-16.x-blue.svg)](https://www.postgresql.org/)
[![Python FastAPI](https://img.shields.io/badge/fastapi-0.110-teal.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/react-18.x-61dafb.svg)](https://react.dev/)
[![Zero Cost Stack](https://img.shields.io/badge/cost-%E2%82%B90%20(Free%20Tier)-emerald.svg)](#-zero-cost-technology-stack)

> **ENTRIX** is an academic prototype and cloud-native Enterprise Resource Planning (ERP) platform developed for Small and Medium Enterprises (SMEs). It unifies core business operations—Human Resources, Finance & Invoicing, Warehouse Inventory, Multi-tiered Procurement, and Project Milestones—with predictive machine learning intelligence.

---

## 🏛️ System Architecture

```
┌────────────────────────────────────────────────────────┐
│                   React.js Frontend                    │
│   (Vite + TypeScript + Tailwind CSS + Lucide Icons)   │
└───────────────┬────────────────────────▲───────────────┘
                │ REST (JWT Bearer)      │ WebSocket / State
┌───────────────▼────────────────────────┴───────────────┐
│               Node.js / Express API Server             │
│        (RBAC, 8-Stage Procurement, SHA-256 Audit)       │
└───────────────┬────────────────────────▲───────────────┘
   PostgreSQL   │                        │ Circuit-Breaker REST
┌───────────────▼────────┐      ┌────────┴───────────────┐
│ PostgreSQL 16 + Redis  │      │  Python FastAPI ML     │
│ (Relational Data & S3) │      │  (Random Forest / IF)  │
└────────────────────────┘      └────────────────────────┘
```

---

## 📦 Zero-Cost Technology Stack

Every component in ENTRIX is engineered to run at **₹0 infrastructure cost** for eligible academic and local development usage:

| Subsystem | Technology | License / Cost |
| :--- | :--- | :--- |
| **Frontend** | React 18 + TypeScript + Vite | MIT (₹0) |
| **Styling & Icons** | Tailwind CSS + Lucide React | MIT (₹0) |
| **Backend API** | Node.js + Express.js + Sequelize ORM | MIT (₹0) |
| **Relational Database** | PostgreSQL 16 (Containerized via Docker) | PostgreSQL Open (₹0) |
| **Cache & Session** | Redis 7 (Containerized via Docker) | BSD-3 (₹0) |
| **AI / ML Microservice** | Python 3.11 + FastAPI + Scikit-learn + NumPy | BSD / Apache-2.0 (₹0) |
| **Continuous Integration** | GitHub Actions (Automated Test & Build) | Free Tier (₹0) |
| **Documentation & Postman** | Postman 2.1 Collection + IEEE 830 SRS | Open (₹0) |

---

## 🔄 Core Business Modules & State Machines

### 1. Multi-Tiered Procurement State Machine
Requisitions follow a strict 8-stage deterministic state machine with automatic approval routing based on procurement valuation:

```
[DRAFT] ──> [PENDING_MANAGER] ──┬── (< ₹10k) ─────────────> [APPROVED]
                                └── (>= ₹10k) ──> [PENDING_FINANCE] ──> [APPROVED]
                                                      │
[GOODS_RECEIVED] <── [INSPECTION] <── [PO_ISSUED] <───┘
       │
[STOCK_INCREMENTED] (Atomic Database Mutation)
```

### 2. Machine Learning Decision Suite (FastAPI)
- **Random Forest Demand Forecasting**: 30-day rolling replenishment projection with safety stock triggers based on historical consumption curves.
- **Isolation Forest Expense Anomaly Detection**: Unsupervised outlier detection flags high-variance requisitions and unauthorized line items.
- **Project Budget Burn Predictor**: Linear and polynomial regression calculating velocity burn rates and expected overrun risk.
- **Fail-Safe Circuit Breaker**: Backend automatically falls back to 30-day Simple Moving Average (SMA) if the ML container is offline or times out (> 2,500ms).

### 3. Cryptographic SHA-256 Audit Trail
Every state-mutating action generates an immutable audit record chained mathematically to the previous hash:

$$\text{Current Hash} = \text{SHA-256}(\text{Prev Hash} \parallel \text{Actor ID} \parallel \text{Action} \parallel \text{Entity} \parallel \text{Diff Payload} \parallel \text{Timestamp})$$

Any direct mutation to historical records invalidates the mathematical hash chain and is flagged immediately in the Audit Trail UI.

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- [Docker Engine & Docker Compose](https://www.docker.com/)
- [Node.js v20+](https://nodejs.org/) & `npm`
- [Python 3.11+](https://www.python.org/)

### 2. Start PostgreSQL, Redis & AI Microservice
```powershell
docker compose up -d
```
Verified services:
- PostgreSQL 16: `localhost:5434`
- Redis 7: `localhost:6380`
- Python FastAPI: `localhost:8008`

### 3. Start Backend Server
```powershell
cd server
npm install
npm run build
npm run db:init      # Bootstrap schema and seeds
npm run dev          # Runs on http://localhost:5000
```

### 4. Start Frontend Client
```powershell
cd client
npm install
npm run dev          # Runs on http://localhost:5173
```

### 5. Run Automated Tests
```powershell
# Run backend Jest unit, integration, and E2E tests
npm --prefix server test -- --runInBand

# Run frontend production bundle compilation
npm --prefix client run build
```

---

## 🛡️ Default Seed Credentials

| Role | Email | Default Password | Access Level |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admin@entrix.local` | `Admin@123` | Full Unrestricted Access |
| **HR Manager** | `hr@entrix.local` | `Admin@123` | Employee Records & PR Creation |
| **Finance Officer** | `finance@entrix.local` | `Admin@123` | PR Finance Sign-off & Ledgers |
| **Procurement Officer** | `procurement@entrix.local` | `Admin@123` | PO Generation & GRN Stock In |

---

## 👥 Authors & Academic Attribution
- **Aditya Sakarkar**
- **Chetan Gupta**
- **Pranav Rathi**

*Ramdeobaba University, Nagpur — Department of Computer Science & Engineering (Session 2026–27)*
*B.Tech CSE Semester V Capstone Project*
