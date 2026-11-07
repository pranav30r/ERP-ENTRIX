# ENTRIX ERP — Full ERP Business Workflow Verification (Stage 7)

**Audit Date:** 2026-10-26  
**Auditor:** ERP Domain Expert & Enterprise QA Automation Lead  
**Scope:** Systematic inspection and execution of all 7 core operational ERP business workflows.

---

## 1. Procurement-to-Payment Workflow

### Supported Workflow State Machine:
$$\text{DRAFT} \longrightarrow \text{PENDING\_MANAGER} \longrightarrow \begin{cases} \text{APPROVED} & (\text{Value} < ₹10\text{k}) \\ \text{PENDING\_FINANCE} \longrightarrow \text{APPROVED} & (\text{Value} \ge ₹10\text{k}) \end{cases}$$
$$\text{APPROVED} \longrightarrow \text{PO\_ISSUED} \longrightarrow \text{GOODS\_RECEIVED} \longrightarrow \text{INVOICE\_MATCHED} \longrightarrow \text{CLOSED}$$

### Verification Findings:
1. **Branching Approvals**:
   - Requisition $< ₹10,000$ auto-advances directly to `APPROVED` upon Department Manager sign-off.
   - Requisition $\ge ₹10,000$ transitions to `PENDING_FINANCE` and requires secondary Finance Officer approval.
2. **Supplier Assignment**:
   - Procurement Officer selects a registered supplier from `suppliers`.
   - Generates unique `PurchaseOrder` with `po_number` format `PO-2026-XXXXX`.
3. **Goods Receipt (GRN)**:
   - Verifier checks goods received; generates `GoodsReceivedNote` (`GRN-2026-XXXXX`).
   - Atomically increments physical stock in `inventory_items` and records `inventory_movements`.
4. **Three-Way Matching**:
   - Compares PO ordered quantity & total vs GRN received quantity vs Supplier Invoice billed amount.
   - Discrepancy threshold: $1\%$ tolerance.
   - On match: transitions PR to `INVOICE_MATCHED` and posts balanced General Ledger entries.

---

## 2. Human Resources (HR) Workflows

1. **Compensation Privacy**: Non-HR staff users querying `GET /api/v1/hr/employees` have `base_salary` automatically stripped from JSON responses.
2. **Attendance Management**: Daily check-ins persist to `attendance_records` with status (`PRESENT`, `ABSENT`, `ON_LEAVE`, `HALF_DAY`). Duplicate check-ins for the same employee on the same date are rejected by composite unique constraint.
3. **Leave Processing**:
   - Employee submits leave request with start date, end date, and reason.
   - On HR approval, the system acquires a row-level lock on `Employee` and decrements `annual_leave_balance`.
   - Insufficient leave balance is blocked with HTTP 400.

---

## 3. Projects & Resource Management Workflows

1. **PostgreSQL Persistence**: Projects and tasks are fully persisted in PostgreSQL (`projects` and `project_tasks` tables).
2. **Resource Conflict Detection**:
   - When assigning a task to an engineer with specific start/end dates, the controller queries existing active tasks (`TODO`, `IN_PROGRESS`) for that user.
   - If an overlapping active task exists, the system flags an explicit warning in the response payload (`Resource conflict: User X is already allocated to N task(s) during this period`).
3. **Milestone Progression**: Advancing milestones updates `milestones_completed`, increments `logged_hours` and `consumed_budget`, and auto-transitions project status to `COMPLETED` when all milestones are finished.

---

## 4. Executive Analytics & Dashboard Telemetry

1. **Catalog SKUs & Valuations**: Calculated dynamically from `inventory_items` by aggregating `stock_qty * unit_price`. Zero hardcoded numbers.
2. **Procurement Pipeline Widget**: Fetches live requisitions and stages dynamically from `purchase_requests`.
3. **Real-Time WebSockets**: Socket.IO events (`pr_status_changed`, `inventory_updated`, `grn_received`) broadcast to tenant-isolated rooms (`tenant:{tenantId}`).
