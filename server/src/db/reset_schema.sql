-- ====================================================================
-- ENTRIX ERP - Development Environment Reset Script ONLY
-- WARNING: DESTRUCTIVE! DROPS ALL DATA. NEVER RUN IN PRODUCTION.
-- ====================================================================

DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS ledger_entries CASCADE;
DROP TABLE IF EXISTS goods_received_notes CASCADE;
DROP TABLE IF EXISTS purchase_orders CASCADE;
DROP TABLE IF EXISTS purchase_requests CASCADE;
DROP TABLE IF EXISTS inventory_items CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS refresh_tokens CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS departments CASCADE;
DROP TABLE IF EXISTS schema_migrations CASCADE;
DROP TYPE IF EXISTS pr_status_enum CASCADE;
DROP TYPE IF EXISTS attendance_status_enum CASCADE;
