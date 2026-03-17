-- MAAUN School Complaint & Feedback Management System
-- Database Initialization Script
-- Maryam Abacha American University Nigeria

CREATE DATABASE IF NOT EXISTS maaun_complaints;
USE maaun_complaints;

-- ============================================
-- Users table
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    matric_number VARCHAR(50) UNIQUE,
    department VARCHAR(255),
    role ENUM('student', 'staff', 'admin', 'management', 'auditor', 'maintenance_officer') NOT NULL DEFAULT 'student',
    is_active INT NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_users_email (email),
    INDEX idx_users_matric (matric_number),
    INDEX idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- Complaints table
-- ============================================
CREATE TABLE IF NOT EXISTS complaints (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_number VARCHAR(20) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category ENUM(
        'academic', 'facilities', 'hostel', 'class', 'auditorium', 'security', 'finance',
        'library', 'transport', 'cafeteria', 'ict', 'other'
    ) NOT NULL,
    feedback_type ENUM('complaint', 'suggestion', 'commendation') NOT NULL DEFAULT 'complaint',
    status ENUM('pending', 'assigned_to_auditor', 'audited', 'assigned_to_maintenance', 'maintenance_in_progress', 'pending_approval', 'approved', 'repair_completed', 'final_audit', 'resolved', 'rejected') NOT NULL DEFAULT 'pending',
    priority INT NOT NULL DEFAULT 1,
    submitter_id INT NOT NULL,
    assigned_to_id INT,
    department VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    audit_feedback TEXT,
    maintenance_report TEXT,
    invoice_amount INT,
    invoice_notes TEXT,
    INDEX idx_complaints_ticket (ticket_number),
    INDEX idx_complaints_submitter (submitter_id),
    INDEX idx_complaints_assigned (assigned_to_id),
    INDEX idx_complaints_status (status),
    INDEX idx_complaints_category (category),
    INDEX idx_complaints_created (created_at),
    FOREIGN KEY (submitter_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- Invoice Items table (detailed invoice line items)
-- ============================================
CREATE TABLE IF NOT EXISTS invoice_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    complaint_id INT NOT NULL,
    item VARCHAR(255) NOT NULL,
    cost INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    INDEX idx_invoice_items_complaint (complaint_id),
    FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- Complaint Attachments table (proof images)
-- ============================================
CREATE TABLE IF NOT EXISTS complaint_attachments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    complaint_id INT NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_attachments_complaint (complaint_id),
    FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- Notifications table
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    link VARCHAR(500),
    complaint_id INT,
    is_read INT NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_notifications_user (user_id),
    INDEX idx_notifications_read (is_read),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- Responses table
-- ============================================
CREATE TABLE IF NOT EXISTS responses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    complaint_id INT NOT NULL,
    responder_id INT NOT NULL,
    message TEXT NOT NULL,
    is_internal INT NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_responses_complaint (complaint_id),
    INDEX idx_responses_responder (responder_id),
    FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
    FOREIGN KEY (responder_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
