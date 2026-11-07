# ENTRIX ERP — Commercial Pilot Launch Plan (Phase 10)

## 1. Executive Summary & Objective

This document outlines the operational execution plan for deploying ENTRIX ERP into a **Controlled Commercial Pilot Program**. The objective is to validate end-to-end multi-tenant enterprise operations with 3 to 5 selected pilot customer enterprises in a controlled, supervised environment prior to broader market availability.

---

## 2. Target Customer Profile (Ideal Pilot Cohort)

- **Vertical**: Small-to-Medium Indian Manufacturing, Assembly, or Distribution Enterprises.
- **Organization Size**: 10 to 50 active personnel across Procurement, Warehousing, and Finance.
- **Operational Cadence**: Minimum 10–25 daily purchase requisitions and stock movements.
- **Tech Stack Readiness**: Modern web browser access (Chrome/Edge/Firefox) with standard broadband.
- **Geographic Scope**: India-based entities operating in INR currency with GST compliance requirements.

---

## 3. Supported Modules & Scope of Operation

| Module | Pilot Status | Supported Capabilities |
| :--- | :--- | :--- |
| **Authentication & RBAC** | **Full** | Multi-factor JWT rotation, brute-force locking, strict tenant scoping |
| **Procurement & PO** | **Full** | Purchase requisition submission, manager approval, finance approval, 3-way GRN match |
| **Inventory & Stock** | **Full** | Multi-warehouse tracking, SKU catalog, stock adjustments, low-stock reorder triggers |
| **Finance & Ledger** | **Full** | Double-entry general ledger vouchers, trial balance balance checks, journal entry creation |
| **HR & Attendance** | **Full** | Employee directory, daily check-in/out attendance logging, leave balance tracking |
| **Project Milestones**| **Full** | Milestone burndown tracking, task status updates, resource hour allocations |
| **AI Decision Suite** | **Supervised**| Demand forecasting (30-day Simple Moving Average + ML fallback), anomaly alerts |
| **Tenant Settings** | **Full** | Member invitations, seat quota alerts, tenant data export, account deactivation |

---

## 4. Environment & Deployment Setup

1. **Hosting Topology**:
   - Web Tier: Containerized Node.js Express server behind Nginx reverse proxy.
   - Database Tier: Managed PostgreSQL 16 instance with automated WAL archiving.
   - Cache Tier: Redis 7.x instance for session blacklisting and rate limiting.
2. **Billing Mode for Pilot**:
   - `MockBillingAdapter` enabled (₹0 local cost, zero external card exposure).
   - Pilot organizations will be provisioned with **Growth** or **Enterprise** trial sponsorships.

---

## 5. Known Limitations & Supervised Constraints

- **Single-Region High Availability**: Pilot infrastructure runs in a single AWS/local availability zone (`ap-south-1`). Multi-region active-active failover is not enabled in Phase 10.
- **Local Sandbox Billing**: Payment collection is simulated via verified webhooks; live payment processing (e.g. live Stripe/Razorpay) is deferred until commercial production.
- **Local AI Fallback**: If Python FastAPI microservice is offline, the system safely engages deterministic 30-day Simple Moving Average (SMA) forecasting without halting ERP transactions.

---

## 6. Success Metrics & Key Performance Indicators (KPIs)

| Metric | Target SLA | Verification Method |
| :--- | :--- | :--- |
| **System Uptime** | 99.9% availability during business hours (08:00–20:00 IST) | Prometheus `/metrics` and `/health` probe |
| **API Latency (p95)** | < 120 ms across all standard read/write queries | `requestContextMiddleware` structured logs |
| **Tenant Isolation** | 0 cross-tenant data leaks or unauthorized accesses | Automated integration tests & RLS query verification |
| **Accounting Invariant** | 0 double-entry debit/credit imbalances | Transaction integrity tests & ledger checksum triggers |
| **Defect MTTR** | P0 resolved in < 4 hours; P1 resolved in < 12 hours | On-call incident response workflow |

---

## 7. Defect Severity & Escalation Matrix

- **Severity 0 (Critical Blocker)**: System-wide outage, data loss, tenant boundary breach, or ledger corruption.
  - *Response*: Immediate paging (<15 min), hotfix deployment within 4 hours.
- **Severity 1 (Major)**: Core ERP module down (e.g. unable to approve purchase orders or adjust stock).
  - *Response*: On-call engineer engagement within 1 hour; workaround or patch within 12 hours.
- **Severity 2 (Moderate)**: Minor workflow defect with available operational workaround.
  - *Response*: Handled in standard sprint cycle within 48 hours.
- **Severity 3 (Cosmetic)**: UI alignment or typography issues not impacting transactional integrity.
  - *Response*: Logged in backlog for upcoming release.

---

## 8. Rollback & Disaster Recovery Procedures

1. **Automated Database Snapshots**: Executed daily at 02:00 IST via `deploy/scripts/backup.ps1` / `backup.sh`.
2. **Recovery Time Objective (RTO)**: < 30 minutes to restore database and services from cold snapshot.
3. **Recovery Point Objective (RPO)**: < 15 minutes of transactional data loss via Write-Ahead Logging (WAL).
4. **Tenant Offboarding & Exit Plan**: If a pilot customer terminates participation, their entire tenant footprint can be exported immediately as JSON via `GET /api/v1/company/export` and purged via `POST /api/v1/company/close-account`.

---

## 9. Exit Criteria for Public Commercial Launch

Before transitioning from Controlled Pilot to Open Commercial Availability:
1. Completion of a 60-day incident-free pilot cycle across at least 3 active enterprises.
2. Formal third-party application security penetration test and SOC2 Type I readiness audit.
3. Live payment gateway integration (Stripe / Razorpay) configured with production webhook secrets.
4. Multi-region automated database replication and DNS failover tested under chaos conditions.
