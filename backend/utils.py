from datetime import datetime


def generate_ticket_number() -> str:
    """Generate unique ticket number: MAAUN-YYYYMMDD-XXXX"""
    prefix = "MAAUN"
    date_part = datetime.utcnow().strftime("%Y%m%d")
    import random
    random_part = str(random.randint(1000, 9999))
    return f"{prefix}-{date_part}-{random_part}"
