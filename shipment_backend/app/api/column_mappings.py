from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Dict
import logging
from app.core.supabase import supabase
from datetime import datetime

router = APIRouter(prefix="/mappings", tags=["Column Mappings"])


class MappingPayload(BaseModel):
    agent_id: int = Field(..., gt=0)
    sheet_name: str
    mappings: Dict[str, str]


def _sanitize_mappings(raw: Dict[str, str]):
    clean = {}
    for k, v in (raw or {}).items():
        if v is None:
            continue
        s = str(v).strip()
        if s == "" or s.lower() == "none":
            continue
        clean[k] = s
    return clean


@router.post("/")
def save_mapping(payload: MappingPayload):
    agent_id = int(payload.agent_id)
    sheet_name = payload.sheet_name
    mappings = _sanitize_mappings(payload.mappings)

    if not mappings:
        raise HTTPException(status_code=422, detail="No mappings provided after sanitization")
    
    # Validate: No duplicate Excel columns in the new mappings
    excel_columns = list(mappings.values())
    if len(excel_columns) != len(set(excel_columns)):
        raise HTTPException(
            status_code=422, 
            detail="Duplicate Excel column mapping detected. Each Excel column can only map to one standard field."
        )
    
    # Validate: Required field (hbl_number) must be mapped
    if "hbl_number" not in mappings:
        raise HTTPException(
            status_code=422, 
            detail="hbl_number mapping is required"
        )

    try:
        # Check for existing mappings that might conflict
        existing_res = supabase.table("column_mappings") \
            .select("*") \
            .eq("agent_id", agent_id) \
            .eq("sheet_name", sheet_name) \
            .eq("active", True) \
            .execute()
        
        existing_mappings = existing_res.data or []
        
        # Identify conflicts: Excel columns already mapped to different standard fields
        conflicts = []
        for existing in existing_mappings:
            excel_col = existing["excel_column_name"]
            std_col = existing["standard_column_name"]
            
            # If this Excel column is in new mappings but to a DIFFERENT standard field
            if excel_col in excel_columns and mappings.get(std_col) != excel_col:
                conflicts.append(f"'{excel_col}' currently maps to '{std_col}'")
        
        if conflicts:
            error_msg = "Cannot save mappings due to conflicts:\n" + "\n".join(conflicts)
            raise HTTPException(status_code=409, detail=error_msg)
        
        # delete all previous mappings for this agent+sheet (they're being replaced)
        supabase.table("column_mappings") \
            .delete() \
            .eq("agent_id", agent_id) \
            .eq("sheet_name", sheet_name) \
            .execute()

        now = datetime.now().isoformat()
        rows = [{
            "agent_id": agent_id,
            "sheet_name": sheet_name,
            "standard_column_name": std,
            "excel_column_name": excel,
            "active": True,
            "created_at": now,
            "updated_at": now
        } for std, excel in mappings.items()]

        if rows:
            res = supabase.table("column_mappings").insert(rows).execute()
            # check for errors in supabase response if available
            if hasattr(res, 'error') and res.error:
                logging.error("Supabase insert error: %s", res.error)
                # Extract meaningful error message
                error_detail = str(res.error)
                if "duplicate key" in error_detail.lower():
                    raise HTTPException(
                        status_code=409, 
                        detail="Duplicate Excel column mapping. Each Excel column can only map to one standard field."
                    )
                else:
                    raise Exception(res.error)

        return {"saved": True, "message": f"Mappings saved for sheet '{sheet_name}'"}
    except HTTPException:
        raise
    except Exception as e:
        logging.exception("Error saving mappings")
        # Return more specific error message
        error_msg = str(e)
        if "duplicate key" in error_msg.lower():
            raise HTTPException(
                status_code=409, 
                detail="Duplicate Excel column mapping detected. Please ensure each Excel column maps to only one standard field."
            )
        raise HTTPException(status_code=500, detail=f"Database error: {error_msg}")
    
@router.get("/")
def get_mappings(agent_id: int, sheet_name: str):
    res = supabase.table("column_mappings") \
        .select("*") \
        .eq("agent_id", agent_id) \
        .eq("sheet_name", sheet_name) \
        .eq("active", True) \
        .execute()

    data = res.data or []
    # return as dict: standard_column_name -> excel_column_name
    return {item["standard_column_name"]: item["excel_column_name"] for item in data}


@router.get("/")
def get_mappings(agent_id: int, sheet_name: str):
    res = supabase.table("column_mappings") \
        .select("*") \
        .eq("agent_id", agent_id) \
        .eq("sheet_name", sheet_name) \
        .eq("active", True) \
        .execute()
    return res.data or []

@router.post("/")
def save_mapping(payload: MappingPayload):
    agent_id = int(payload.agent_id)
    sheet_name = payload.sheet_name
    mappings = _sanitize_mappings(payload.mappings)

    if not mappings:
        raise HTTPException(status_code=422, detail="No mappings provided")
    
    if "hbl_number" not in mappings:
        raise HTTPException(status_code=422, detail="hbl_number mapping is required")

    try:
        # CRUD Approach: Update existing or insert new
        now = datetime.now().isoformat()
        
        for std_col, excel_col in mappings.items():
            # Check if mapping already exists
            existing = supabase.table("column_mappings") \
                .select("*") \
                .eq("agent_id", agent_id) \
                .eq("sheet_name", sheet_name) \
                .eq("standard_column_name", std_col) \
                .eq("active", True) \
                .execute()
            
            if existing.data:
                # UPDATE existing mapping
                supabase.table("column_mappings") \
                    .update({
                        "excel_column_name": excel_col,
                        "updated_at": now
                    }) \
                    .eq("agent_id", agent_id) \
                    .eq("sheet_name", sheet_name) \
                    .eq("standard_column_name", std_col) \
                    .execute()
            else:
                # INSERT new mapping
                supabase.table("column_mappings") \
                    .insert({
                        "agent_id": agent_id,
                        "sheet_name": sheet_name,
                        "standard_column_name": std_col,
                        "excel_column_name": excel_col,
                        "active": True,
                        "created_at": now,
                        "updated_at": now
                    }) \
                    .execute()
        
        return {"saved": True, "message": "Mappings updated successfully"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{agent_id}/{sheet_name}/{standard_column}")
def delete_mapping(agent_id: int, sheet_name: str, standard_column: str):
    try:
        supabase.table("column_mappings") \
            .update({"active": False}) \
            .eq("agent_id", agent_id) \
            .eq("sheet_name", sheet_name) \
            .eq("standard_column_name", standard_column) \
            .execute()
        return {"deleted": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@router.get("/all")
def get_all_mappings_for_agent(agent_id: int):
    res = supabase.table("column_mappings") \
        .select("*") \
        .eq("agent_id", agent_id) \
        .eq("active", True) \
        .execute()
    return res.data or []   

def _sanitize_mappings(raw: Dict[str, str]):
    clean = {}
    for k, v in (raw or {}).items():
        if v is None:
            continue
        s = str(v).strip()  # ADD THIS: Trim whitespace
        if s == "" or s.lower() == "none":
            continue
        clean[k.strip()] = s  # Also trim the key
    return clean 