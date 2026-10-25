-- ====================================================================
-- ENTRIX ERP - Migration 008: Enterprise High-Scale Performance Indexes
-- Engine: PostgreSQL 16.x
-- Description: Composite multi-tenant indexes for accelerating tenant-scoped
-- queries, audit verification, and high-concurrency ledger operations.
-- ====================================================================

-- 1. Multi-Tenant Audit & Compliance Composite Indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_timestamp 
    ON audit_logs (tenant_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_entity 
    ON audit_logs (tenant_id, entity_name, entity_id);

-- 2. HR & Attendance Scalability Indexes
CREATE INDEX IF NOT EXISTS idx_attendance_tenant_date 
    ON attendance_records (tenant_id, date);

CREATE INDEX IF NOT EXISTS idx_employees_tenant_code 
    ON employees (tenant_id, employee_code);

-- 3. Operations & Project Milestone Burndown Indexes
CREATE INDEX IF NOT EXISTS idx_projects_tenant_status 
    ON projects (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_projects_tenant_dept 
    ON projects (tenant_id, department_code);

-- 4. Supply Chain & Inventory Performance Indexes
CREATE INDEX IF NOT EXISTS idx_inv_movements_tenant_created 
    ON inventory_movements (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_purchase_requests_tenant_status 
    ON purchase_requests (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_inventory_items_tenant_cat 
    ON inventory_items (tenant_id, category);

-- 5. Financial Ledger & Double-Entry Query Optimization
CREATE INDEX IF NOT EXISTS idx_ledger_tenant_posted 
    ON ledger_entries (tenant_id, posted_at DESC);

-- 6. User Membership & Entitlement Performance
CREATE INDEX IF NOT EXISTS idx_users_tenant_active 
    ON users (tenant_id, is_active);
