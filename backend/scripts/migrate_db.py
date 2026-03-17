"""Migrate database to add workflow columns and tables. Run: python -m scripts.migrate_db
   Safe to run multiple times - skips steps that already exist."""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.database import engine


def run_sql(conn, sql: str, ignore_duplicate=True) -> bool:
    """Run SQL, return True if ok. If ignore_duplicate, swallow 'already exists' errors."""
    try:
        conn.execute(text(sql))
        return True
    except Exception as e:
        err = str(e).lower()
        if ignore_duplicate and ("duplicate column" in err or "duplicate" in err or "already exists" in err):
            print(f"  (skipped - already exists)")
            return False
        raise


def run_sql_ignore(conn, sql: str):
    """Run SQL, ignore any exception."""
    try:
        conn.execute(text(sql))
    except Exception as e:
        print(f"  (skipped: {e})")


def migrate():
    conn = engine.connect()
    try:
        print("Migrating database...")

        # 1. Create invoice_items table if not exists
        print("1. Creating invoice_items table...")
        run_sql(conn, """
            CREATE TABLE IF NOT EXISTS invoice_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                complaint_id INT NOT NULL,
                item VARCHAR(255) NOT NULL,
                cost INT NOT NULL,
                quantity INT NOT NULL DEFAULT 1,
                INDEX idx_invoice_items_complaint (complaint_id),
                FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """, ignore_duplicate=False)

        # 2. Create notifications table if not exists
        print("2. Creating notifications table...")
        run_sql(conn, """
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """, ignore_duplicate=False)

        # 3. Create complaint_attachments table if not exists
        print("3. Creating complaint_attachments table...")
        run_sql(conn, """
            CREATE TABLE IF NOT EXISTS complaint_attachments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                complaint_id INT NOT NULL,
                file_path VARCHAR(500) NOT NULL,
                file_name VARCHAR(255) NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_attachments_complaint (complaint_id),
                FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """, ignore_duplicate=False)

        # 4. Add workflow columns to complaints (ignore if exist)
        for col, defn in [
            ("audit_feedback", "TEXT"),
            ("maintenance_report", "TEXT"),
            ("invoice_amount", "INT"),
            ("invoice_notes", "TEXT"),
        ]:
            print(f"  Adding complaints.{col}...")
            run_sql(conn, f"ALTER TABLE complaints ADD COLUMN {col} {defn}")

        # 5. Update users.role ENUM
        print("5. Updating users.role enum...")
        run_sql_ignore(conn, """
            ALTER TABLE users MODIFY role ENUM(
                'student', 'staff', 'admin', 'management', 'auditor', 'maintenance_officer'
            ) NOT NULL DEFAULT 'student'
        """)

        # 6. Expand complaints.status ENUM
        print("6. Expanding complaints.status enum...")
        run_sql_ignore(conn, """
            ALTER TABLE complaints MODIFY status ENUM(
                'pending', 'in_progress', 'resolved', 'rejected',
                'assigned_to_auditor', 'audited', 'assigned_to_maintenance',
                'maintenance_in_progress', 'pending_approval', 'approved',
                'repair_completed', 'final_audit'
            ) NOT NULL DEFAULT 'pending'
        """)

        # 7. Migrate old status values
        print("7. Migrating old complaint statuses...")
        run_sql_ignore(conn, "UPDATE complaints SET status='maintenance_in_progress' WHERE status='in_progress'")

        # 8. Final enum (remove in_progress)
        print("8. Updating complaints.status enum (final)...")
        run_sql_ignore(conn, """
            ALTER TABLE complaints MODIFY status ENUM(
                'pending', 'assigned_to_auditor', 'audited', 'assigned_to_maintenance',
                'maintenance_in_progress', 'pending_approval', 'approved',
                'repair_completed', 'final_audit', 'resolved', 'rejected'
            ) NOT NULL DEFAULT 'pending'
        """)

        conn.commit()
        print("Migration completed successfully.")
    except Exception as e:
        conn.rollback()
        print(f"Migration failed: {e}")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    try:
        migrate()
    except Exception as e:
        print(f"Database error: {e}")
        sys.exit(1)
