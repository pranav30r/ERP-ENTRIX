# ENTRIX ERP — Bug Register & Defect Inventory (Updated)

**Document Reference:** `ENTRIX-QA-BUGS-V2.0`  
**Execution Timestamp:** 2026-11-07T00:53:30+05:30  
**Resolution Summary:** All high and medium defects resolved and verified.

---

## 1. Defect Inventory & Resolution Log

| Defect ID | Priority | Module | Title / Description | Root Cause | Status | Resolution Details |
| :--- | :---: | :--- | :--- | :--- | :---: | :--- |
| **BUG-01** | **P1** | **Tenant Onboarding** | Missing Public Self-Service Signup Page | API `POST /api/v1/tenants/onboard` was implemented, but frontend lacked `/register` form. | **RESOLVED** | Created `Register.tsx` page, added standalone `/register` route in `App.tsx`, and wired to onboarding API. Tested and verified. |
| **BUG-02** | **P2** | **Billing & Subscriptions** | Simulated Billing Gateway Adapter | Subscription checkout used `mockBillingAdapter.ts` only. | **RESOLVED** | Implemented `StripeBillingAdapter` supporting live Stripe Checkout Sessions and Webhook signatures with dynamic fallback. |
| **BUG-03** | **P3** | **Finance / AR** | Missing Dedicated Customer AR Invoicing Screen | Outbound billing to enterprise customers lacked dedicated screens and endpoints. | **RESOLVED** | Added `/finance/sales-invoice` (Dr 1100 / Cr 4000) and `/finance/customer-receipt` (Dr 1010 / Cr 1100), plus full Accounts Receivable tab in `Finance.tsx`. |
| **BUG-04** | **P2** | **Auth / RBAC** | `requireRole` Rejecting Super Admin | `requireRole` did not permit `SUPER_ADMIN` unless explicitly listed in array. | **RESOLVED** | Updated `server/src/middlewares/auth.ts` to grant `SUPER_ADMIN` and `PLATFORM_ADMIN` universal administrative clearance. |
| **BUG-05** | **P4** | **UI / UX** | Multi-Currency Display Formatting | Hardcoded INR currency symbol. | **DOCUMENTED** | Formatter helper ready for next minor visual patch. |

---

## 2. Defect Resolution Summary

- **Total Logged Defects**: 5
- **Resolved & Verified**: 4 (BUG-01, BUG-02, BUG-03, BUG-04)
- **Pending Non-Blocking Enhancement**: 1 (BUG-05: Minor currency locale toggle)
- **Critical / High Remaining**: **0**
