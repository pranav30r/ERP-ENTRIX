# ENTRIX — AI-Powered Integrated Enterprise Resource Planning Platform

**ENTRIX** is an academic prototype and cloud-native Enterprise Resource Planning (ERP) platform developed for Small and Medium Enterprises (SMEs). It unifies core business operations—Human Resources, Finance & Invoicing, Warehouse Inventory, Multi-tiered Procurement, and Project Milestones—with predictive machine learning intelligence.

---

## 🏛️ System Architecture

```
┌────────────────────────────────────────────────────────┐
│                   React.js Frontend                    │
│        (Vite + TypeScript + Tailwind + Socket.io)      │
└───────────────┬────────────────────────▲───────────────┘
                │ REST (JWT)             │ WebSocket / SSE
┌───────────────▼────────────────────────┴───────────────┐
│               Node.js / Express API Server             │
│            (RBAC, Business Logic, Audit Logs)          │
└───────────────┬────────────────────────▲───────────────┘
   PostgreSQL   │                        │ Internal REST
┌───────────────▼────────┐      ┌────────┴───────────────┐
│ PostgreSQL 16 + Redis  │      │  Python FastAPI ML     │
│ (Relational Data & S3) │      │  (Forecasting/Anomaly) │
└────────────────────────┘      └────────────────────────┘
```

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- Docker Engine & Docker Compose
- Node.js v20+ and npm
- Python 3.11+

### 2. Start PostgreSQL & Redis
```powershell
docker compose up -d
```

### 3. Start Backend Server
```powershell
cd server
npm install
npm run dev
```

### 4. Start AI Microservice
```powershell
cd ../ai-service
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 5. Start Frontend
```powershell
cd ../client
npm install
npm run dev
```

---


