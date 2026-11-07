# ENTRIX ERP — Phase 13: Rollback & Disaster Recovery Procedures

**Document Purpose:** Actionable emergency procedures for application rollback, database schema reversal, and disaster recovery.

---

## 1. Application Version Rollback Procedure

If a critical blocker, memory leak, or fatal exception occurs post-launch:

### Step 1: Revert Container / Service Process
1. Stop running containers:
   ```powershell
   docker compose down
   ```
2. Checkout the previous known stable release commit or image tag:
   ```powershell
   git checkout <PREVIOUS_STABLE_TAG>
   ```
3. Rebuild and restart services:
   ```powershell
   npm --prefix server run build
   npm --prefix client run build
   npm --prefix server start
   ```

---

## 2. Database Schema Rollback vs Forward Recovery

### Reversible vs Non-Reversible Migrations

| Migration | Scope | Reversibility Assessment | Rollback Method |
| :--- | :--- | :--- | :--- |
| `001_initial_schema.sql` | Base Tables | **Non-Reversible in Place** | Requires full database restore from snapshot. |
| `002_create_refresh_tokens.sql` | Tokens Table | **Reversible** | `DROP TABLE IF EXISTS refresh_tokens;` |
| `003_integrity_constraints_and_indexes.sql` | Constraints | **Reversible** | Drop added indexes and check constraints. |
| `004_add_multi_tenancy.sql` | `tenant_id` columns | **Forward Recovery Only** | Column deletion causes data loss. Fix data forwards. |
| `005_create_attendance_records.sql` | Attendance | **Reversible** | `DROP TABLE IF EXISTS attendance_records;` |
| `006_commercial_saas_billing.sql` | SaaS Subscriptions | **Reversible** | `DROP TABLE IF EXISTS subscriptions, subscription_invoices, subscription_histories;` |
| `007_phase7_enterprise_models.sql` | Enterprise ERP | **Forward Recovery Only** | `suppliers`, `supplier_invoices`, `projects` contain active transactional links. |
| `008_phase11_enterprise_indexes.sql` | Performance Indexes | **Reversible** | Drop indexes via `DROP INDEX IF EXISTS <index_name>;` |

*Policy:* Once multi-tenant columns (`004`) and enterprise models (`007`) are in active use, schema rollbacks must be handled via **Forward Recovery Patches** or by restoring the pre-deployment database backup.

---

## 3. Emergency Database Recovery from Backup

To recover the database to the pre-deployment state:

1. Stop application traffic to prevent partial writes:
   ```powershell
   docker stop entrix-server entrix-client
   ```
2. Locate the most recent valid pre-deployment backup file in `deploy/backups/`.
3. Execute the restoration script:
   ```powershell
   .\deploy\scripts\restore.ps1 -BackupPath "deploy\backups\entrix_erp_backup_<TIMESTAMP>.sql"
   ```
4. Verify record integrity and ledger balance:
   ```powershell
   npm --prefix server test tests/adversarial_verification.test.ts
   ```
5. Restart application services:
   ```powershell
   docker start entrix-server entrix-client
   ```
