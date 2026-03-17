-- Migration: Add new roles, workflow columns, and complaint_attachments table.
-- Prefer running: python -m scripts.migrate_db (handles existing data safely)
USE maaun_complaints;

-- 1. Create complaint_attachments table
CREATE TABLE IF NOT EXISTS complaint_attachments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    complaint_id INT NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_attachments_complaint (complaint_id),
    FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Add workflow columns (ignore error if they exist)
ALTER TABLE complaints ADD COLUMN audit_feedback TEXT;
ALTER TABLE complaints ADD COLUMN maintenance_report TEXT;
ALTER TABLE complaints ADD COLUMN invoice_amount INT;
ALTER TABLE complaints ADD COLUMN invoice_notes TEXT;

-- 3. Update enums
ALTER TABLE users MODIFY role ENUM('student', 'staff', 'admin', 'management', 'auditor', 'maintenance_officer') NOT NULL DEFAULT 'student';

-- 4. Migrate in_progress -> maintenance_in_progress, then update status enum
UPDATE complaints SET status='maintenance_in_progress' WHERE status='in_progress';
ALTER TABLE complaints MODIFY status ENUM('pending', 'assigned_to_auditor', 'audited', 'assigned_to_maintenance', 'maintenance_in_progress', 'pending_approval', 'approved', 'repair_completed', 'final_audit', 'resolved', 'rejected') NOT NULL DEFAULT 'pending';

-- 5. Update category enum to include class and auditorium
ALTER TABLE complaints MODIFY category ENUM('academic', 'facilities', 'hostel', 'class', 'auditorium', 'security', 'finance', 'library', 'transport', 'cafeteria', 'ict', 'other') NOT NULL;
