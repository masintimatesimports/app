from app.core.supabase import supabase
from datetime import datetime
import pandas as pd
from app.utils.dates import parse_date
import time
import math


def ingest_sheet(df, agent_id, sheet_name):
    start_time = time.time()
    
    # --- Clean Excel column names ---
    df.columns = [str(col).strip() for col in df.columns]
    print(f"DEBUG [{sheet_name}]: {len(df)} rows, {len(df.columns)} columns")
    
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
    
    if not mappings:
        print(f"ERROR: No mappings found for agent {agent_id}, sheet '{sheet_name}'")
        return 0, [{"error": f"No column mappings found for sheet '{sheet_name}'. Please create mappings first."}]
    
    print(f"DEBUG: Found {len(mappings)} mappings")
    
    # --- Get all active fields ---
    fields_res = supabase.table("shipment_fields").select("*").eq("active", True).execute()
    field_keys = set(str(f["field_key"]).strip() for f in fields_res.data or [])
    
    # Add required fields if not in custom fields
    required_fields = {"agent_id", "hbl_number", "last_excel_upload_at"}
    field_keys.update(required_fields)
    
    print(f"DEBUG: {len(field_keys)} field keys (including required)")
    
    rows_dict = {}  # Use dict to avoid duplicates by hbl_number
    errors = []
    
    # Process rows
    for idx, row in df.iterrows():
        normalized = {}
        
        # Map Excel columns to standard columns
        for excel_col, std_col in mappings.items():
            if excel_col in df.columns:
                val = row[excel_col]
                
                # Handle NaN values immediately
                if pd.isna(val):
                    normalized[std_col] = None
                    continue
                    
                if std_col in ["eta"]:  # date fields
                    val = parse_date(val)
                normalized[std_col] = val
        
        hbl = str(normalized.get("hbl_number") or "").strip()
        if not hbl:
            errors.append({
                "row": idx + 2,
                "data": {k: v for k, v in normalized.items() if not pd.isna(v)},
                "error": "Missing HBL number"
            })
            continue
        
        # Check for duplicates within this upload
        if hbl in rows_dict:
            errors.append({
                "row": idx + 2,
                "hbl": hbl,
                "error": f"Duplicate HBL in same sheet (first at row {rows_dict[hbl]['original_row']})"
            })
            continue
        
        # Filter to only include valid field keys and clean values
        filtered = {}
        for k, v in normalized.items():
            if k in field_keys:
                # Clean the value
                if pd.isna(v) or (isinstance(v, float) and math.isnan(v)):
                    filtered[k] = None
                elif isinstance(v, datetime):
                    filtered[k] = v.isoformat()
                elif isinstance(v, pd.Timestamp):
                    filtered[k] = v.isoformat()
                elif isinstance(v, float) and math.isinf(v):
                    filtered[k] = None  # Handle infinity
                elif isinstance(v, str):
                    filtered[k] = v.strip()
                else:
                    filtered[k] = v
        
        # Add required fields
        filtered["agent_id"] = agent_id
        filtered["hbl_number"] = hbl
        filtered["last_excel_upload_at"] = datetime.now().isoformat()
        
        # Store with original row for error reporting
        rows_dict[hbl] = {
            "data": filtered,
            "original_row": idx + 2
        }
    
    print(f"DEBUG: Processed {len(df)} rows -> {len(rows_dict)} unique shipments, {len(errors)} errors")
    
    if rows_dict:
        # Convert dict to list and clean NaN values
        clean_rows = []
        for item in rows_dict.values():
            row_data = item["data"]
            # Final cleanup pass for any remaining NaN/inf values
            cleaned_row = {}
            for k, v in row_data.items():
                if pd.isna(v) or (isinstance(v, float) and (math.isnan(v) or math.isinf(v))):
                    cleaned_row[k] = None
                else:
                    cleaned_row[k] = v
            clean_rows.append(cleaned_row)
        
        # Process in batches for better performance
        total_processed = 0
        batch_size = 50  # Reduced for safety
        
        for i in range(0, len(clean_rows), batch_size):
            batch = clean_rows[i:i + batch_size]
            
            # Debug first few rows of each batch
            if i == 0 and len(batch) > 0:
                print(f"DEBUG: First row sample keys: {list(batch[0].keys())}")
                print(f"DEBUG: First row sample: { {k: v for k, v in batch[0].items() if k in ['hbl_number', 'po_number', 'vessel_name', 'eta'] and v is not None} }")
            
            try:
                # Validate batch doesn't contain NaN
                validated_batch = []
                for row in batch:
                    validated_row = {}
                    for k, v in row.items():
                        if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                            validated_row[k] = None
                        else:
                            validated_row[k] = v
                    validated_batch.append(validated_row)
                
                # Use upsert with explicit conflict resolution
                response = supabase.table("shipments").upsert(
                    validated_batch, 
                    on_conflict="agent_id,hbl_number"
                ).execute()
                
                batch_processed = len(validated_batch)
                total_processed += batch_processed
                print(f"DEBUG: Batch {i//batch_size + 1} processed {batch_processed} rows")
                
            except Exception as e:
                error_msg = str(e)
                print(f"ERROR in batch {i//batch_size + 1}: {error_msg}")
                
                # Fallback: Process rows individually with more debugging
                for row_idx, row in enumerate(batch):
                    try:
                        # Final cleanup before individual insert
                        final_row = {}
                        for k, v in row.items():
                            if pd.isna(v) or (isinstance(v, float) and (math.isnan(v) or math.isinf(v))):
                                final_row[k] = None
                            else:
                                final_row[k] = v
                        
                        supabase.table("shipments").upsert(
                            [final_row], 
                            on_conflict="agent_id,hbl_number"
                        ).execute()
                        total_processed += 1
                    except Exception as single_error:
                        hbl = row.get("hbl_number", "Unknown")
                        print(f"ERROR for HBL {hbl}: {single_error}")
                        # Try to get problematic value
                        for k, v in row.items():
                            if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                                print(f"  Problematic field {k} has value: {v}")
                        
                        errors.append({
                            "hbl": hbl,
                            "error": f"Database error: {str(single_error)[:100]}"
                        })
        
        elapsed = time.time() - start_time
        print(f"DEBUG: Total processed {total_processed} rows in {elapsed:.2f}s ({total_processed/elapsed:.1f} rows/sec)")
        
        return total_processed, errors
    
    elapsed = time.time() - start_time
    print(f"DEBUG: No valid rows found in {elapsed:.2f}s")
    return 0, errors


# Alternative: Clean dataframe before processing
def clean_dataframe(df):
    """Clean dataframe by replacing NaN values with None"""
    # Replace NaN with None for all columns
    df_clean = df.where(pd.notnull(df), None)
    
    # Convert specific problematic columns
    for col in df_clean.columns:
        # Check if column contains any NaN-like values
        if df_clean[col].dtype == 'float64' or df_clean[col].dtype == 'float32':
            df_clean[col] = df_clean[col].apply(lambda x: None if pd.isna(x) else x)
    
    return df_clean


# Updated ingest_sheet with dataframe cleaning
def ingest_sheet_clean(df, agent_id, sheet_name):
    """Version with pre-cleaned dataframe"""
    # Clean the dataframe first
    df_clean = clean_dataframe(df)
    
    # Then call the original function with cleaned dataframe
    return ingest_sheet(df_clean, agent_id, sheet_name)