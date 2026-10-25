# ENTRIX ERP — Architectural Blueprint & Codebase Organization

This document provides a clean, clear explanation of how the ENTRIX ERP codebase is organized across all three tiers (Frontend, Backend, and AI Service).

---

## 1. High-Level Layered Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER (client/)                    │
│   React 18 SPA • TypeScript • Tailwind CSS • Lucide Icons • Recharts  │
│                                                                        │
│   ├── pages/         -> Routed workspace views (Procurement, Inventory)│
│   ├── components/    -> UI primitives (Card, Badge, Button, Timeline) │
│   ├── services/      -> Typed API domain clients (inventoryService)    │
│   └── types/         -> Centralized TypeScript shared data models      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP REST (JWT Bearer) + WebSocket
┌───────────────────────────────────▼────────────────────────────────────┐
│                       APPLICATION API GATEWAY (server/)                │
│             Node.js v20 LTS • Express.js • TypeScript ORM              │
│                                                                        │
│   ├── routes/        -> URL mapping & RBAC authorization middleware    │
│   ├── middlewares/   -> JWT verification (auth.ts), rate limiting      │
│   ├── controllers/   -> HTTP request validation & response formatting  │
│   ├── services/      -> Core business logic (AuditService, AIService)  │
│   └── models/        -> Sequelize PostgreSQL ORM class models          │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │ PostgreSQL Dialect             │ Circuit-Breaker REST
┌───────────────────▼────────────────┐   ┌───────────▼───────────────────┐
│     PERSISTENCE & CACHE TIER       │   │   AI INFERENCE TIER           │
│  PostgreSQL 16     Redis 7         │   │   FastAPI • Python 3.11       │
│  Port: 5434        Port: 6380      │   │   Port: 8008                  │
│                                    │   │                               │
│  • 10 ACID Relational Tables       │   │  • Random Forest Demand Model │
│  • B-Tree Performance Indexes      │   │  • Isolation Forest Outliers  │
│  • Cryptographic SHA-256 Ledger    │   │  • Budget Burn Velocity       │
└────────────────────────────────────┘   └───────────────────────────────┘
```

---

## 2. Directory & File Responsibilities

### `client/` (React Presentation Tier)
- **`src/types/index.ts`**: Single source of truth for TypeScript interfaces (`InventoryItem`, `PurchaseRequest`, `LedgerEntry`, `Employee`, `AuditLogEntry`).
- **`src/services/api.ts`**: Axios HTTP client configured with JWT interceptor, auto-authentication fallback, and role switcher (`loginAsUser`).
- **`src/services/erpServices.ts`**: Clean, modular domain services (`inventoryService`, `procurementService`, `financeService`, `hrService`, `auditService`).
- **`src/services/socket.ts`**: Socket.io client managing real-time event streaming (`pr_created`, `pr_status_changed`, `inventory_updated`).
- **`src/pages/`**: 8 workspace pages mapped to active routes (`/`, `/procurement`, `/inventory`, `/finance`, `/hr`, `/projects`, `/ai-insights`, `/audit`).
- **`src/components/`**: Reusable Stripe/Linear design primitives (`Header.tsx`, `Sidebar.tsx`, `WorkflowTimeline.tsx`, `Card.tsx`, `Badge.tsx`, `Button.tsx`).

### `server/` (Node.js Application Gateway)
- **`src/app.ts`**: Express server bootstrap, CORS configuration, Socket.io attachment, and route mounting.
- **`src/config/db.ts`**: Sequelize PostgreSQL connection pool with environment variable resolution.
- **`src/middlewares/auth.ts`**: Dual-layer security: `authenticateJWT` extracts bearer tokens; `requireRole` enforces strict role-based access.
- **`src/models/index.ts`**: Complete 10-table relational schema mappings and foreign key associations.
- **`src/controllers/`**: HTTP handlers separated by business domain:
  - `authController.ts`: Login, profile, bcrypt verification
  - `procurementController.ts`: 8-stage state machine with `< ₹10k` vs `>= ₹10k` branching and atomic GRN transaction
  - `inventoryController.ts`: SKU listing, creation, and stock mutation with audit logging
  - `financeController.ts`: Double-entry journal balance verification ($\sum \text{Debits} = \sum \text{Credits}$)
  - `hrController.ts`: Employee roster and attendance
  - `projectController.ts`: Milestone progress and developer hour burndown
  - `auditController.ts`: Cryptographic SHA-256 audit log retrieval and mathematical hash chain verification
- **`src/services/auditService.ts`**: Pure mathematical hashing function implementing SHA-256 chaining.
- **`src/services/aiService.ts`**: Circuit breaker wrapping FastAPI with 2,500ms timeout and Simple Moving Average (SMA) fallback.
- **`tests/`**: 8 Jest test suites (25 tests) verifying all routes and RBAC guards.

### `ai-service/` (Python FastAPI Machine Learning)
- **`main.py`**: High-performance FastAPI server running Scikit-learn regressors and anomaly isolation trees on port 8008.

### `deploy/` (DevOps & Scripts)
- **`docker-compose.yml`**: Provisions PostgreSQL 16 (`5434`), Redis 7 (`6380`), and Python AI service (`8008`).
- **`deploy/scripts/backup.ps1`**: Automated logical disaster recovery backup.
- **`deploy/scripts/restore.ps1`**: Automated database restoration.

---

## 3. Requisition State Machine Lifecycle

```
[DRAFT] 
   │
   ▼
[PENDING_MANAGER] ───────┬──── (Estimated Total < ₹10,000) ───────> [APPROVED]
   │                     │                                             │
   ▼                     └──── (Estimated Total >= ₹10,000) ──────┐    │
[REJECTED]                                                        │    │
                                                                  ▼    │
                                                        [PENDING_FINANCE]
                                                                  │
                                                                  ▼
                                                              [APPROVED]
                                                                  │
                                                                  ▼
                                                             [PO_ISSUED]
                                                                  │
                                                                  ▼
                                                          [GOODS_RECEIVED]
                                                                  │
                                                                  ▼
                                                      [STOCK_INCREMENTED]
                                                  (Atomic Database Transaction)
```

---

## 4. Cryptographic Audit Chaining Formula

Every state-mutating operation records a new row in `audit_logs` where the current hash is computed using:

$$\text{Current Hash} = \text{SHA-256}(\text{Prev Hash} \parallel \text{Actor ID} \parallel \text{Action} \parallel \text{Entity Name} \parallel \text{Entity ID} \parallel \text{Diff Payload} \parallel \text{Timestamp})$$

This creates a mathematically immutable ledger where any direct tampering with historical rows breaks the chain at row $i$.
