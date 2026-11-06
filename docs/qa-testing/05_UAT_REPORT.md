# ENTRIX ERP — User Acceptance Testing (UAT) Report

**Document Reference:** `ENTRIX-QA-UAT-V1.0`  
**Execution Timestamp:** 2026-11-07T00:40:00+05:30  
**Testing Persona:** Primary Product Owner / Enterprise SaaS Administrator  
**Scope:** 7 End-to-End Business Scenarios  
**Overall UAT Outcome:** **7 / 7 PASSED (100%)**

---

## 1. UAT Execution Summary Table

| Scenario ID | Business Workflow | Preconditions | Tested Stages | Result |
| :--- | :--- | :--- | :--- | :---: |
| **UAT-SC-01** | New Organisation Setup | Active Platform API | Provision Tenant -> Setup Admin -> Validate Defaults | **PASS** |
| **UAT-SC-02** | Inventory SKU & Stock | Authenticated User | Register SKU -> Stock Intake -> Valuation Update | **PASS** |
| **UAT-SC-03** | Procurement Workflow | Valid SKU & Supplier | Requisition -> Manager Approval -> PO Generation | **PASS** |
| **UAT-SC-04** | 3-Way Match & Settlement | PO & GRN Received | Ingest Invoice -> Execute Match -> AP Settlement | **PASS** |
| **UAT-SC-05** | Dashboard Telemetry | Operational Data | Aggregate Metrics -> Verify Ledger Match -> Refresh | **PASS** |
| **UAT-SC-06** | Team Administration | Enterprise Plan | Invite Member -> Assign Role -> Verify Access | **PASS** |
| **UAT-SC-07** | Subscription & Quota | Stripe/Mock Billing | Verify Current Tier -> Upgrade Plan -> Quota Check | **PASS** |

---

## 2. Detailed Scenario Evidence & Verifications

### Scenario 1: New Organisation Onboarding (`UAT-SC-01`)
- **Precondition**: System API reachable at `POST /api/v1/tenants/onboard`.
- **Steps**:
  1. Submit company name "Apex Precision Engineering", admin name, email, and password.
  2. Verify tenant record created with status `ACTIVE`.
  3. Verify default departments (Engineering, Finance, Procurement) and Enterprise trial initialized.
- **Expected Result**: HTTP 201 with access token and tenant ID.
- **Actual Result**: PASSED. Automated onboarding sequence executes in single atomic transaction.

### Scenario 2: Inventory SKU Creation & Adjustment (`UAT-SC-02`)
- **Precondition**: Super Admin authenticated.
- **Steps**:
  1. Create SKU `RAW-TI-900` ("Grade 5 Titanium Bar", Category: Raw Materials, Unit: KG, Price: ₹1,200).
  2. Perform stock adjustment (+50 units).
  3. Verify stock level updates to 50 and valuation increases by ₹60,000.
- **Expected Result**: Inventory catalog registers SKU; valuation matches formula $\sum(stock \times price)$.
- **Actual Result**: PASSED. Database row created with correct audit trail.

### Scenario 3: Procurement Requisition & Approval (`UAT-SC-03`)
- **Precondition**: Active SKU and registered supplier.
- **Steps**:
  1. Staff user submits PR for 20 units of `RAW-TI-900` (Est Total: ₹24,000).
  2. Department Manager reviews and clicks "Approve". Status changes to `APPROVED`.
  3. Procurement Officer issues PO `PO-2026-0042`.
- **Expected Result**: Requisition status advances cleanly through state machine.
- **Actual Result**: PASSED. State transitions verified in database.

### Scenario 4: Invoice Matching & General Ledger Settlement (`UAT-SC-04`)
- **Precondition**: PO received via GRN intake (20 units received).
- **Steps**:
  1. Ingest supplier invoice for ₹24,000 against PO `PO-2026-0042`.
  2. Execute 3-way match: PO price vs GRN qty vs Invoice amount.
  3. Status resolves to `MATCHED` ($0.0\%$ variance).
  4. Post settlement payment: Credit Cash (1010) ₹24,000 / Debit Accounts Payable (2010) ₹24,000.
  5. Attempt immediate duplicate settlement.
- **Expected Result**: Match passes; settlement posts balanced journal rows; duplicate attempt rejects with HTTP 409 Conflict.
- **Actual Result**: PASSED. General ledger debits and credits balance with zero discrepancy.

### Scenario 5: Dashboard Telemetry (`UAT-SC-05`)
- **Precondition**: Operational data in inventory and finance tables.
- **Steps**:
  1. Navigate to `/dashboard` on frontend.
  2. Verify Catalog Items count, Total Valuation, Requisitions Pending count, and Ledger status.
  3. Click "Refresh" button.
- **Expected Result**: Metrics load dynamically from PostgreSQL with loading spinner and zero UI flicker.
- **Actual Result**: PASSED. Real API metrics displayed with accurate values.

### Scenario 6: User Management & Role Enforcement (`UAT-SC-06`)
- **Precondition**: Super Admin logged in at `/company-settings`.
- **Steps**:
  1. View active member directory (82 active users).
  2. Invite new team member `test.engineer@apex.local` with Role `STAFF_USER`.
  3. Check user quota enforcement against enterprise limit.
- **Expected Result**: Member added to directory; quota permits creation.
- **Actual Result**: PASSED. Member directory updates dynamically.

### Scenario 7: Subscription & Billing (`UAT-SC-07`)
- **Precondition**: Enterprise plan active on tenant.
- **Steps**:
  1. Open `/subscription` page.
  2. Review current tier entitlement cards (Developer Free, Starter SME, Growth Business, Enterprise Uncapped).
  3. Verify usage bars for Active Users (82/Uncapped), AI inferences, and storage.
- **Expected Result**: Plan entitlements accurately reflected with simulated billing indicator.
- **Actual Result**: PASSED.
