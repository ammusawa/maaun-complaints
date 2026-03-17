"""Script to initialize the database. Run: python -m scripts.init_db"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pymysql
from sqlalchemy.engine import make_url

from app.config import get_settings


def init_db():
    settings = get_settings()
    url = make_url(settings.DATABASE_URL)

    # Connect without database for CREATE DATABASE
    conn = pymysql.connect(
        host=url.host or "localhost",
        port=url.port or 3306,
        user=url.username or "root",
        password=url.password or "",
        charset="utf8mb4",
    )

    script_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    init_sql_path = os.path.join(script_dir, "..", "database", "init.sql")

    with open(init_sql_path, encoding="utf-8") as f:
        sql = f.read()

    # Remove single-line comments and split by semicolon
    lines = []
    for line in sql.split("\n"):
        if "--" in line:
            line = line[: line.index("--")].strip()
        lines.append(line)
    sql_clean = "\n".join(lines)

    statements = [s.strip() for s in sql_clean.split(";") if s.strip()]

    try:
        with conn.cursor() as cursor:
            for stmt in statements:
                if stmt:
                    cursor.execute(stmt)
        conn.commit()
        print("Database initialized successfully.")
    except Exception as e:
        print(f"Error: {e}")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    try:
        init_db()
    except FileNotFoundError:
        print("Error: database/init.sql not found.")
        sys.exit(1)
    except pymysql.Error as e:
        print(f"Database error: {e}")
        sys.exit(1)
