# ENTRIX ERP — CLIENT HANDOVER & DEMONSTRATION RUNBOOK

**Document:** Client Handover & Live Demonstration Runbook  
**System Version:** ENTRIX ERP 1.0.0-pilot  
**Architecture:** React 18 (Vite) + Node.js 20 (Express) + PostgreSQL 16 + Redis 7 + Python FastAPI  
**Date:** 2026-10-26  
**Audience:** Client Evaluators, Solutions Architects, and Deployment Engineers  

---

## 1. Quick-Start Prerequisites & Local Infrastructure

Ensure the following tools are installed:
- **Node.js**: v20.x or higher (`node -v`)
- **Docker & Docker Compose**: v24.x or higher (`docker compose version`)
- **Git**: v2.40 or higher (`git -v`)

### Step 1: Start Infrastructure Containers
In the root repository directory (`d:\E-comm`):
```powershell
docker compose up -d postgres redis
```
*Starts `entrix-postgres` on port `5434` (mapped to container `5432`) and `entrix-redis` on host port `6380` (mapped to container `6379` to prevent conflicts with host Redis instances).*

### Step 2: Database Initialization & Migrations
```powershell
npm --prefix server run db:migrate
```
*Applies all 8 sequential schema migrations (`001_initial_schema` through `008_phase11_enterprise_indexes`).*

### Step 3: Start the Backend API Server
```powershell
# In terminal 1 (server directory):
npm --prefix server run dev
```
*Backend API boots at `http://localhost:5000/api/v1` with Socket.io real-time broadcast and Redis rate limiting.*

### Step 4: Start the Frontend Client
```powershell
# In terminal 2 (client directory):
npm --prefix client run dev
```
*Vite dev server boots at `http://localhost:5173` with reverse proxy forwarding `/api` to port 5000.*

---

## 2. Pre-Seeded Demonstration Accounts (Non-Production Credentials)

All demonstration accounts are seeded via `server/src/db/seeds/index.ts` with bcrypt hash ($2b$10$) and verified against the live PostgreSQL database. The single universal password is: `Admin@123`.

| Persona Name | Email | Role | Accessible Workspaces | Primary Responsibilities |
|---|---|---|---|---|
| **Aditya Admin** | `admin@entrix.local` | `SUPER_ADMIN` | All Modules, Audit, Monetization | System governance, tenant settings, cryptographic audit verification. |
| **Sarah Jenkins** | `hr@entrix.local` | `HR_MANAGER` | HR, Attendance, Procurement, Projects | Personnel onboarding, leave reviews, and department PR approval. |
| **Rajesh Menon** | `finance@entrix.local` | `FINANCE_OFFICER` | Finance, Ledger, Procurement Sign-off | Double-entry journal vouchers, invoice reconciliation, financial approval. |
| **Kavita Rao** | `procurement@entrix.local` | `PROCUREMENT_OFFICER` | Inventory, Procurement, Suppliers, GRN | Stock adjustments, PO creation, vendor selection, goods receipt. |
| **Vikram Mehta** | `staff@entrix.local` | `STAFF_USER` | Dashboard, My Requisitions | Requisition submission, catalog browsing, attendance view. |

> **Persona Switching Mechanism**:  
> The persona switcher in the top-right header (`client/src/context/AuthContext.tsx`) is a demonstration evaluation shortcut that initiates a genuine HTTP `POST /api/v1/auth/login` for the selected account using `Admin@123`.  
> The backend verifies the bcrypt password hash in PostgreSQL and issues a cryptographic HMAC-SHA256 JWT containing `userId`, `tenantId`, `roleId`, and `roleName`. All subsequent frontend requests transmit this bearer token, and all backend route handlers strictly enforce database-backed RBAC permissions. It is **not** a cosmetic or client-only role toggle.

---

## 3. End-to-End Client Demonstration Sequence (5 Minutes)

### Stage 1: Requisition Creation (Staff Persona)
1. Open `http://localhost:5173` and click **Vikram Mehta (Staff User)**.
2. Navigate to **Procurement** (`/procurement`).
3. Click **New Purchase Request**.
4. Select `Solaris 400W Monocrystalline PV Panel`, quantity `10`, justification `Solar assembly line restock`.
5. Click **Submit Requisition**. Status transitions to `PENDING_MANAGER`.

### Stage 2: Requisition Approval (Department Lead Persona)
1. Switch to **Sarah Jenkins (HR / Dept Manager)** in the top-right header.
2. In `/procurement`, observe the pending requisition with notification badge.
3. Click **Approve**.
4. For high-value requisitions ($\ge ₹10,000$), status transitions to `PENDING_FINANCE`.

### Stage 3: Financial Sign-off & Double-Entry Ledger (Finance Persona)
1. Switch to **Rajesh Menon (Finance Officer)**.
2. In `/procurement`, click **Finance Approval** $\to$ status transitions to `APPROVED`.
3. Navigate to **Finance** (`/finance`).
4. Observe the double-entry general ledger:
   - Status badge: **Ledger Balanced (Zero Discrepancy)**.
   - Debits equal Credits ($\Delta = 0.00$).

### Stage 4: Goods Receipt & 3-Way Match (Procurement & Finance)
1. Switch to **Kavita Rao (Procurement Officer)**.
2. In `/procurement`, click **Select Supplier** (`Apex Industrial Supplies Ltd`).
3. Click **Receive Goods (GRN)**:
   - System debits `1510 - Raw Material Inventory` and credits `2015 - GR/IR Clearing Suspense`.
   - Warehouse inventory increments by 10 units.
4. In Supplier Invoices, perform **3-Way Match**:
   - System debits `2015 - GR/IR Clearing Suspense` and credits `2010 - Accounts Payable`.
   - GR/IR clearing balance nets to ₹0.00.
5. Settle Invoice (`POST /api/v1/procurement/invoices/:id/pay`):
   - System debits `2010 - Accounts Payable` and credits `1010 - Operating Cash`.
   - Status transitions to `PAID`. Duplicate payments are rejected with HTTP 409.

### Stage 5: Cryptographic Audit Verification (Super Admin Persona)
1. Switch to **Aditya Admin (Super Admin)**.
2. Navigate to **Audit Logs** (`/audit`).
3. Click **Verify Chain Integrity**:
   - Confirms SHA-256 tamper-evident hash links across all tenant mutations.
   - Confirms passwords, tokens, and secrets are scrubbed (`[REDACTED]`).

---

## 4. Production Build & Quality Verification

Run reproducible verification commands:
```powershell
# 1. Backend TypeScript compile (0 errors):
npm --prefix server run build

# 2. Frontend production assets (0 errors, 119 kB bundle):
npm --prefix client run build

# 3. Complete Adversarial & Cross-Module Suite (multiple files supported via Jest regex matcher):
npm --prefix server test tests/adversarial_verification.test.ts tests/cross_tenant_isolation.test.ts tests/phase7_cross_module.test.ts

# 4. Or run the entire 161-test server suite:
npm --prefix server test
```
*Note on test runner: Jest CLI accepts multiple file paths as space-separated positional arguments, compiling them into a single regex filter (`/(path1|path2)/i`).*

---

## 5. Backup & Disaster Recovery Procedures

To create a point-in-time snapshot of the database:
```powershell
powershell -ExecutionPolicy Bypass -File deploy\scripts\backup.ps1
```
*Generates an uncompressed timestamped SQL dump (`entrix_erp_backup_<TIMESTAMP>.sql`) with SHA-256 checksum in `deploy\backups\`.*

To restore a database snapshot into a target instance:
```powershell
powershell -ExecutionPolicy Bypass -File deploy\scripts\restore.ps1 -BackupPath deploy\backups\entrix_erp_backup_<TIMESTAMP>.sql
```
*Parameter specification: `restore.ps1` accepts mandatory parameter `-BackupPath` and requires uncompressed `.sql` files. Because `restore.ps1` streams text via `Get-Content` directly into container `psql`, compressed `.sql.gz` archives must not be passed.*

---

## 6. Known Product Scope & Transparent Defaults

1. **Monetization & Billing**: Operates in **Sandbox Simulation Mode (₹0 Cost)**. Subscription upgrades, cancellations, and invoices update database state without live payment gateway charges.
2. **AI Demand Intelligence**: Communicates with Python FastAPI service (`entrix-ai:8008`) or engages a deterministic Simple Moving Average (SMA) heuristic fallback. Labeled as an **AI-Enabled Heuristic Prototype**.
3. **Multi-Tenancy**: Complete row-level tenant isolation is enforced on every query and mutation. Missing or contradictory tenant context is strictly rejected with HTTP 403.
