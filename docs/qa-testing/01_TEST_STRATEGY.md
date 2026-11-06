# ENTRIX ERP — QA & Testing Strategy

**Document Reference:** `ENTRIX-QA-STRATEGY-V1.0`  
**Execution Timestamp:** 2026-11-07T00:38:00+05:30  
**Environment:** Node.js v20+, TypeScript 5.4, PostgreSQL 16 (Port 5434), Redis 7 (Port 6380), Python 3.11/3.13 (Port 8008), Vite React 18 (Port 5173).

---

## 1. Testing Scope & Quality Objectives

The ENTRIX ERP testing strategy spans end-to-end multi-tenant validation, financial double-entry accuracy, cryptographic audit trail verification, automated failover mechanisms, and enterprise UI/UX usability.

### Quality Objectives:
1. **Financial Integrity**: Guarantee that general ledger balance satisfies $\sum \text{Debits} \equiv \sum \text{Credits}$ across all journal postings down to ₹0.00.
2. **Multi-Tenant Isolation**: Enforce non-bypassable `tenant_id` scoping at middleware, ORM, and database constraints.
3. **Transaction Safety**: Prevent lost updates, race conditions, and double settlements through pessimistic row locking (`SELECT FOR UPDATE`) and atomic Sequelize transactions.
4. **Resilience & Graceful Degradation**: Ensure automated fallback to Simple Moving Average (SMA) and rule-based heuristics when the AI microservice is degraded.
5. **UI Usability**: Validate responsive layouts from 1024px to 2560px with standardized typography (>= 13px body text) and real API data bindings.

---

## 2. Test Pyramid & Execution Levels

```
                     / \
                    /   \     E2E / UAT (Phase 4)
                   / UAT \    7 Business Scenarios (PR -> PO -> GRN -> 3-Way Match)
                  /-------\
                 /  System \  Integration & Security Suites (Phase 2 & 3)
                /   Tests   \ 22 Test Suites, 161 Automated Tests (Jest + Supertest)
               /-------------\
              /   Unit Tests  \ Pure Functions, Zod Schemas, Entitlements, Mappings
             /-----------------\
```

| Level | Framework / Runner | Scope | Target Pass Rate |
| :--- | :--- | :--- | :--- |
| **Unit Testing** | Jest / TypeScript | Schemas, Entitlement matrices, Account mappings, SMA algorithms | 100% |
| **Integration Testing** | Jest + Supertest + PG | Database constraints, ORM hooks, Redis cache, 3-way matching | 100% |
| **System Testing** | HTTP / API / CLI / curl | Health probes, readiness probes, rate limiting, JWT rotation | 100% |
| **UAT Scenarios** | Browser / Manual / API | Onboarding, SKU creation, GRN receipt, AP settlement, Reports | 100% |
| **Security Auditing** | Adversarial / Pen-test | Cross-tenant injection, RBAC privilege escalation, replay attacks | 100% |

---

## 3. Test Environments & Boundaries

- **Database**: PostgreSQL 16 Alpine containerized on port 5434. Pre-populated with baseline migrations `001_initial_schema.sql` through `008_phase11_enterprise_indexes.sql`.
- **Cache**: Redis 7 Alpine containerized on port 6380.
- **AI Microservice**: FastAPI + Scikit-Learn on port 8008.
- **Backend API**: Express + TypeScript on port 5000.
- **Frontend SPA**: React 18 + Vite on port 5173.
- **Test Isolation Policy**: Disposable and isolated UUID keys for test artifacts; non-destructive teardowns in `afterAll` hooks.

---

## 4. Entry & Exit Criteria

### Entry Criteria:
- Clean TypeScript compilation on server (`npm --prefix server run build` exit code 0).
- Clean production build on client (`npm --prefix client run build` exit code 0).
- PostgreSQL and Redis containers healthy and accepting connections.

### Exit Criteria:
- All 22 backend test suites pass with 0 failures (161/161 tests).
- Ledger debits equal credits with zero variance.
- Duplicate payment attempts return HTTP 409 Conflict.
- AI service returns valid ML inference or verified SMA fallback.
- No critical (P0/P1) security vulnerabilities unmitigated.
