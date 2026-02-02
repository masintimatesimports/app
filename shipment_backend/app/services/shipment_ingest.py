from app.core.supabase import supabase
from datetime import datetime
import pandas as pd
import time
import math
import json
from app.services.status_categorizer import StatusCategorizer

def ingest_sheet(df, agent_id, sheet_name):
    """
    Optimized version: Vectorized processing with cached status categorization
    Expected speed: 1000+ rows/sec instead of 8 rows/sec
    """
    start_time = time.time()
    
    # --- 1. CLEAN EXCEL COLUMN NAMES (Vectorized) ---
    df.columns = [str(col).strip() for col in df.columns]
    print(f"DEBUG [{sheet_name}]: {len(df)} rows, {len(df.columns)} columns")
    
    # --- 2. GET COLUMN MAPPINGS (Once) ---
    mappings_res = supabase.table("column_mappings") \
        .select("*") \
        .eq("agent_id", agent_id) \
        .eq("sheet_name", sheet_name) \
        .eq("active", True) \
        .execute()
    
    mappings = {}
    for m in mappings_res.data or []:
        excel_col = str(m["excel_column_name"]).strip()
        std_col = str(m["standard_column_name"]).strip()
        mappings[excel_col] = std_col
    
    if not mappings:
        print(f"ERROR: No mappings found for agent {agent_id}, sheet '{sheet_name}'")
        return 0, [{"error": f"No column mappings found for sheet '{sheet_name}'. Please create mappings first."}]
    
    print(f"DEBUG: Found {len(mappings)} mappings")
    
    # --- 3. VECTORIZED: APPLY MAPPINGS TO ENTIRE DATAFRAME ---
    result_df = pd.DataFrame()
    for excel_col, std_col in mappings.items():
        if excel_col in df.columns:
            result_df[std_col] = df[excel_col]
    
    # --- 4. VECTORIZED: STATUS CATEGORIZATION (CACHED) ---
    # Pre-load status patterns cache ONCE
    StatusCategorizer._refresh_cache()
    
    if 'clearance_status' in result_df.columns:
        # Apply to entire column at once
        result_df['standardized_status'] = result_df['clearance_status'].apply(
            lambda x: StatusCategorizer.categorize_status(str(x) if not pd.isna(x) else None)
        )
    else:
        result_df['standardized_status'] = 'PENDING'
    
    # --- 5. VECTORIZED: CLEAN DATA ---
    # Replace NaN with None
    result_df = result_df.where(pd.notnull(result_df), None)
    
    # Clean string columns
    for col in result_df.columns:
        if result_df[col].dtype == 'object':
            result_df[col] = result_df[col].apply(
                lambda x: x.strip() if isinstance(x, str) else x
            )
    
    # --- 6. VECTORIZED: PARSE DATES ---
    date_fields = {"eta", "etd", "shipment_ready_date", "delivery_date", 
                   "vessel_cutoff_date", "shipment_pickup_date", "booking_received_date", 
                   "atd", "ata"}
    
    for col in date_fields:
        if col in result_df.columns:
            # Convert to datetime, coerce errors to NaT
            result_df[col] = pd.to_datetime(result_df[col], errors='coerce')
            # Convert valid dates to ISO format strings, invalid to None
            result_df[col] = result_df[col].apply(
                lambda x: x.isoformat() if not pd.isna(x) and x is not None else None
            )
    
    # --- 7. GET FIELD CONFIGURATION (ONCE) ---
    fields_res = supabase.table("shipment_fields").select("*").eq("active", True).execute()
    
    column_fields = set()
    json_fields = set()
    
    for f in (fields_res.data or []):
        field_key = str(f["field_key"]).strip()
        if f.get("column_added", False):
            column_fields.add(field_key)
        else:
            json_fields.add(field_key)
    
    # Get table columns (simple version)
    table_columns = get_table_columns()
    
    # Combine valid columns
    all_valid_columns = set(table_columns).union(column_fields)
    all_valid_columns.update({"agent_id", "hbl_number", "last_excel_upload_at"})
    
    print(f"DEBUG: {len(all_valid_columns)} valid columns ({len(column_fields)} as columns, {len(json_fields)} as JSON)")
    
    # --- 8. PREPARE ROWS FOR DATABASE ---
    now_iso = datetime.now().isoformat()
    final_rows = []
    errors = []
    hbl_seen = set()  # For duplicate detection
    
    for idx, row in result_df.iterrows():
        hbl = str(row.get("hbl_number") or "").strip()
        
        # Validate HBL
        if not hbl:
            errors.append({
                "row": idx + 2,
                "error": "Missing HBL number"
            })
            continue
        
        # Check for duplicates in this batch
        if hbl in hbl_seen:
            errors.append({
                "row": idx + 2,
                "hbl": hbl,
                "error": "Duplicate HBL in same upload"
            })
            continue
        
        hbl_seen.add(hbl)
        
        # Build row data
        row_data = {
            "agent_id": agent_id,
            "hbl_number": hbl,
            "last_excel_upload_at": now_iso
        }
        
        json_data = {}
        
        # Process all columns
        for col, val in row.items():
            if val is None or (isinstance(val, float) and math.isnan(val)):
                continue
            
            # Determine where to put this field
            if col in all_valid_columns:
                row_data[col] = val
            elif col in json_fields:
                json_data[col] = val
            # Ignore unmapped fields
        
        # Add JSON data if any
        if json_data:
            row_data["custom_fields"] = json_data
        
        final_rows.append(row_data)
    
    print(f"DEBUG: Prepared {len(final_rows)} rows, {len(errors)} errors")
    
    # --- 9. BULK UPSERT (SINGLE OPERATION) ---
    if final_rows:
        try:
            # SINGLE BULK UPSERT - FASTEST
            response = supabase.table("shipments").upsert(
                final_rows, 
                on_conflict="agent_id,hbl_number"
            ).execute()
            
            elapsed = time.time() - start_time
            rows_per_sec = len(final_rows) / elapsed if elapsed > 0 else 0
            
            print(f"SUCCESS: Processed {len(final_rows)} rows in {elapsed:.2f}s ({rows_per_sec:.1f} rows/sec)")
            return len(final_rows), errors
            
        except Exception as e:
            error_msg = str(e)
            print(f"ERROR in bulk upsert: {error_msg}")
            
            # Fallback: Smaller batches if single upsert fails
            total_processed = 0
            BATCH_SIZE = 500
            
            for i in range(0, len(final_rows), BATCH_SIZE):
                batch = final_rows[i:i + BATCH_SIZE]
                try:
                    supabase.table("shipments").upsert(
                        batch, 
                        on_conflict="agent_id,hbl_number"
                    ).execute()
                    total_processed += len(batch)
                    print(f"Fallback: Processed batch {i//BATCH_SIZE + 1}")
                except Exception as batch_error:
                    print(f"Batch error: {batch_error}")
                    # Last resort: individual rows
                    for row in batch:
                        try:
                            supabase.table("shipments").upsert(
                                [row], 
                                on_conflict="agent_id,hbl_number"
                            ).execute()
                            total_processed += 1
                        except:
                            pass
            
            elapsed = time.time() - start_time
            print(f"Fallback: Processed {total_processed} rows in {elapsed:.2f}s")
            return total_processed, errors
    
    elapsed = time.time() - start_time
    print(f"DEBUG: No valid rows found in {elapsed:.2f}s")
    return 0, errors

def get_table_columns():
    """
    Simple column detection - no cache table, no RPC calls
    """
    try:
        # Get one row to detect columns (FAST)
        result = supabase.table("shipments").select("*").limit(1).execute()
        
        if result.data:
            columns = list(result.data[0].keys())
            return set(columns)
        else:
            # Return base columns for empty table
            return {
                "agent_id", "hbl_number", "mbl_number", "po_number", "consignee",
                "vessel_name", "voyage_no", "eta", "clearance_status",
                "last_excel_upload_at", "created_at", "updated_at", "custom_fields",
                "standardized_status"
            }
            
    except Exception as e:
        print(f"Warning: Could not fetch table columns: {e}")
        # Return known base columns
        return {
            "agent_id", "hbl_number", "mbl_number", "po_number", "consignee",
            "vessel_name", "voyage_no", "eta", "clearance_status",
            "last_excel_upload_at", "created_at", "updated_at", "custom_fields",
            "standardized_status"
        }

def clean_dataframe(df):
    """Clean dataframe by replacing NaN values with None"""
    df_clean = df.where(pd.notnull(df), None)
    
    # Convert float NaN to None
    for col in df_clean.columns:
        if df_clean[col].dtype in ['float64', 'float32']:
            df_clean[col] = df_clean[col].apply(lambda x: None if pd.isna(x) else x)
    
    return df_clean

def ingest_sheet_clean(df, agent_id, sheet_name):
    """Version with pre-cleaned dataframe"""
    df_clean = clean_dataframe(df)
    return ingest_sheet(df_clean, agent_id, sheet_name)