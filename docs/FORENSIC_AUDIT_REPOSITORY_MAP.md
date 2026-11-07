# ENTRIX ERP — Forensic Repository Forensics & Runtime Dependency Map (Stage 1)

**Audit Date:** 2026-10-26  
**Auditor:** Principal Enterprise Architect & DevOps/SRE Engineer  
**Workspace:** `d:\E-comm`

---

## 1. Project Component Inventory

```text
d:\E-comm
├── .github/workflows/ci.yml       # Automated GitHub Actions test pipeline
├── ai-service/                    # Python 3.11 FastAPI predictive microservice
│   ├── main.py                    # Demand forecasting & Isolation Forest anomaly engine
│   ├── requirements.txt           # fastapi, uvicorn, pydantic, scikit-learn, pandas, numpy
│   └── Dockerfile                 # Container image for Python inference engine
├── client/                        # React 18 SPA (Vite + TypeScript + Tailwind)
│   ├── src/
│   │   ├── pages/                 # 10 core views (Dashboard, Procurement, Inventory, Finance, HR, etc.)
│   │   ├── components/            # UI components, Sidebar, Header, WorkflowTimeline
│   │   ├── context/               # AuthContext, NavContext
│   │   ├── services/api.ts        # Axios API client with automatic token attachment
│   │   └── App.tsx                # React Router with Suspense lazy loading & Error Boundary
│   ├── vite.config.ts             # Chunk splitting configuration (<150kB initial bundle)
│   └── package.json               # react, reduxjs/toolkit, recharts, socket.io-client, lucide-react
├── server/                        # Express 4 REST API (Node.js 20 + TypeScript + Sequelize)
│   ├── src/
│   │   ├── app.ts                 # Express initialization, Helmet CSP, CORS allowlist, Socket.io
│   │   ├── config/                # db.ts (Sequelize), env.ts (strict validation), plans.ts (entitlements)
│   │   ├── controllers/           # auth, hr, procurement, inventory, finance, projects, subscription
│   │   ├── middlewares/           # auth.ts (JWT), rateLimiter.ts, entitlements.ts, requestContext.ts
│   │   ├── models/index.ts        # 23 Sequelize data models with foreign keys and associations
│   │   ├── routes/                # 11 REST routers mounted on /api/v1/ and /
│   │   ├── services/              # tokenService, auditService, aiService, billing/
│   │   └── db/
│   │       ├── migrate.ts         # Versioned migration engine with advisory lock 19842026
│   │       └── migrations/        # 001 to 008 versioned SQL migration scripts
│   ├── tests/                     # 20 Jest automated integration test suites (138 tests)
│   └── package.json               # express, sequelize, pg, jsonwebtoken, bcryptjs, socket.io, zod
├── deploy/                        # Production operations & disaster recovery
│   ├── Dockerfile.server          # Multi-stage production container running as non-root user 'node'
│   ├── nginx/default.conf         # Reverse proxy configuration
│   └── scripts/                   # Automated backup.ps1 / restore.ps1 (tested in 1.42s)
├── docker-compose.yml             # Local zero-cost container definition (PostgreSQL, Redis, AI)
├── docker-compose.prod.yml        # Production compose definition with healthchecks & logging caps
└── docs/                          # Architecture guides, release reports, and audit documentation
```

---

## 2. Technology Stack & Manifest Verification

| Subsystem | Source Manifest | Framework / Dependency | Verified Version | Security / Integrity Note |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend Framework** | `client/package.json` | `react`, `react-dom` | `18.2.0` | Strict functional components with hooks |
| **Frontend Build Tool**| `client/package.json` | `vite`, `@vitejs/plugin-react`| `5.4.21` / `4.2.1` | Initial bundle size chunked to 119.29 kB |
| **Styling & Assets** | `client/package.json` | `tailwindcss`, `lucide-react` | `3.4.3` / `0.372.0`| Responsive, dark/light neutral palette |
| **Backend Runtime** | `server/package.json` | `express`, `@types/node` | `4.19.2` / `^20.0.0` | Node.js 20 LTS compliant |
| **ORM & Database** | `server/package.json` | `sequelize`, `pg`, `pg-hstore`| `6.37.3` / `8.11.5` | PostgreSQL 16 Alpine containerized |
| **Authentication** | `server/package.json` | `jsonwebtoken`, `bcryptjs` | `9.0.2` / `2.4.3` | HMAC SHA-256 + 10-round salt hashing |
| **Security Headers** | `server/package.json` | `helmet`, `cors`, `express-rate-limit`| `7.1.0` / `2.8.5` / `7.2.0` | Strict CSP and origin allowlists |
| **AI Inference** | `ai-service/requirements.txt`| `fastapi`, `scikit-learn` | `0.110.0` / `1.4.2` | Python 3.11 with fallback circuit breaker |

---

## 3. Git & Configuration Hygiene Audit

- **Environment Separation**: Root `.env.example` documents all required keys (`DB_HOST`, `DB_PORT`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ALLOWED_ORIGINS`). Real secrets are untracked.
- **Fail-Fast Secret Validation**: `server/src/config/env.ts` halts process initialization immediately with `[FATAL SECURITY ERROR]` if `JWT_SECRET` is unset or $< 32$ characters in production.
- **No Insecure Fallbacks**: The legacy development fallback warning (`JWT_SECRET is unset in development`) has been completely removed.
- **Destructive Operations Disabled**: `server/src/config/db.ts` enforces `sync({ force: false })`; destructive schema resets cannot execute on startup.

---

## 4. End-to-End Runtime Dependency Paths

### Path 1: Core REST Transaction Flow
```
User Action (UI)
   │  (Axios with Bearer Token & X-Request-ID)
   ▼
Express Router (server/src/routes/)
   │
   ▼
Security Middlewares (Helmet CSP ➔ CORS Check ➔ apiLimiter ➔ authenticateJWT ➔ requireRole ➔ requireModuleEntitlement)
   │
   ▼
Controller Layer (e.g. procurementController.ts)
   │  (Input Validation & Tenant Injection)
   ▼
Database Transaction (sequelize.transaction with row-level LOCK.UPDATE)
   │
   ▼
Sequelize ORM & PostgreSQL (Port 5434)
   │
   ▼
Audit Chaining (AuditService.logMutation with pg_advisory_xact_lock)
   │
   ▼
Socket.IO Broadcast (Tenant-isolated room: tenant:{tenantId})
   │
   ▼
JSON HTTP 200/201 Response ➔ React State Update (UI Component)
```

### Path 2: Resilient AI Decision Intelligence Flow
```
User Inquires Demand Forecast (client/src/pages/AIInsights.tsx)
   │
   ▼
Node.js Gateway (POST /api/v1/ai/forecast)
   │
   ▼
AIService (server/src/services/aiService.ts)
   ├── ➔ Axios Request to FastAPI Microservice (http://localhost:8008/api/v1/ml/forecast/demand) [Timeout 2500ms]
   │       └── Scikit-Learn RandomForestRegressor inference ➔ Returns Forecast Array + Metrics
   └── ➔ [ON TIMEOUT OR SERVICE OFFLINE]:
           └── Triggers Circuit-Breaker: Calculates 30-day Simple Moving Average (SMA) heuristic fallback
   │
   ▼
Returns Unified Payload with `is_fallback` telemetry flag ➔ Rendered in Recharts Chart
```
