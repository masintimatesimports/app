from app.core.supabase import supabase
from datetime import datetime
import pandas as pd
from app.utils.dates import parse_date
import time
import math
import json


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
    
    # --- Get all active fields and check which are database columns ---
    fields_res = supabase.table("shipment_fields").select("*").eq("active", True).execute()
    
    # Track which fields are actual database columns
    column_fields = set()
    json_fields = set()
    
    for f in (fields_res.data or []):
        field_key = str(f["field_key"]).strip()
        # Check if this field has been added as a database column
        if f.get("column_added", False):
            column_fields.add(field_key)
        else:
            json_fields.add(field_key)
    
    # Get actual table columns from database
    table_columns = get_table_columns()
    
    # Combine: table columns + fields marked as columns
    all_valid_columns = set(table_columns).union(column_fields)
    
    # Add required fields
    required_fields = {"agent_id", "hbl_number", "last_excel_upload_at"}
    all_valid_columns.update(required_fields)
    
    print(f"DEBUG: {len(all_valid_columns)} valid columns ({len(column_fields)} as columns, {len(json_fields)} as JSON)")
    
    rows_dict = {}  # Use dict to avoid duplicates by hbl_number
    errors = []
    
    # Date fields that need parsing
    date_fields = {"eta", "etd", "shipment_ready_date", "delivery_date", "vessel_cutoff_date", 
                   "shipment_pickup_date", "booking_received_date", "atd", "ata"}
    
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
                    
                # Parse dates for known date fields
                if std_col in date_fields:
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
        
        # Separate data: columns vs JSON
        column_data = {}
        json_data = {}
        
        for k, v in normalized.items():
            if pd.isna(v) or (isinstance(v, float) and math.isnan(v)):
                # Skip NaN values
                continue
            
            # Clean the value
            if isinstance(v, datetime):
                cleaned_val = v.isoformat()
            elif isinstance(v, pd.Timestamp):
                cleaned_val = v.isoformat()
            elif isinstance(v, float) and math.isinf(v):
                cleaned_val = None
            elif isinstance(v, str):
                cleaned_val = v.strip()
                if cleaned_val == "":
                    cleaned_val = None
            else:
                cleaned_val = v
            
            if cleaned_val is None:
                continue
            
            # Check where this field should go
            if k in all_valid_columns:
                # This is (or should be) a database column
                column_data[k] = cleaned_val
            elif k in json_fields:
                # This is a field that exists but isn't a column yet
                json_data[k] = cleaned_val
            # else: field doesn't exist in system, ignore
        
        # Add required fields to column_data
        column_data["agent_id"] = agent_id
        column_data["hbl_number"] = hbl
        column_data["last_excel_upload_at"] = datetime.now().isoformat()
        
        # Add JSON data if any
        if json_data:
            column_data["custom_fields"] = json_data
        
        # Store with original row for error reporting
        rows_dict[hbl] = {
            "data": column_data,
            "original_row": idx + 2
        }
    
    print(f"DEBUG: Processed {len(df)} rows -> {len(rows_dict)} unique shipments, {len(errors)} errors")
    
    if rows_dict:
        # Convert dict to list
        clean_rows = []
        for item in rows_dict.values():
            row_data = item["data"]
            # Final cleanup pass
            cleaned_row = {}
            for k, v in row_data.items():
                if pd.isna(v) or (isinstance(v, float) and (math.isnan(v) or math.isinf(v))):
                    cleaned_row[k] = None
                else:
                    cleaned_row[k] = v
            clean_rows.append(cleaned_row)
        
        # Process in batches
        total_processed = 0
        batch_size = 50
        
        for i in range(0, len(clean_rows), batch_size):
            batch = clean_rows[i:i + batch_size]
            
            # Debug first few rows
            if i == 0 and len(batch) > 0:
                print(f"DEBUG: First row sample keys: {list(batch[0].keys())}")
                # Show sample of both column and JSON data
                sample_data = {}
                for k, v in batch[0].items():
                    if k == 'custom_fields' and v:
                        sample_data['custom_fields'] = f"JSON with {len(json.loads(v) if isinstance(v, str) else v)} fields"
                    elif k not in ['agent_id', 'last_excel_upload_at']:
                        sample_data[k] = v
                print(f"DEBUG: First row sample: {sample_data}")
            
            try:
                # Use upsert
                response = supabase.table("shipments").upsert(
                    batch, 
                    on_conflict="agent_id,hbl_number"
                ).execute()
                
                batch_processed = len(batch)
                total_processed += batch_processed
                print(f"DEBUG: Batch {i//batch_size + 1} processed {batch_processed} rows")
                
            except Exception as e:
                error_msg = str(e)
                print(f"ERROR in batch {i//batch_size + 1}: {error_msg}")
                
                # Try individual rows to identify which one fails
                for row_idx, row in enumerate(batch):
                    try:
                        # Clean any remaining issues
                        final_row = {}
                        for k, v in row.items():
                            if k == 'custom_fields' and v and not isinstance(v, (dict, str)):
                                # Ensure custom_fields is proper JSON
                                try:
                                    final_row[k] = json.dumps(v) if isinstance(v, dict) else str(v)
                                except:
                                    final_row[k] = json.dumps({})
                            elif pd.isna(v) or (isinstance(v, float) and (math.isnan(v) or math.isinf(v))):
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
                        error_detail = str(single_error)
                        print(f"ERROR for HBL {hbl}: {error_detail}")
                        
                        # Check if it's a missing column error
                        if "column" in error_detail.lower() and "not found" in error_detail.lower():
                            # Extract column name from error
                            import re
                            match = re.search(r"column ['\"]([^'\"]+)['\"]", error_detail)
                            if match:
                                missing_column = match.group(1)
                                print(f"  Missing column: {missing_column}. Field needs to be added as a database column first.")
                        
                        errors.append({
                            "hbl": hbl,
                            "error": f"Database error: {error_detail[:100]}"
                        })
        
        elapsed = time.time() - start_time
        print(f"DEBUG: Total processed {total_processed} rows in {elapsed:.2f}s ({total_processed/elapsed:.1f} rows/sec)")
        
        return total_processed, errors
    
    elapsed = time.time() - start_time
    print(f"DEBUG: No valid rows found in {elapsed:.2f}s")
    return 0, errors


def get_table_columns():
    """Get list of actual columns in shipments table"""
    try:
        # Try to get columns from information_schema
        # This is a simplified approach - in production, you might cache this
        query = """
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'shipments' 
        AND table_schema = 'public'
        ORDER BY ordinal_position;
        """
        
        # Use Supabase RPC or direct query
        result = supabase.rpc('exec_sql', {'sql': query}).execute()
        
        if result.data:
            return [col['column_name'] for col in result.data]
        else:
            # Fallback to known columns
            return [
                "agent_id", "hbl_number", "mbl_number", "po_number", "consignee",
                "vessel_name", "voyage_no", "eta", "clearance_status",
                "last_excel_upload_at", "created_at", "updated_at", "custom_fields"
            ]
            
    except Exception as e:
        print(f"Warning: Could not fetch table columns: {e}")
        # Return known columns
        return [
            "agent_id", "hbl_number", "mbl_number", "po_number", "consignee",
            "vessel_name", "voyage_no", "eta", "clearance_status",
            "last_excel_upload_at", "created_at", "updated_at", "custom_fields"
        ]


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


def ingest_sheet_clean(df, agent_id, sheet_name):
    """Version with pre-cleaned dataframe"""
    # Clean the dataframe first
    df_clean = clean_dataframe(df)
    
    # Then call the original function with cleaned dataframe
    return ingest_sheet(df_clean, agent_id, sheet_name)