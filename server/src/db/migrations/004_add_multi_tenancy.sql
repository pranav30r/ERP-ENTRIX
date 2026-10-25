-- ====================================================================
-- ENTRIX ERP - Migration 004: Multi-Tenant Architecture & Data Isolation
-- Engine: PostgreSQL 16.x
-- ====================================================================

-- 1. Create Tenant Status Enum & Tenants Master Table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tenant_status_enum') THEN
        CREATE TYPE tenant_status_enum AS ENUM ('ACTIVE', 'SUSPENDED', 'PENDING');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(128) NOT NULL,
    slug VARCHAR(64) UNIQUE NOT NULL,
    status tenant_status_enum NOT NULL DEFAULT 'ACTIVE',
    plan VARCHAR(32) NOT NULL DEFAULT 'ENTERPRISE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

-- 2. Seed Default Primary Tenant for Existing Legacy Data
INSERT INTO tenants (id, name, slug, status, plan) VALUES
('00000000-0000-0000-0000-000000000001', 'Acme Industrial Corp', 'acme-corp', 'ACTIVE', 'ENTERPRISE')
ON CONFLICT (slug) DO NOTHING;

-- 3. Add Additional Multi-Tenant Roles
INSERT INTO roles (id, name, description, permissions) VALUES
(6, 'COMPANY_ADMIN', 'Full administrative control over company tenant records', '{"all": true, "company_admin": true}'::jsonb),
(7, 'PLATFORM_ADMIN', 'Platform infrastructure supervisor without tenant data access', '{"platform_admin": true}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 4. Multi-Tenant Column Addition & Data Backfill
-- 4.1 Departments
ALTER TABLE departments ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT;
UPDATE departments SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE departments ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_departments_tenant ON departments(tenant_id);
ALTER TABLE departments DROP CONSTRAINT IF EXISTS departments_code_key;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_departments_tenant_code'
    ) THEN
        ALTER TABLE departments ADD CONSTRAINT uq_departments_tenant_code UNIQUE (tenant_id, code);
    END IF;
END $$;

-- 4.2 Users
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT;
UPDATE users SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);

-- 4.3 Employees
ALTER TABLE employees ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT;
UPDATE employees SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE employees ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_employees_tenant ON employees(tenant_id);
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_employee_code_key;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_employees_tenant_code'
    ) THEN
        ALTER TABLE employees ADD CONSTRAINT uq_employees_tenant_code UNIQUE (tenant_id, employee_code);
    END IF;
END $$;

-- 4.4 Inventory Items
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT;
UPDATE inventory_items SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE inventory_items ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_tenant ON inventory_items(tenant_id);
ALTER TABLE inventory_items DROP CONSTRAINT IF EXISTS inventory_items_sku_code_key;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_inventory_tenant_sku'
    ) THEN
        ALTER TABLE inventory_items ADD CONSTRAINT uq_inventory_tenant_sku UNIQUE (tenant_id, sku_code);
    END IF;
END $$;

-- 4.5 Purchase Requests
ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT;
UPDATE purchase_requests SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE purchase_requests ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_requests_tenant ON purchase_requests(tenant_id);

-- 4.6 Purchase Orders
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT;
UPDATE purchase_orders SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE purchase_orders ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_orders_tenant ON purchase_orders(tenant_id);

-- 4.7 Goods Received Notes
ALTER TABLE goods_received_notes ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT;
UPDATE goods_received_notes SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE goods_received_notes ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_grn_tenant ON goods_received_notes(tenant_id);

-- 4.8 Ledger Entries
ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT;
UPDATE ledger_entries SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE ledger_entries ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ledger_tenant ON ledger_entries(tenant_id);

-- 4.9 Audit Logs
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT;
UPDATE audit_logs SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE audit_logs ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_logs(tenant_id);

-- 5. Tenant Invitations Table (Secure Single-Use Onboarding Tokens)
CREATE TABLE IF NOT EXISTS tenant_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    email VARCHAR(255) NOT NULL,
    role_id INT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    token_hash VARCHAR(64) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invitations_tenant ON tenant_invitations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON tenant_invitations(email);
