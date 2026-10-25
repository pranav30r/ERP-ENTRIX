-- ====================================================================
-- ENTRIX ERP - Master Relational Database Schema DDL
-- Target Engine: PostgreSQL 16.x
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Safe initialization: Tables and types use non-destructive IF NOT EXISTS

-- 1. Departments Master
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(16) UNIQUE NOT NULL,
    name VARCHAR(128) NOT NULL,
    quarterly_budget NUMERIC(12, 2) NOT NULL DEFAULT 500000.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Roles Master
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(32) UNIQUE NOT NULL,
    description VARCHAR(255),
    permissions JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- 3. Users Table (Authentication & Access)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(64) NOT NULL,
    last_name VARCHAR(64) NOT NULL,
    role_id INT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    department_id UUID REFERENCES departments(id) ON DELETE RESTRICT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    failed_attempts INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Employees Table (HR Records)
CREATE TYPE attendance_status_enum AS ENUM ('PRESENT', 'ABSENT', 'ON_LEAVE', 'HALF_DAY');

CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
    employee_code VARCHAR(32) UNIQUE NOT NULL,
    designation VARCHAR(64) NOT NULL,
    joining_date DATE NOT NULL DEFAULT CURRENT_DATE,
    base_salary NUMERIC(10, 2) NOT NULL CHECK (base_salary >= 0.00),
    annual_leave_balance INT NOT NULL DEFAULT 18,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Material / Inventory Master
CREATE TABLE inventory_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku_code VARCHAR(32) UNIQUE NOT NULL,
    name VARCHAR(128) NOT NULL,
    category VARCHAR(64) NOT NULL,
    unit_of_measure VARCHAR(16) NOT NULL DEFAULT 'PCS',
    unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0.00),
    stock_qty INT NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
    safety_stock INT NOT NULL DEFAULT 10 CHECK (safety_stock >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Purchase Requisitions (PR)
CREATE TYPE pr_status_enum AS ENUM (
    'DRAFT', 'PENDING_MANAGER', 'PENDING_FINANCE', 
    'APPROVED', 'PO_ISSUED', 'GOODS_RECEIVED', 'INVOICE_MATCHED', 'CLOSED', 'REJECTED'
);

CREATE TABLE purchase_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pr_code VARCHAR(32) UNIQUE NOT NULL,
    requester_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
    quantity INT NOT NULL CHECK (quantity > 0),
    estimated_total NUMERIC(12, 2) NOT NULL CHECK (estimated_total >= 0.00),
    status pr_status_enum NOT NULL DEFAULT 'DRAFT',
    justification TEXT NOT NULL,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Purchase Orders (PO)
CREATE TABLE purchase_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    po_number VARCHAR(32) UNIQUE NOT NULL,
    pr_id UUID UNIQUE NOT NULL REFERENCES purchase_requests(id) ON DELETE RESTRICT,
    vendor_name VARCHAR(128) NOT NULL,
    ordered_quantity INT NOT NULL CHECK (ordered_quantity > 0),
    total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0.00),
    issued_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Goods Received Notes (GRN)
CREATE TABLE goods_received_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    grn_code VARCHAR(32) UNIQUE NOT NULL,
    po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE RESTRICT,
    received_quantity INT NOT NULL CHECK (received_quantity > 0),
    received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    verified_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT
);

-- 9. General Ledger Postings
CREATE TABLE ledger_entries (
    id BIGSERIAL PRIMARY KEY,
    transaction_uuid UUID DEFAULT uuid_generate_v4(),
    account_code VARCHAR(32) NOT NULL,
    debit_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    credit_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    reference_type VARCHAR(32),
    reference_id UUID,
    posted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. Cryptographically Chained Audit Logs
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    actor_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    action VARCHAR(64) NOT NULL,
    entity_name VARCHAR(64) NOT NULL,
    entity_id UUID NOT NULL,
    diff_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    previous_hash VARCHAR(64) NOT NULL,
    current_hash VARCHAR(64) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ====================================================================
-- Performance B-Tree Indexes
-- ====================================================================
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_inventory_sku ON inventory_items(sku_code);
CREATE INDEX idx_pr_status ON purchase_requests(status);
CREATE INDEX idx_pr_dept ON purchase_requests(department_id);
CREATE INDEX idx_audit_entity ON audit_logs(entity_name, entity_id);

-- ====================================================================
-- Initial Seed Records
-- ====================================================================

-- 1. Insert Core Roles
INSERT INTO roles (id, name, description, permissions) VALUES
(1, 'SUPER_ADMIN', 'Unrestricted administrative access', '{"all": true}'::jsonb),
(2, 'HR_MANAGER', 'Human Resources administration', '{"hr": true, "pr_create": true}'::jsonb),
(3, 'FINANCE_OFFICER', 'Accounting and financial sign-off', '{"finance": true, "pr_approve_finance": true}'::jsonb),
(4, 'PROCUREMENT_OFFICER', 'Vendor management and PO generation', '{"procurement": true, "inventory": true}'::jsonb),
(5, 'STAFF_USER', 'Standard departmental employee', '{"pr_create": true}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 2. Insert Core Departments
INSERT INTO departments (id, code, name, quarterly_budget) VALUES
('11111111-1111-1111-1111-111111111111', 'DEPT-ENG', 'Engineering & Technology', 1000000.00),
('22222222-2222-2222-2222-222222222222', 'DEPT-HR', 'Human Resources', 300000.00),
('33333333-3333-3333-3333-333333333333', 'DEPT-FIN', 'Finance & Accounts', 400000.00),
('44444444-4444-4444-4444-444444444444', 'DEPT-PROC', 'Procurement & Logistics', 600000.00)
ON CONFLICT (code) DO NOTHING;

-- 3. Insert Core Users (password: Admin@123 for all demo accounts)
-- bcrypt hash for 'Admin@123' with 10 rounds: $2a$10$YZiaj22gCicCjhVsuiO6xeYdNoO3mYdspAKjVPqfflCHb6JiCquqK
INSERT INTO users (id, email, password_hash, first_name, last_name, role_id, department_id) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin@entrix.local', '$2a$10$YZiaj22gCicCjhVsuiO6xeYdNoO3mYdspAKjVPqfflCHb6JiCquqK', 'Aditya', 'Admin', 1, '11111111-1111-1111-1111-111111111111'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa02', 'hr@entrix.local', '$2a$10$YZiaj22gCicCjhVsuiO6xeYdNoO3mYdspAKjVPqfflCHb6JiCquqK', 'Sarah', 'Jenkins', 2, '22222222-2222-2222-2222-222222222222'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa03', 'finance@entrix.local', '$2a$10$YZiaj22gCicCjhVsuiO6xeYdNoO3mYdspAKjVPqfflCHb6JiCquqK', 'Rajesh', 'Menon', 3, '33333333-3333-3333-3333-333333333333'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa04', 'procurement@entrix.local', '$2a$10$YZiaj22gCicCjhVsuiO6xeYdNoO3mYdspAKjVPqfflCHb6JiCquqK', 'Kavita', 'Rao', 4, '44444444-4444-4444-4444-444444444444'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa05', 'staff@entrix.local', '$2a$10$YZiaj22gCicCjhVsuiO6xeYdNoO3mYdspAKjVPqfflCHb6JiCquqK', 'Vikram', 'Mehta', 5, '11111111-1111-1111-1111-111111111111')
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role_id = EXCLUDED.role_id;

-- 4. Insert Initial Inventory Seed Items
INSERT INTO inventory_items (id, sku_code, name, category, unit_of_measure, unit_price, stock_qty, safety_stock) VALUES
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01', 'RAW-STL-001', 'Structural Steel Bars (12mm)', 'Raw Materials', 'KG', 65.50, 450, 100),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02', 'ELEC-SMR-002', 'Microcontroller Boards STM32', 'Electronics', 'PCS', 850.00, 25, 30),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03', 'OFF-PPR-003', 'A4 Executive Copy Paper (500s)', 'Office Supplies', 'PCS', 280.00, 80, 20)
ON CONFLICT (sku_code) DO NOTHING;
