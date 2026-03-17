-- Add invoice_items table for detailed invoices (item, cost, quantity)
USE maaun_complaints;

CREATE TABLE IF NOT EXISTS invoice_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    complaint_id INT NOT NULL,
    item VARCHAR(255) NOT NULL,
    cost INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    INDEX idx_invoice_items_complaint (complaint_id),
    FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
