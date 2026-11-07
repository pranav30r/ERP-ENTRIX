# ENTRIX ERP — Customer Pilot Onboarding Kit

**Version:** 1.0 (Controlled Pilot Release)  
**Target Audience:** Customer Pilot Administrators, Department Leads, and Operations Personnel  
**Scope:** Supervised Pilot Cohort (Max 5 Participant Organizations)

---

## 1. Company Onboarding Guide

### 1.1 Program Objectives
The ENTRIX ERP Controlled Pilot provides your organization early access to a unified, multi-tenant enterprise resource planning system. During this 90-day trial period, your team can test core procurement, warehousing, finance, project management, and HR workflows in an isolated, secure environment.

### 1.2 Prerequisites
- Modern web browser: Google Chrome (v110+), Mozilla Firefox (v115+), or Microsoft Edge (v110+).
- Network: Stable internet access with HTTPS connectivity to the designated pilot host.
- Pilot Environment URL: Provided securely by your dedicated Customer Success Engineer.

### 1.3 Tenant Isolation Guarantee
Every participating company receives a cryptographically and logically isolated tenant boundary (`tenant_id`). No cross-tenant visibility is permitted at any database or API layer. All database tables strictly enforce row-level tenant filtering (`WHERE tenant_id = :tenantId`).

---

## 2. Administrator Setup Guide

### 2.1 First-Time Login
1. Navigate to the ENTRIX ERP login URL.
2. Sign in with the provisional credentials supplied in your Pilot Provisioning Letter:
   - **Email:** `admin@<your-company-slug>.local`
   - **Temporary Password:** `PilotSecure@2026`
3. Promptly update your password via **Company Settings** $\to$ **Profile**.

### 2.2 Adding Team Members
1. In the left navigation sidebar, click **Company Settings**.
2. Under **Team Members**, click **Invite Member**.
3. Fill in:
   - First and Last Name.
   - Business Email.
   - Department assignment.
   - Operational Role.
4. The user account is activated instantly with provisional credentials.

---

## 3. User Role Reference Matrix

| Role | System Identifier | Intended Persona | Permitted Capabilities |
| :--- | :--- | :--- | :--- |
| **Company Administrator** | `COMPANY_ADMIN` (6) | Operations Director / IT Lead | Full control of tenant settings, user invitations, subscription oversight, and data export. |
| **HR Manager** | `HR_MANAGER` (2) | People Operations Lead | Employee directory management, attendance monitoring, and leave request review/approval. |
| **Finance Officer** | `FINANCE_OFFICER` (3) | Chief Accountant / Controller | General Ledger review, manual journal vouchers, PO finance sign-off, and 3-way invoice matching. |
| **Procurement Officer**| `PROCUREMENT_OFFICER` (4)| Purchasing & Store Manager | Supplier catalog, Purchase Order issuance, GRN intake, and physical stock adjustments. |
| **Staff User** | `STAFF_USER` (5) | General Employee / Engineer | Requisition creation, attendance check-in, personal leave requests, and assigned task logging. |

---

## 4. Module Quick-Start & Test Scenarios

### Scenario A: Procurement to Inventory Intake
1. **Requisition**: A Staff User navigates to **Procurement** and clicks **New Requisition** for SKU `PLT-STL-01` (Quantity: 15).
2. **Approval**:
   - If estimated total $< ₹10,000$, Department Manager approves directly.
   - If estimated total $\ge ₹10,000$, Finance Officer completes secondary sign-off.
3. **PO Issuance**: Procurement Officer selects the verified vendor `SUP-PLT-01`. Status transitions to `PO_ISSUED`.
4. **Goods Intake**: Click **Receive Goods**. The system generates a Goods Received Note (GRN), increments available stock by 15 units, and records an immutable entry in the `inventory_movements` ledger.

### Scenario B: Three-Way Invoice Reconciliation
1. Navigate to **Procurement** $\to$ **Invoice Matching**.
2. Submit vendor invoice with:
   - Billed Quantity: 15.
   - Invoiced Amount: Equal to PO Total (within 1% tolerance).
3. System confirms `MATCHED`, clears Accounts Payable liability, and posts balanced double-entry ledger postings.

### Scenario C: Employee Leave Approval
1. Staff member submits 2 days of Annual Leave via **HR** $\to$ **Leave Requests**.
2. HR Manager inspects the request and clicks **Approve**.
3. The system atomically decrements the employee's `annual_leave_balance` in a row-locked transaction.

---

## 5. Known Limitations During Pilot

1. **Synthetic Data Policy**: Initial pilot testing must use synthetic or scrubbed business data.
2. **Billing Sandbox**: All payment operations run in mock mode ($0 card exposure).
3. **AI Fallback Mode**: If the Python inference microservice is temporarily stopped, the system automatically engages deterministic Simple Moving Average (SMA) forecasting without transaction interruption.
4. **Single-Region Resilience**: The pilot infrastructure is hosted in a single primary cloud region.

---

## 6. Support, Escalation & Account Closure

### 6.1 Pilot Support Channels
- **Urgent Issues (P0/P1)**: Email `pilot-emergency@entrix.local` (SLA: < 1 hour).
- **General Inquiries & Feedback**: Email `pilot-success@entrix.local` (SLA: < 8 hours).
- **Daily Office Hours**: Dedicated virtual sync at 16:00 IST.

### 6.2 Data Retention & Account Closure
1. Administrators may download a complete JSON archive of all tenant data anytime via **Company Settings** $\to$ **Export Tenant Data**.
2. If your organization elects to discontinue participation:
   - Click **Close Company Account** in **Company Settings**.
   - Type your company slug to confirm.
   - All tenant records, user associations, and data entries are immediately soft-deleted and scheduled for cryptographic purge within 30 days.
