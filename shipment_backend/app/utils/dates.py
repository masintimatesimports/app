from datetime import datetime

def parse_date(val):
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.isoformat()
    for fmt in ("%d.%m.%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(str(val), fmt).isoformat()
        except ValueError:
            pass
    return None
