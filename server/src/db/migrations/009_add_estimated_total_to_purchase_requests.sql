-- ====================================================================
-- ENTRIX ERP - Migration 009: Add estimated_total & sync PurchaseRequest
-- Engine: PostgreSQL 16.x
-- ====================================================================

-- 1. Ensure pr_status_enum contains all modern workflow states
DO $$
BEGIN
    ALTER TYPE pr_status_enum ADD VALUE IF NOT EXISTS 'PENDING_MANAGER';
    ALTER TYPE pr_status_enum ADD VALUE IF NOT EXISTS 'PENDING_FINANCE';
    ALTER TYPE pr_status_enum ADD VALUE IF NOT EXISTS 'PO_ISSUED';
    ALTER TYPE pr_status_enum ADD VALUE IF NOT EXISTS 'GOODS_RECEIVED';
    ALTER TYPE pr_status_enum ADD VALUE IF NOT EXISTS 'INVOICE_MATCHED';
    ALTER TYPE pr_status_enum ADD VALUE IF NOT EXISTS 'CLOSED';
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 2. Add estimated_total column to purchase_requests (DECIMAL(12,2) matching model)
ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS estimated_total DECIMAL(12, 2);

-- 3. Backfill estimated_total from existing item quantity * unit_price, or estimated_cost if present
DO $$
BEGIN
    -- Check if estimated_cost column exists in this database
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'purchase_requests' AND column_name = 'estimated_cost'
    ) THEN
        UPDATE purchase_requests 
        SET estimated_total = COALESCE(estimated_cost, 0.00) 
        WHERE estimated_total IS NULL;

        -- Drop the NOT NULL constraint on estimated_cost so inserts using estimated_total succeed
        ALTER TABLE purchase_requests ALTER COLUMN estimated_cost DROP NOT NULL;
    END IF;

    -- Backfill from inventory_items if still null or zero
    UPDATE purchase_requests pr
    SET estimated_total = pr.quantity * COALESCE(i.unit_price, 0.00)
    FROM inventory_items i
    WHERE pr.item_id = i.id AND (pr.estimated_total IS NULL OR pr.estimated_total = 0.00);

    -- Ensure fallback 0.00 for any orphans
    UPDATE purchase_requests SET estimated_total = 0.00 WHERE estimated_total IS NULL;
END $$;

-- 4. Enforce NOT NULL and CHECK constraints matching model
ALTER TABLE purchase_requests ALTER COLUMN estimated_total SET DEFAULT 0.00;
ALTER TABLE purchase_requests ALTER COLUMN estimated_total SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'purchase_requests_estimated_total_check'
    ) THEN
        ALTER TABLE purchase_requests ADD CONSTRAINT purchase_requests_estimated_total_check CHECK (estimated_total >= 0.00);
    END IF;
END $$;

-- 5. Add rejection_reason if missing from initial schema
ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
