# ENTRIX ERP — System Test Execution Report

**Document Reference:** `ENTRIX-QA-SYSTEM-V1.0`  
**Execution Timestamp:** 2026-11-07T00:39:30+05:30  
**Scope:** Full-Stack System Boundaries (Frontend UI, Express API, PostgreSQL, Redis, AI Service)  
**Overall Status:** **PASS**

---

## 1. System Health & Probes Verification

| Probe Endpoint | HTTP Method | Expected Status | Actual Output | Latency | Result |
| :--- | :---: | :---: | :--- | :---: | :---: |
| `http://localhost:5000/health` | `GET` | 200 OK | `{"status":"ONLINE","system":"ENTRIX ERP Backend"}` | 2ms | **PASS** |
| `http://localhost:5000/ready` | `GET` | 200 OK | `{"status":"READY","checks":{"database":"UP","redis":"UP","ai_service":"UP"}}` | 15ms | **PASS** |
| `http://localhost:8008/health` | `GET` | 200 OK | `{"status":"ONLINE","engine":"Python 3.11 + FastAPI + Scikit-Learn"}` | 4ms | **PASS** |
| `http://localhost:5173/` | `GET` | 200 OK | Vite React SPA Bundle (18 chunks, CSS 58KB) | 1ms | **PASS** |

---

## 2. Authentication & Session Lifecycle

```
[Unauthenticated User] 
       │ 
       ▼ (POST /api/v1/auth/login)
[Issued JWT (15m) + Refresh Token (7d)]
       │
       ├─► Valid Requests with 'Bearer <token>' -> HTTP 200/201 (Scoped to tenant_id)
       ├─► 5 Consecutive Failed Logins -> User Locked for 15 minutes (HTTP 423 Locked)
       ├─► Token Expired -> (POST /api/v1/auth/refresh) -> Fresh Access Token Returned
       └─► (POST /api/v1/auth/logout) -> Refresh Token Destroyed in DB & Blacklisted
```

- **Brute-Force Lockout Defense**: Verified. 5 invalid password attempts trigger `locked_until = NOW() + INTERVAL '15 minutes'` and return HTTP 423 Locked.
- **Token Invalidation on Logout**: Verified. Calling `/api/v1/auth/logout` revokes the token from `refresh_tokens` table in PostgreSQL.

---

## 3. Role-Based Access Control (RBAC) Matrix

| Route Endpoint | Super Admin (Role 1) | Manager (Role 2) | Finance Officer (Role 3) | Inventory Officer (Role 4) | Staff Requester (Role 5) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `GET /api/v1/dashboard/metrics` | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW |
| `POST /api/v1/inventory/` | ALLOW | ALLOW | DENY (403) | ALLOW | DENY (403) |
| `POST /api/v1/procurement/requests` | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW |
| `POST /api/v1/procurement/requests/:id/manager-approval` | ALLOW | ALLOW | DENY (403) | DENY (403) | DENY (403) |
| `POST /api/v1/procurement/requests/:id/finance-approval` | ALLOW | DENY (403) | ALLOW | DENY (403) | DENY (403) |
| `POST /api/v1/procurement/invoices/:id/pay` | ALLOW | DENY (403) | ALLOW | DENY (403) | DENY (403) |
| `GET /api/v1/finance/ledger` | ALLOW | DENY (403) | ALLOW | DENY (403) | DENY (403) |
| `GET /api/v1/audit/` | ALLOW | DENY (403) | DENY (403) | DENY (403) | DENY (403) |
| `PATCH /api/v1/company/profile` | ALLOW | DENY (403) | DENY (403) | DENY (403) | DENY (403) |

---

## 4. UI System Testing (Layout, Responsive & Navigation)

- **1920px Desktop Layout Fix**: Widen sidebar to 260px (`w-64`), remove centered column max-width bottleneck (`max-w-7xl` replaced with `w-full max-w-[1920px] px-8 py-8`).
- **Typography Minimums**: Enforced $\ge 13$px body typography across all tables, forms, and cards. Page titles: 28-32px bold. Headings: 20-22px semibold.
- **KPI Metrics Layout**: 4-column responsive grid (`grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6`) with equal card heights and clean status indicators.
- **Table Density**: 56-64px row height with right-aligned numeric currencies and mono SKU badges.
- **Client Routes**: All 10 routes (`/`, `/inventory`, `/procurement`, `/finance`, `/hr`, `/projects`, `/ai-insights`, `/audit`, `/company-settings`, `/subscription`) tested and routing cleanly without unhandled React runtime errors.
