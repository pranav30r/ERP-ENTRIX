-- ====================================================================
-- ENTRIX ERP - Migration 003: Integrity Safeguards & Performance Indexes
-- ====================================================================

-- 1. Performance Indexes for Foreign Keys and Lookups
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_department_id ON users(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);
CREATE INDEX IF NOT EXISTS idx_po_pr_id ON purchase_orders(pr_id);
CREATE INDEX IF NOT EXISTS idx_grn_po_id ON goods_received_notes(po_id);
CREATE INDEX IF NOT EXISTS idx_ledger_tx_uuid ON ledger_entries(transaction_uuid);
CREATE INDEX IF NOT EXISTS idx_ledger_account_code ON ledger_entries(account_code);

-- 2. Domain Data Integrity Constraints (Safe addition if not already present)
DO $$
BEGIN
    -- Ensure inventory items have non-negative unit price and safety stock
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_inventory_unit_price'
    ) THEN
        ALTER TABLE inventory_items 
        ADD CONSTRAINT chk_inventory_unit_price CHECK (unit_price >= 0.00);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_inventory_safety_stock'
    ) THEN
        ALTER TABLE inventory_items 
        ADD CONSTRAINT chk_inventory_safety_stock CHECK (safety_stock >= 0);
    END IF;

    -- Ensure ledger amounts are non-negative
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_ledger_amounts'
    ) THEN
        ALTER TABLE ledger_entries 
        ADD CONSTRAINT chk_ledger_amounts CHECK (debit_amount >= 0.00 AND credit_amount >= 0.00);
    END IF;
END $$;
