-- ====================================================================
-- ENTRIX ERP - Migration 005: Attendance Records & Personnel Tracking
-- Engine: PostgreSQL 16.x
-- ====================================================================

CREATE TABLE IF NOT EXISTS attendance_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES tenants(id) ON DELETE RESTRICT,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status attendance_status_enum NOT NULL DEFAULT 'PRESENT',
    check_in_time TIME DEFAULT '09:00:00',
    check_out_time TIME DEFAULT '18:00:00',
    notes VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_attendance_tenant ON attendance_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(date);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_attendance_employee_date'
    ) THEN
        ALTER TABLE attendance_records ADD CONSTRAINT uq_attendance_employee_date UNIQUE (tenant_id, employee_id, date);
    END IF;
END $$;
