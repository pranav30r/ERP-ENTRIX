# ENTRIX ERP — Commercial Product Completion & SaaS Monetization (Phase 6)

## 1. Executive Summary & Architecture Overview

ENTRIX has been elevated into an industry-grade, commercially viable multi-tenant SaaS Enterprise Resource Planning platform. Phase 6 introduces full subscription lifecycle orchestration, seat quota enforcement, metered resource billing, company onboarding with tenant isolation, and deterministic sandbox monetization requiring **₹0 live costs** or external card processing.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ENTRIX SaaS Account Model                       │
└────────────────────────────────────────────────────────────────────────┘
                                │
        ┌───────────────────────┴───────────────────────┐
        ▼                                               ▼
┌─────────────────────────┐                   ┌─────────────────────────┐
│     Company/Tenant      │                   │   Subscription Master   │
│  - ID (UUID)            │ 1 ────────────── 1│  - Plan Tier            │
│  - Name, Slug           │                   │  - Status (TRIALING,..) │
│  - Status               │                   │  - Period Start / End   │
└─────────────────────────┘                   └─────────────────────────┘
        │                                               │
        ├─────────────────────────┐                     ├─────────────────────────┐
        ▼                         ▼                     ▼                         ▼
┌───────────────┐         ┌───────────────┐     ┌───────────────┐         ┌───────────────┐
│  Team Members │         │ Usage Meter   │     │  Sub History  │         │ SaaS Invoices │
│ (User & Roles)│         │(Users, AI, MB)│     │(State Audits) │         │ (PDF & Receipts)
└───────────────┘         └───────────────┘     └───────────────┘         └───────────────┘
```

---

## 2. Configuration-Driven Plan & Entitlement Matrix

SaaS tiers are centrally defined in `server/src/config/plans.ts`:

| Plan Tier | Monthly Price (INR) | Max Active Users | Vault Storage | Monthly AI Inferences | Allowed ERP Modules | Support SLA |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **FREE** | ₹0 | 3 | 250 MB | 0 | DASHBOARD, PROCUREMENT, INVENTORY | Community |
| **STARTER** | ₹4,999 | 10 | 2 GB | 50 | DASHBOARD, PROCUREMENT, INVENTORY, PROJECTS | Standard Email (24h) |
| **GROWTH** | ₹14,999 | 50 | 15 GB | 500 | DASHBOARD, PROCUREMENT, INVENTORY, PROJECTS, HR, FINANCE, AI | Priority Ticket (4h) |
| **ENTERPRISE**| ₹39,999 | Unlimited (999,999)| 100 GB | Uncapped (100,000) | Full Suite (+ AUDIT, Retention, Multi-Entity) | Dedicated SLA (1h 24/7) |

---

## 3. Subscription Lifecycle State Machine

The subscription lifecycle conforms to canonical SaaS billing workflows:

```
[ Tenant Onboarding ]
         │
         ▼
    ( TRIALING ) ──[ Payment Succeeded ]──► ( ACTIVE )
         │                                      │
  [ Trial Expired ]                       [ Auto-Renew Failed ]
         │                                      │
         ▼                                      ▼
   ( EXPIRED )                             ( PAST_DUE )
                                                │
                                          [ 30-Day Dunning ]
                                                │
                                                ▼
                                          ( SUSPENDED )
```

### State Transitions:
1. **TRIALING**: Granted on initial company registration (default 14 days).
2. **ACTIVE**: Valid paid plan in effect. All entitled modules and metered limits enabled.
3. **PAST_DUE**: Webhook received `invoice.payment_failed`. Tenant receives grace warning in UI.
4. **SUSPENDED**: After grace expires or administrative hold. Cross-cutting middleware blocks all tenant operations with HTTP 403.
5. **CANCELED**: User selected "Cancel Auto-Renew". Access remains unlocked until `current_period_end`.
6. **EXPIRED**: Period ended without renewal; customer must switch plan to continue.

---

## 4. Separation of SaaS Invoices vs ERP Ledger

To maintain accounting and regulatory integrity:
- **`subscription_invoices` Table**: Belongs to the SaaS platform infrastructure. Tracks B2B SaaS subscription dues, PDF receipts, and transaction identifiers.
- **`ledger_entries` Table**: Represents the tenant's own internal corporate double-entry general ledger (debit/credit assets, liabilities, expenses).
- **Strict Isolation**: A customer's internal accountant cannot tamper with platform billing, and SaaS renewal events do not dirty the tenant's operational balance sheets unless explicitly recorded as an accounts payable voucher.

---

## 5. Provider-Neutral Billing Adapter

Local development and academic testing operate on `MockBillingAdapter` (`server/src/services/billing/mockBillingAdapter.ts`):
- Deterministic ₹0 execution without Stripe or Razorpay credentials.
- Sandbox checkout URL generation.
- HMAC-SHA256 and `mock_valid` webhook signature verification.
- Can be swapped in production via environment variable `BILLING_PROVIDER=STRIPE` implementing the `BillingProviderInterface`.

---

## 6. Security & Entitlement Middleware

- **`requireModuleEntitlement(moduleName)`**: Evaluates tenant plan entitlements before controller invocation. Emits `403 FEATURE_NOT_ENTITLED` with required tier upgrade payload.
- **`checkUserQuota`**: Concurrently safe seat counter (`User.count({ where: { tenant_id, is_active: true } })`). Prevents member invitations exceeding plan capacity.
- **`trackAiUsage`**: Atomically monitors monthly inference usage in `tenant_usage_counters` table against monthly quotas.

---

## 7. Automated Test Verification

All 16 test suites pass with 100% success rate:
- `server/tests/commercial_saas.test.ts` (13 tests):
  1. Plan catalog retrieval.
  2. Status inquiry & limits.
  3. Feature gating (Free blocked from Finance & HR).
  4. Seat limits (Free rejects 4th user).
  5. Mock checkout session creation.
  6. Idempotent webhook processing & plan upgrade to Growth.
  7. Feature gate lifting post-upgrade (Finance accessible).
  8. Invoice generation & tenant isolation.
  9. Auto-renew cancellation & resumption.
- Entire test suite: **99 of 99 tests passing** across 16 test suites in 11.7s.
