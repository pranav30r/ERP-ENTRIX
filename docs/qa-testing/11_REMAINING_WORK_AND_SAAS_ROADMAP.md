# ENTRIX ERP — Remaining Work & SaaS Commercialization Roadmap

**Document Reference:** `ENTRIX-QA-ROADMAP-V1.0`  
**Execution Timestamp:** 2026-11-07T00:43:00+05:30  
**Target:** General Availability (GA) Commercial Release  

---

## 1. Prioritized Implementation Sprints

### Sprint 1: Self-Service Customer Onboarding UI (Effort: 2 Days | Priority: P1)
- **Goal**: Enable prospective enterprise tenants to register online without manual administrator seeding.
- **Tasks**:
  1. Create `/register` frontend route with company name, admin name, work email, and password.
  2. Connect to existing `POST /api/v1/tenants/onboard` endpoint.
  3. Initialize default departments (Engineering, Operations, Finance) and grant 14-day Enterprise trial.
  4. Redirect new tenant directly to onboarding wizard on Dashboard.

### Sprint 2: Live Payment Gateway Integration (Effort: 3 Days | Priority: P2)
- **Goal**: Replace simulated `mockBillingAdapter.ts` with real credit card processing.
- **Tasks**:
  1. Add Stripe Node SDK (`stripe`) to `server/package.json`.
  2. Implement Stripe Checkout Session generation for STARTER, GROWTH, and ENTERPRISE tiers.
  3. Implement Stripe Webhook handler (`customer.subscription.updated`, `invoice.payment_succeeded`).
  4. Preserve mock billing fallback via `ALLOW_MOCK_BILLING=true` environment flag for local development.

### Sprint 3: Customer Accounts Receivable (AR) Module (Effort: 4 Days | Priority: P3)
- **Goal**: Complete outbound sales invoicing cycle.
- **Tasks**:
  1. Build Sales Invoice Generator in Finance module.
  2. Implement automated journal posting: Debit Accounts Receivable (1100) / Credit Sales Revenue (4000).
  3. Add customer payment receipt recording: Debit Operating Cash (1010) / Credit Accounts Receivable (1100).

### Sprint 4: Localization & Global Ergonomics (Effort: 1 Day | Priority: P4)
- **Goal**: Polish multi-currency and presentation options.
- **Tasks**:
  1. Support dynamic currency symbols (USD, EUR, GBP, INR) based on `company_settings.currency`.
  2. Add dark/light mode toggle.

---

## 2. Commercial Pilot Deployment Checklist

- [x] Backend TypeScript build clean (`tsc` exit 0).
- [x] Frontend production build clean (Vite exit 0).
- [x] All 22 test suites and 161 tests passing.
- [x] General ledger debits and credits verified balanced at ₹3,842,300.00.
- [x] Duplicate payment prevention returning HTTP 409 Conflict.
- [x] Cryptographic SHA-256 audit chaining operational.
- [x] Docker compose multi-container orchestration verified.
- [ ] Public customer self-registration form (Sprint 1).
- [ ] Production Stripe API keys configured in environment (Sprint 2).
