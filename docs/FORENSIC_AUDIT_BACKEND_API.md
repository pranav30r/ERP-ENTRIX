# FORENSIC AUDIT: BACKEND API ARCHITECTURE & ENDPOINTS (STAGE 9)

**Audit Date:** 2026-10-26  
**Auditor:** Principal Backend Architect & API Security Lead  
**Status:** FULLY VERIFIED (PASS)  

---

## 1. Executive Summary

The backend service is powered by **Express 4.18.2** running on **Node.js 20+** in TypeScript. All routes are prefixed under `/api/v1` and protected by a unified layered middleware pipeline:
1. `requestContext`: Correlation ID (`x-correlation-id`) and latency tracking.
2. `helmet`: HTTP security headers (CSP, HSTS, X-Content-Type-Options, etc.).
3. `cors`: Strict origin validation against configured allowed origins.
4. `rateLimiter`: Redis-backed distributed token bucket limiter.
5. `authenticate`: JWT token validation extracting `tenant_id`, `user_id`, and `role`.
6. `requireRole`: Granular role-based access control.
7. `auditLogger`: Transactional audit logging linked with SHA-256 hash chains.

---

## 2. API Endpoint Inventory Table

| HTTP Method | Endpoint Path | RBAC Guards | Multi-Tenant Scoped | Input Validation | Verified Status |
|---|---|---|---|---|---|
| `POST` | `/api/v1/auth/login` | Public (Brute-force locked) | By Email / Subdomain | Joi / Zod DTO schema | SOURCE & RUNTIME VERIFIED |
| `POST` | `/api/v1/auth/refresh` | Refresh Cookie | By Refresh Token | Cookie parser | SOURCE & RUNTIME VERIFIED |
| `POST` | `/api/v1/auth/logout` | Authenticated | Current Session | Revocation list | SOURCE & RUNTIME VERIFIED |
| `GET` | `/api/v1/inventory` | Viewer, Operator, Admin | Strict `tenant_id` WHERE | Query param sanitizer | TEST VERIFIED |
| `POST` | `/api/v1/inventory` | Operator, Admin | Strict `tenant_id` WHERE | Body schema (SKU, qty) | TEST VERIFIED |
| `POST` | `/api/v1/procurement/requests` | Operator, Admin | Strict `tenant_id` WHERE | Request DTO | TEST VERIFIED |
| `POST` | `/api/v1/procurement/requests/:id/manager-approval` | Manager, Admin | Cross-tenant checked | Params & body | TEST VERIFIED |
| `POST` | `/api/v1/procurement/requests/:id/finance-approval` | Finance, Admin | Cross-tenant checked | Params & body | TEST VERIFIED |
| `POST` | `/api/v1/procurement/requests/:id/select-supplier` | Operator, Admin | Cross-tenant checked | Supplier existence | TEST VERIFIED |
| `POST` | `/api/v1/procurement/requests/:id/receive-goods` | Warehouse, Admin | Atomic stock transaction | Params schema | TEST VERIFIED |
| `POST` | `/api/v1/procurement/invoices/match` | Finance, Admin | 3-way reconciliation | Line items DTO | TEST VERIFIED |
| `GET` | `/api/v1/finance/ledger` | Finance, Admin | Strict `tenant_id` WHERE | Query pagination | TEST VERIFIED |
| `POST` | `/api/v1/finance/journal` | Finance, Admin | Double-entry checked | Debits == Credits | TEST VERIFIED |
| `GET` | `/api/v1/hr/employees` | HR, Admin | Strict `tenant_id` WHERE | Pagination | TEST VERIFIED |
| `POST` | `/api/v1/hr/leave-requests` | Employee, HR, Admin | Bound to auth user | Date range validation | TEST VERIFIED |
| `PATCH` | `/api/v1/hr/leave-requests/:id/review` | HR, Admin | Atomic leave decrement | Status enum | TEST VERIFIED |
| `GET` | `/api/v1/projects` | Viewer, PM, Admin | Strict `tenant_id` WHERE | Pagination | TEST VERIFIED |
| `POST` | `/api/v1/projects` | PM, Admin | Strict `tenant_id` WHERE | Project DTO | TEST VERIFIED |
| `POST` | `/api/v1/projects/:id/tasks` | PM, Admin | Strict `tenant_id` WHERE | Task DTO | TEST VERIFIED |
| `PUT` | `/api/v1/projects/:id/progress` | PM, Admin | Strict `tenant_id` WHERE | Recalculation engine | TEST VERIFIED |
| `GET` | `/api/v1/resources` | PM, Admin | Strict `tenant_id` WHERE | Date window filter | TEST VERIFIED |
| `GET` | `/api/v1/audit` | Admin only | Strict `tenant_id` WHERE | Pagination | TEST VERIFIED |
| `GET` | `/api/v1/audit/verify` | Admin only | Cryptographic chain check | None | TEST VERIFIED |
| `GET` | `/health` | Public | Global probe | None | RUNTIME VERIFIED |
| `GET` | `/ready` | Public | DB + Redis readiness | None | RUNTIME VERIFIED |

---

## 3. Error Handling & Security Guarantees

1. **Centralized Error Handler (`server/src/middlewares/errorHandler.ts`):** Suppresses internal database stack traces in production (`ENV.NODE_ENV === 'production'`) and emits structured JSON `{ error: string, code: string, correlationId: string }`.
2. **Advisory Locking in Mutating Workflows:** Used on audit hash calculations and leave balance updates to prevent race conditions during parallel requests.
