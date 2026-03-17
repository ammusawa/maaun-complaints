-- Quick fix: Add missing workflow columns to complaints table
-- Run: mysql -u root -p maaun_complaints < database/add_workflow_columns.sql

USE maaun_complaints;

ALTER TABLE complaints ADD COLUMN audit_feedback TEXT;
ALTER TABLE complaints ADD COLUMN maintenance_report TEXT;
ALTER TABLE complaints ADD COLUMN invoice_amount INT;
ALTER TABLE complaints ADD COLUMN invoice_notes TEXT;
