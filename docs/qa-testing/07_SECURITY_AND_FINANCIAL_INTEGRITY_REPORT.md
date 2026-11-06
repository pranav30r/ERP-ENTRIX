# ENTRIX ERP — Security & Financial Integrity Audit Report

**Document Reference:** `ENTRIX-QA-SEC-FIN-V1.0`  
**Execution Timestamp:** 2026-11-07T00:41:00+05:30  
**Status:** **VERIFIED & SECURE**

---

## 1. Security Architecture & Threat Defenses

| Security Layer | Defense Mechanism | Implementation Details | Verified Status |
| :--- | :--- | :--- | :---: |
| **Password Hashing** | Bcrypt (10 salt rounds) | Enforced on all user registrations and password resets | **PASS** |
| **Brute-Force Protection** | Account Lockout Policy | Locks account for 15 minutes after 5 consecutive failed attempts (`locked_until`) | **PASS** |
| **Session & Tokens** | Short-lived JWT + Refresh | 15-minute access token + 7-day refresh token stored in PostgreSQL | **PASS** |
| **Tenant Isolation** | Multi-Tenant Scoping | Middleware `requireTenant` validates JWT `tenant_id` against route payload | **PASS** |
| **IDOR Prevention** | Tenant-Scoped ORM Queries | `WHERE tenant_id = :tenant_id` applied to all select, update, and delete queries | **PASS** |
| **SQL Injection** | Parameterized Queries | Sequelize ORM parameter binding across all database interactions | **PASS** |
| **XSS & Headers** | Helmet Middleware | Strict Content-Security-Policy (CSP), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` | **PASS** |
| **Rate Limiting** | Express-Rate-Limit + Redis | 100 reqs/15m for API; 10 reqs/15m for `/auth/login` | **PASS** |
| **Audit Immutability** | Cryptographic SHA-256 Chaining | Every audit entry hashes `timestamp + user + action + previous_hash` | **PASS** |

---

## 2. Empirical Financial Integrity Verification

### General Ledger Balance Verification
- **PostgreSQL Database Target**: `entrix-postgres:5432` (`entrix_erp`)
- **Direct Query Executed**:
  ```sql
  SELECT 
    SUM(debit_amount) AS total_debits, 
    SUM(credit_amount) AS total_credits, 
    (SUM(debit_amount) - SUM(credit_amount)) AS diff, 
    COUNT(*) AS total_rows 
  FROM ledger_entries;
  ```
- **Live Output**:
  ```
   total_debits | total_credits | diff | total_rows 
  --------------+---------------+------+------------
     3842300.00 |    3842300.00 | 0.00 |        426
  (1 row)
  ```
- **Auditor Verification**:
  - $\sum \text{Debits} = ₹3,842,300.00$
  - $\sum \text{Credits} = ₹3,842,300.00$
  - $\Delta \equiv \text{₹0.00}$ (Zero imbalance across 426 ledger rows).
  - Check constraint `chk_ledger_amounts` enforces `debit_amount >= 0.00 AND credit_amount >= 0.00`.

---

## 3. Financial Transaction Invariants

1. **Atomic Posting**: All debit and credit pairs are written within an explicit `sequelize.transaction()`. If any leg fails, the entire transaction rolls back cleanly, leaving zero orphaned entries.
2. **Duplicate Payment Prevention**: In `procurementController.ts`, invoice status is inspected under pessimistic transaction lock. If already marked `PAID`, the request aborts with **HTTP 409 Conflict**, preventing duplicate payouts.
3. **Three-Way Matching Tolerance**:
   - $\vert \text{Invoice Total} - (\text{GRN Qty} \times \text{PO Unit Price}) \vert / (\text{GRN Qty} \times \text{PO Unit Price}) \le 0.01$
   - Invoices exceeding $1.0\%$ variance are flagged as `VARIANCE_DETECTED` and cannot be settled without managerial override.
4. **Stock Deduction Serialization**:
   - Stock adjustments utilize `Transaction.ISOLATION_LEVELS.READ_COMMITTED` with `lock: Transaction.LOCK.UPDATE`.
   - Concurrent updates cannot cause negative stock or lost deductions.
