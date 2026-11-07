# ENTRIX ERP — Data Retention, Portability & Account Closure Guide (Phase 10)

> [!IMPORTANT]
> **LEGAL NOTICE: DRAFT REGULATORY SPECIFICATION**  
> This document describes technical procedures and draft operational policies for data management within ENTRIX ERP. It requires formal legal review by qualified data protection counsel before commercial SaaS deployment.

---

## 1. Data Portability & Machine-Readable Export

ENTRIX ERP complies with modern data portability standards (e.g. GDPR Article 20, India DPDP Act 2023) by providing tenant administrators with full, self-serve data portability.

### 1.1 Export Endpoint
- **URL**: `GET /api/v1/company/export`
- **Authorization**: `COMPANY_ADMIN` or `PLATFORM_ADMIN`
- **Output Format**: Structured, unencrypted UTF-8 JSON snapshot

### 1.2 Snapshot Contents
The export package encompasses the tenant's complete enterprise domain:
1. **Organization Profile**: Tenant ID, legal name, normalized slug, creation timestamp.
2. **Department Structure**: Department codes, titles, and quarterly budgets.
3. **Team Roster**: All registered members, designated roles, job designations, and joining dates (passwords excluded).
4. **Inventory Catalog**: Active stock SKUs, warehouse bin locations, recorded quantities, and unit values.
5. **Procurement Pipeline**: All historical purchase requisitions, approval chains, and verified goods receipts.
6. **Billing & Subscriptions**: Current subscription plan, lifecycle dates, and past B2B SaaS invoice receipts.

---

## 2. Organization Closure & Deactivation Protocol

Tenant administrators may permanently close their organization through a controlled, multi-step process designed to prevent accidental data destruction.

### 2.1 Closure Verification Workflow
1. **Authorization**: Only `COMPANY_ADMIN` may execute organization closure.
2. **Explicit Confirmation**: The user must submit a POST request matching their organization's unique slug:
   ```json
   POST /api/v1/company/close-account
   {
     "confirmSlug": "acme-corp",
     "reason": "Contractual completion of business operations"
   }
   ```
3. **Automated State Execution**:
   - `Tenant.status` is transitioned to `SUSPENDED`.
   - All associated users in the `users` table have `is_active` set to `FALSE`.
   - Active JWT tokens are rejected immediately at the `authenticateJWT` middleware layer.
   - Associated `Subscription` is transitioned to `CANCELED`.
   - An immutable record is created in `subscription_history` with the closure actor and timestamp.

---

## 3. Data Retention & Archival Policies (Draft)

| Data Category | Active Retention | Post-Closure Archival | Purge Mechanism |
| :--- | :--- | :--- | :--- |
| **Financial Ledger & Invoices** | Indefinite (active tenant) | 8 Years (Statutory tax compliance) | Automated cold-storage glacier tier |
| **Employee & Attendance Records** | Indefinite (active tenant) | 3 Years post-termination | Anonymized / Soft-deleted |
| **Procurement & Inventory Vouchers** | Indefinite (active tenant) | 5 Years | Archived to compliance partition |
| **Cryptographic Audit Logs (SHA-256)** | Indefinite (append-only) | 7 Years | Immutable WORM (Write Once, Read Many) |
| **Session & Refresh Tokens** | 7 Days (TTL) | Purged upon logout/rotation | Automated Redis TTL / Postgres cleanup |

---

## 4. Disaster Recovery & Restoration from Export

In the event of accidental tenant data deletion or tenant migration:
1. The exported JSON dump can be ingested via the administrative data restoration CLI tool:
   ```bash
   node ./server/dist/scripts/restore_tenant.js --file ./backups/entrix_backup_tenant_1792960000.json
   ```
2. The importer validates foreign key referential integrity in an isolated database transaction, preserving tenant scoping throughout the restoration.
