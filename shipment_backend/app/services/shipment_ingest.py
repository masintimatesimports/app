from datetime import datetime
from app.core.supabase import supabase
from app.utils.dates import parse_date
import pandas as pd

def ingest_sheet(df, agent_id, sheet_name):
    mappings_res = supabase.table("column_mappings")         .select("*")         .eq("agent_id", agent_id)         .eq("sheet_name", sheet_name)         .eq("active", True)         .execute()

    mappings = {m["excel_column_name"]: m["standard_column_name"] for m in mappings_res.data or []}
    rows, errors = [], []

    for _, row in df.iterrows():
        normalized = {}
        for excel, std in mappings.items():
            val = row.get(excel)
            normalized[std] = parse_date(val) if std == "eta" else val

        hbl = str(normalized.get("hbl_number") or "").strip()
        if not hbl:
            errors.append({**normalized, "error": "Missing HBL"})
            continue

        rows.append({
            "agent_id": agent_id,
            "hbl_number": hbl,
            **normalized,
            "last_excel_upload_at": datetime.now().isoformat()
        })

    if rows:
        # Convert any pandas NA/NaN/NaT values to None and datetime to ISO format strings
        clean_rows = []
        for r in rows:
            clean_r = {}
            for k, v in r.items():
                if pd.isna(v):
                    clean_r[k] = None
                elif isinstance(v, datetime):
                    clean_r[k] = v.isoformat()
                else:
                    clean_r[k] = v
            clean_rows.append(clean_r)

        supabase.table("shipments").upsert(clean_rows, on_conflict="agent_id, hbl_number").execute()

    return len(rows), errors
