-- ====================================================================
-- ENTRIX ERP - Migration 006: Commercial SaaS Billing & Subscription Architecture
-- Engine: PostgreSQL 16.x
-- ====================================================================

-- 1. Create Subscriptions Master Table
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plan_tier VARCHAR(32) NOT NULL DEFAULT 'STARTER',
    status VARCHAR(32) NOT NULL DEFAULT 'TRIALING',
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days'),
    trial_ends_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '14 days'),
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    canceled_at TIMESTAMP WITH TIME ZONE,
    billing_customer_id VARCHAR(128),
    billing_subscription_id VARCHAR(128),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_subscriptions_tenant UNIQUE (tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- 2. Create Subscription Audit & Lifecycle History Table
CREATE TABLE IF NOT EXISTS subscription_history (
    id BIGSERIAL PRIMARY KEY,
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    from_status VARCHAR(32),
    to_status VARCHAR(32) NOT NULL,
    from_plan VARCHAR(32),
    to_plan VARCHAR(32) NOT NULL,
    reason VARCHAR(255),
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sub_history_tenant ON subscription_history(tenant_id);

-- 3. Create Tenant Usage Counters Table
CREATE TABLE IF NOT EXISTS tenant_usage_counters (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    metric_name VARCHAR(64) NOT NULL,
    current_value BIGINT NOT NULL DEFAULT 0,
    period_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days'),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_usage_metric_period UNIQUE (tenant_id, metric_name, period_start)
);

CREATE INDEX IF NOT EXISTS idx_usage_tenant ON tenant_usage_counters(tenant_id);

-- 4. Create Subscription Invoices Table (SaaS Monetization - Distinct from ERP Ledger)
CREATE TABLE IF NOT EXISTS subscription_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    invoice_number VARCHAR(64) UNIQUE NOT NULL,
    amount_due NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    amount_paid NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(8) NOT NULL DEFAULT 'INR',
    status VARCHAR(32) NOT NULL DEFAULT 'PAID',
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    hosted_invoice_url VARCHAR(255),
    pdf_download_url VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON subscription_invoices(tenant_id);

-- 5. Backfill Initial Subscriptions for Existing Legacy Tenants
INSERT INTO subscriptions (tenant_id, plan_tier, status, current_period_start, current_period_end, trial_ends_at)
SELECT id, 'ENTERPRISE', 'ACTIVE', NOW(), NOW() + INTERVAL '365 days', NULL
FROM tenants
WHERE id NOT IN (SELECT tenant_id FROM subscriptions)
ON CONFLICT (tenant_id) DO NOTHING;

-- Seed default initial invoice for legacy demo tenant
INSERT INTO subscription_invoices (
    tenant_id, invoice_number, amount_due, amount_paid, currency, status, period_start, period_end, hosted_invoice_url
)
SELECT 
    '00000000-0000-0000-0000-000000000001',
    'INV-ENTRIX-2026-0001',
    39999.00,
    39999.00,
    'INR',
    'PAID',
    NOW() - INTERVAL '30 days',
    NOW(),
    'https://billing.entrix-erp.local/invoices/INV-ENTRIX-2026-0001'
WHERE EXISTS (SELECT 1 FROM tenants WHERE id = '00000000-0000-0000-0000-000000000001')
ON CONFLICT (invoice_number) DO NOTHING;
