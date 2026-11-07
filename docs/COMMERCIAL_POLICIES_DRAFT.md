# ENTRIX ERP — Commercial Data Privacy, Compliance & Legal Policy Outlines

> [!WARNING]
> **LEGAL REVIEW REQUIRED**: These documents represent operational technical specifications and initial policy drafts reflecting actual system architecture. They do NOT constitute formal legal advice and require review by licensed commercial counsel prior to public commercial contract execution.

---

## 1. Technical Data Classification & Inventory

| Category | Specific Attributes Stored | Collection Rationale | Access Control Level | Retention Period |
| :--- | :--- | :--- | :--- | :--- |
| **Authentication & Identity** | Email, bcrypt password hash, name, role ID, tenant ID, failed login counters, locked timestamp | Authentication, RBAC authorization, and account lockout protection | User self (read), Company Admin, Super Admin | Active account lifetime + 30 days post-deletion |
| **Session Security** | SHA-256 hashed refresh tokens, expiration timestamps, revocation timestamps | Token rotation, session refresh, reuse attack detection | Automated system only | Active session lifetime (7 days) + 30 days audit |
| **Personnel & HR** | Employee code, designation, joining date, base salary, annual leave balance | Departmental budgeting, approval workflows, payroll tracking | HR Manager, Super Admin | Duration of employment + 7 years statutory tax compliance |
| **Procurement & Supply Chain** | PR codes, item SKUs, quantities, estimated totals, justifications, PO numbers, GRN codes | Requisition approval pipeline, inventory restock, vendor tracking | Requester, Dept Lead, Finance Officer, Procurement Officer | 7 years statutory accounting record retention |
| **Financial Postings** | Ledger entries (debit/credit amounts, account codes, transaction UUIDs) | Double-entry balance book-keeping and statutory financial reporting | Finance Officer, Super Admin | Permanent immutable record (min 7 years) |
| **Cryptographic Audit Trail** | Actor UUID, action string, entity name, entity UUID, diff payload, previous SHA-256 hash, current hash | Tamper-evident record of all system state mutations | Read-only to Super Admin, Compliance Officer | Permanent immutable retention (cannot be pruned) |
| **Predictive AI Inputs** | Numerical SKU historical demand vectors, budget burn rates | Inventory reorder forecasting and budget anomaly detection | Automated AI FastAPI microservice | In-memory during calculation; not stored by AI engine |

---

## 2. Tenant Offboarding, Data Export & Deletion Procedures

### Data Export (Portability)

1. Upon contract termination, tenant company administrators can request an atomic logical export of all organizational records.
2. An automated export script runs scoped by `tenant_id`:
   - Personnel and HR rosters
   - Inventory catalog and historical stock adjustments
   - Purchase requests, Purchase orders, and GRN receipts
   - General Ledger journal entries
3. Export delivered as encrypted ZIP bundle containing CSV and structured JSON files.

### Deletion & Purging (Right to be Forgotten)

1. **Transactional Data**: Associated records in `purchase_requests`, `purchase_orders`, `goods_received_notes`, and `inventory_items` are archived and hard-deleted after the mandatory 30-day grace period.
2. **Cryptographic Audit Log**: To maintain mathematical SHA-256 hash chain integrity for remaining tenants without chain breaks, offboarded tenant records in `audit_logs` are scrubbed of Personally Identifiable Information (PII) by replacing actor email/names with cryptographically anonymized tokens (`ANONYMIZED_TENANT_<HASH>`).
3. **Authentication Records**: User records and active refresh tokens are purged permanently.

---

## 3. AI Usage, Data Privacy & Explainability Limitations

1. **Zero External AI Sharing**: ENTRIX uses an internal, isolated Python FastAPI microservice running open-source Scikit-learn models (Random Forest regression & Isolation Forest anomaly trees). Customer data is **never** transmitted to OpenAI, Google, Anthropic, or external third-party model providers.
2. **No Generative AI Hallucinations**: Requisition approvals and double-entry financial balances are computed deterministically via relational code. AI is restricted strictly to advisory analytics (demand velocity forecasting and cost burn warnings).
3. **Explainability Boundary**: Demand forecasting outputs represent statistical projections based on historical time-series signals and cannot guarantee supply chain vendor availability or future price stability.

---

## 4. Draft Commercial Privacy Policy Outline (Summary for Legal Counsel)

- **Data Controller & Processor Roles**: ENTRIX ERP operates as a **Data Processor** for tenant enterprise business records; the subscribing customer operates as the **Data Controller**.
- **Cookies & Trackers**: The application uses zero third-party marketing, analytics, or behavioral tracking cookies. Only functional session storage (`entrix_token`, `entrix_refresh_token`) is maintained locally in the user's browser.
- **Data Subject Rights**: Mechanisms for access, rectification, export, and deletion are implemented via standard APIs.

---

## 5. Draft Commercial Terms of Service Outline (Summary for Legal Counsel)

- **Subscription Tiers & Multi-Tenancy**: Tenants are logically partitioned by `tenant_id`. Access to other tenants' business data constitutes a material breach and triggers automated session revocation.
- **Service Availability Target**: Target uptime Service Level Agreement (SLA) of 99.5% during core operating hours, excluding scheduled maintenance windows.
- **Limitation of Liability**: Financial forecasting and anomaly warnings are advisory. Final sign-off on purchase orders and financial disbursements rests solely with authorized customer personnel.
