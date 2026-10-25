-- 007_phase7_enterprise_models.sql
-- Enterprise ERP completeness: Suppliers, 3-Way Invoicing, Inventory Movements, Leave Requests, Projects & Tasks

-- 1. Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    code VARCHAR(32) NOT NULL,
    name VARCHAR(128) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(32),
    payment_terms VARCHAR(64) DEFAULT 'NET30',
    rating NUMERIC(3, 2) DEFAULT 5.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_suppliers_tenant_code UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_suppliers_tenant ON suppliers(tenant_id);

-- 2. Supplier Invoices (for 3-Way Matching)
CREATE TABLE IF NOT EXISTS supplier_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    invoice_number VARCHAR(64) NOT NULL,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE RESTRICT,
    po_id UUID REFERENCES purchase_orders(id) ON DELETE RESTRICT,
    grn_id UUID REFERENCES goods_received_notes(id) ON DELETE RESTRICT,
    billed_quantity INT NOT NULL,
    invoice_amount NUMERIC(12, 2) NOT NULL,
    status VARCHAR(32) DEFAULT 'PENDING_MATCH' NOT NULL, -- PENDING_MATCH, MATCHED, DISCREPANCY, PAID
    discrepancy_notes TEXT,
    matched_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_supplier_invoices_tenant_num UNIQUE (tenant_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_supplier_invoices_tenant ON supplier_invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_po ON supplier_invoices(po_id);

-- 3. Inventory Movement Ledger
CREATE TABLE IF NOT EXISTS inventory_movements (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
    movement_type VARCHAR(32) NOT NULL, -- IN, OUT, ADJUSTMENT, TRANSFER, RESERVED
    quantity INT NOT NULL,
    previous_stock INT NOT NULL,
    new_stock INT NOT NULL,
    reference_type VARCHAR(64), -- GRN_RECEIPT, STOCK_ADJUSTMENT, INVOICE_FULFILLMENT
    reference_id UUID,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_tenant_item ON inventory_movements(tenant_id, item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_ref ON inventory_movements(reference_type, reference_id);

-- 4. Leave Requests
CREATE TABLE IF NOT EXISTS leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    leave_type VARCHAR(32) DEFAULT 'ANNUAL' NOT NULL, -- ANNUAL, SICK, UNPAID, CASUAL
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days_count INT NOT NULL DEFAULT 1,
    reason TEXT NOT NULL,
    status VARCHAR(32) DEFAULT 'PENDING' NOT NULL, -- PENDING, APPROVED, REJECTED
    reviewed_by UUID REFERENCES users(id) ON DELETE RESTRICT,
    rejection_reason TEXT,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_tenant_emp ON leave_requests(tenant_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);

-- 5. Projects & Project Tasks
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    code VARCHAR(32) NOT NULL,
    name VARCHAR(128) NOT NULL,
    department_code VARCHAR(32) DEFAULT 'DEPT-ENG',
    allocated_budget NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    consumed_budget NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    milestones_total INT NOT NULL DEFAULT 5,
    milestones_completed INT NOT NULL DEFAULT 0,
    logged_hours INT NOT NULL DEFAULT 0,
    estimated_hours INT NOT NULL DEFAULT 100,
    status VARCHAR(32) NOT NULL DEFAULT 'PLANNING', -- PLANNING, IN_PROGRESS, COMPLETED, ON_HOLD
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_projects_tenant_code UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_projects_tenant ON projects(tenant_id);

CREATE TABLE IF NOT EXISTS project_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(128) NOT NULL,
    assigned_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    estimated_hours INT DEFAULT 8,
    status VARCHAR(32) DEFAULT 'TODO', -- TODO, IN_PROGRESS, DONE
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_tasks_tenant_user ON project_tasks(tenant_id, assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_project ON project_tasks(project_id);
