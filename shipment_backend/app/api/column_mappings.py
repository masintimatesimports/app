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
        clean[k.strip()] = s
    return clean

@router.post("/")
def save_mapping(payload: MappingPayload):
    agent_id = int(payload.agent_id)
    sheet_name = payload.sheet_name
    mappings = _sanitize_mappings(payload.mappings)

    if not mappings:
        raise HTTPException(status_code=422, detail="No mappings provided after sanitization")
    
    # Validate: No duplicate Excel columns in the NEW mappings
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
        # Get ALL existing mappings for this agent+sheet
        existing_res = supabase.table("column_mappings") \
            .select("*") \
            .eq("agent_id", agent_id) \
            .eq("sheet_name", sheet_name) \
            .eq("active", True) \
            .execute()
        
        existing_mappings = existing_res.data or []
        
        # Create lookup dictionaries
        existing_std_to_excel = {item["standard_column_name"]: item["excel_column_name"] 
                                for item in existing_mappings}
        existing_excel_to_std = {item["excel_column_name"]: item["standard_column_name"] 
                                for item in existing_mappings}
        
        now = datetime.now().isoformat()
        
        for std_col, excel_col in mappings.items():
            # Check if this Excel column is already mapped to a DIFFERENT standard column
            if excel_col in existing_excel_to_std:
                existing_std_for_this_excel = existing_excel_to_std[excel_col]
                if existing_std_for_this_excel != std_col:
                    # CONFLICT: Excel column already mapped to different standard column
                    # We need to either:
                    # 1. Update the existing mapping to point to new standard column, OR
                    # 2. Delete the existing mapping first
                    
                    # Option 1: Update existing mapping (change its standard column)
                    # But this violates the constraint! Can't have same Excel column for different standards
                    
                    # Option 2: Delete the old mapping first (soft delete)
                    supabase.table("column_mappings") \
                        .update({"active": False}) \
                        .eq("agent_id", agent_id) \
                        .eq("sheet_name", sheet_name) \
                        .eq("excel_column_name", excel_col) \
                        .execute()
                    
                    # Now we can insert the new mapping
            
            # Check if this standard column already has a mapping (maybe to different Excel column)
            if std_col in existing_std_to_excel:
                existing_excel_for_this_std = existing_std_to_excel[std_col]
                if existing_excel_for_this_std != excel_col:
                    # Update the existing mapping with new Excel column
                    supabase.table("column_mappings") \
                        .update({
                            "excel_column_name": excel_col,
                            "updated_at": now
                        }) \
                        .eq("agent_id", agent_id) \
                        .eq("sheet_name", sheet_name) \
                        .eq("standard_column_name", std_col) \
                        .eq("active", True) \
                        .execute()
                # else: same mapping exists, do nothing
            else:
                # Insert new mapping
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
        logging.exception("Error saving mappings")
        error_msg = str(e)
        if "duplicate key" in error_msg.lower():
            raise HTTPException(
                status_code=409, 
                detail="Duplicate Excel column mapping detected. Database constraint violation. Please try clearing existing mappings first."
            )
        raise HTTPException(status_code=500, detail=f"Database error: {error_msg}")
    

@router.get("/")
def get_mappings(agent_id: int, sheet_name: str):
    """
    Get mappings for a specific agent and sheet
    """
    res = supabase.table("column_mappings") \
        .select("*") \
        .eq("agent_id", agent_id) \
        .eq("sheet_name", sheet_name) \
        .eq("active", True) \
        .execute()

    data = res.data or []
    # return as dict: standard_column_name -> excel_column_name
    return {item["standard_column_name"]: item["excel_column_name"] for item in data}


@router.delete("/{agent_id}/{sheet_name}/{standard_column}")
def delete_single_mapping(agent_id: int, sheet_name: str, standard_column: str):
    """
    Delete a single mapping for a specific standard column
    """
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


# In delete_all_mappings_for_sheet function:
@router.delete("/{agent_id}/{sheet_name}")
def delete_all_mappings_for_sheet(agent_id: int, sheet_name: str):
    try:
        # HARD DELETE instead of soft delete
        supabase.table("column_mappings") \
            .delete() \
            .eq("agent_id", agent_id) \
            .eq("sheet_name", sheet_name) \
            .execute()
        
        return {"deleted": True, "message": f"All mappings permanently deleted for sheet '{sheet_name}'"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/all")
def get_all_mappings_for_agent(agent_id: int):
    """
    Get all mappings for an agent (all sheets)
    """
    res = supabase.table("column_mappings") \
        .select("*") \
        .eq("agent_id", agent_id) \
        .eq("active", True) \
        .execute()
    return res.data or []