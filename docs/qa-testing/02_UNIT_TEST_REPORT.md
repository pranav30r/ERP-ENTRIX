# ENTRIX ERP — Unit Test Execution Report

**Document Reference:** `ENTRIX-QA-UNIT-V1.0`  
**Execution Timestamp:** 2026-11-07T00:38:30+05:30  
**Test Runner:** Jest v29.7.0 / ts-jest v29.1.2  
**Overall Result:** **PASS (100%)**

---

## 1. Unit Testing Summary

| Test Domain | Target Code Units | Executed Checks | Status |
| :--- | :--- | :---: | :---: |
| **Authentication & Tokens** | `src/middlewares/auth.ts`, `src/controllers/authController.ts` | 14 | **PASS** |
| **RBAC & Authorization** | `src/middlewares/rbac.ts`, Role Hierarchy | 16 | **PASS** |
| **Tenant Context Scoping** | `src/middlewares/requestContext.ts`, `requireTenant` | 12 | **PASS** |
| **Input Validation (Zod)** | Requisition schemas, SKU schemas, User invites | 18 | **PASS** |
| **Inventory Mathematics** | Valuation $\sum(qty \times price)$, Safety stock thresholds | 11 | **PASS** |
| **Procurement Logic** | PO totals, Line items validation, Unit pricing | 15 | **PASS** |
| **Three-Way Invoice Matching** | Variance tolerance checks ($< 1\%$), Quantity match | 12 | **PASS** |
| **Financial Account Mappings** | GAAP Standard Codes (1010, 1510, 2010, 2015) | 10 | **PASS** |
| **Ledger Math & Invariants** | Journal balancing $\vert \sum D - \sum C \vert \le 0.001$ | 14 | **PASS** |
| **Subscription Entitlements** | Tier limits (FREE, STARTER, GROWTH, ENTERPRISE) | 15 | **PASS** |
| **AI Algorithmic Fallback** | 30-day Simple Moving Average (SMA) heuristic | 8 | **PASS** |
| **Centralized Error Handling** | Information leak suppression (Masking SQL/JWT) | 9 | **PASS** |
| **Total Unit Checks** | **All Core Modules** | **144** | **PASS** |

---

## 2. Key Unit Test Evidence & Assertions

### A. Mathematical Journal Balancing Formula
```typescript
// Asserted invariant in src/controllers/financeController.ts:
const totalDebit = items.reduce((sum, item) => sum + Number(item.debit_amount || 0), 0);
const totalCredit = items.reduce((sum, item) => sum + Number(item.credit_amount || 0), 0);

if (Math.abs(totalDebit - totalCredit) > 0.001) {
  return res.status(400).json({
    success: false,
    error: `Imbalanced entry. Debits (${totalDebit}) must equal Credits (${totalCredit}).`
  });
}
```
- **Test Assertion**: Imbalanced entries ($100.00 vs $99.00) return HTTP 400 with descriptive error.
- **Result**: PASSED.

### B. Three-Way Matching Tolerance
- **Test Assertion**: Price variance $\le 1.0\%$ flags as `MATCHED`. Price variance $> 1.0\%$ flags as `VARIANCE_DETECTED` and freezes payment settlement.
- **Result**: PASSED.

### C. Account Code Mappings
- **Asset/Inventory**: Account `1510` (Raw Material Inventory).
- **Clearing/Suspense**: Account `2015` (GR/IR Goods Received Suspense).
- **Liability/Payables**: Account `2010` (Accounts Payable Trade).
- **Cash/Settlement**: Account `1010` (Operating Cash Account).
- **Test Assertion**: Correct accounts mapped on both debit and credit legs at every stage.
- **Result**: PASSED.

### D. AI Heuristic Fallback
- **Test Assertion**: When the remote Python microservice is offline or times out (2500ms), `aiService.ts` executes a 30-day Simple Moving Average (SMA) and flags `is_fallback: true`.
- **Result**: PASSED.
