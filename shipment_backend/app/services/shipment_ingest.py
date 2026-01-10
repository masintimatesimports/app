from app.core.supabase import supabase
from datetime import datetime
import pandas as pd
from app.utils.dates import parse_date


def ingest_sheet(df, agent_id, sheet_name):
    # --- Clean Excel column names ---
    df.columns = [str(col).strip() for col in df.columns]
    print(f"DEBUG: Cleaned Excel columns: {list(df.columns)}")
    
    # --- Get column mapping ---
    mappings_res = supabase.table("column_mappings") \
        .select("*") \
        .eq("agent_id", agent_id) \
        .eq("sheet_name", sheet_name) \
        .eq("active", True) \
        .execute()

    # --- Clean mapping keys ---
    mappings = {}
    for m in mappings_res.data or []:
        excel_col = str(m["excel_column_name"]).strip()
        std_col = str(m["standard_column_name"]).strip()
        mappings[excel_col] = std_col
    
    print(f"DEBUG: Cleaned mappings: {mappings}")
    
    # --- Get all active fields ---
    fields_res = supabase.table("shipment_fields").select("*").eq("active", True).execute()
    field_keys = [str(f["field_key"]).strip() for f in fields_res.data or []]
    
    print(f"DEBUG: Field keys: {field_keys}")
    
    rows, errors = [], []

    for idx, row in df.iterrows():
        normalized = {}
        for excel_col, std_col in mappings.items():
            val = row.get(excel_col)
            if std_col in ["eta"]:  # date fields
                val = parse_date(val)
            normalized[std_col] = val
        
        # Debug specific fields
        if 'po_number' in normalized:
            print(f"DEBUG Row {idx}: PO Number = {normalized['po_number']}")
        if 'vessel_name' in normalized:
            print(f"DEBUG Row {idx}: Vessel = {normalized['vessel_name']}")
        
        hbl = str(normalized.get("hbl_number") or "").strip()
        if not hbl:
            errors.append({**normalized, "error": "Missing HBL"})
            continue

        # Only keep keys that exist in standardized fields
        filtered = {k: v for k, v in normalized.items() if k in field_keys}
        
        print(f"DEBUG Row {idx}: Filtered data = {filtered}")
        
        rows.append({
            "agent_id": agent_id,
            "hbl_number": hbl,
            **filtered,
            "last_excel_upload_at": datetime.now().isoformat()
        })

    if rows:
        # Clean NaN/NaT
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

        print(f"DEBUG: Saving {len(clean_rows)} rows to shipments")
        supabase.table("shipments").upsert(clean_rows, on_conflict="agent_id, hbl_number").execute()

    return len(rows), errors
