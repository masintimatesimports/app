from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from app.core.supabase import supabase
from app.services.column_manager import ColumnManager
import logging
from typing import Optional
from app.core.supabase import supabase

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/fields", tags=["Shipment Fields"])

# -----------------------------
# Pydantic models
# -----------------------------
class FieldCreate(BaseModel):
    field_key: str
    field_label: str
    field_type: str = Field(..., pattern="^(text|number|date)$")  # <-- changed regex -> pattern
    required: bool = False

class FieldUpdate(BaseModel):
    field_label: Optional[str]
    field_type: Optional[str]
    required: Optional[bool]
    active: Optional[bool]

# -----------------------------
# CRUD
# -----------------------------

@router.get("/", response_model=List[dict])
def list_fields():
    res = supabase.table("shipment_fields").select("*").eq("active", True).execute()
    return res.data or []

# Add import at top
from app.services.column_manager import ColumnManager

# MODIFY the create_field function
@router.post("/", response_model=dict)
def create_field(payload: FieldCreate):
    # check unique key
    existing = supabase.table("shipment_fields").select("*") \
        .eq("field_key", payload.field_key).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="field_key already exists")
    
    now = datetime.now().isoformat()
    
    # Validate column name first
    is_valid, msg = ColumnManager.validate_column_name(payload.field_key)
    if not is_valid:
        raise HTTPException(status_code=400, detail=msg)
    
    # Create field record
    field_data = {
        "field_key": payload.field_key,
        "field_label": payload.field_label,
        "field_type": payload.field_type,
        "required": payload.required,
        "active": True,
        "created_at": now,
        "updated_at": now
    }
    
    res = supabase.table("shipment_fields").insert(field_data).execute()
    new_field = res.data[0]
    
    # ATTEMPT to add as column to shipments table
    try:
        column_success, column_msg = ColumnManager.add_column(
            payload.field_key, 
            payload.field_type
        )
        
        # Update field record with column status
        supabase.table("shipment_fields").update({
            "column_added": column_success,
            "column_message": column_msg,
            "updated_at": now
        }).eq("field_id", new_field["field_id"]).execute()
        
        new_field["column_added"] = column_success
        new_field["column_message"] = column_msg
        
        if not column_success:
            logger.warning(f"Field created but column add failed: {column_msg}")
            # Don't fail the request, just warn
        
    except Exception as e:
        logger.error(f"Error adding column: {e}")
        # Continue anyway - field exists, column may be added later
        new_field["column_added"] = False
        new_field["column_message"] = "Column addition pending"
    
    return new_field

# ADD new endpoint for column sync
@router.post("/{field_id}/sync-column")
def sync_field_column(field_id: int):
    """Manually trigger column addition for a field"""
    # Get field
    field_res = supabase.table("shipment_fields") \
        .select("*") \
        .eq("field_id", field_id) \
        .execute()
    
    if not field_res.data:
        raise HTTPException(status_code=404, detail="Field not found")
    
    field = field_res.data[0]
    
    # Add column
    success, message = ColumnManager.add_column(
        field["field_key"],
        field["field_type"]
    )
    
    # Update field status
    now = datetime.now().isoformat()
    supabase.table("shipment_fields").update({
        "column_added": success,
        "column_message": message,
        "updated_at": now
    }).eq("field_id", field_id).execute()
    
    return {
        "field_id": field_id,
        "field_key": field["field_key"],
        "success": success,
        "message": message
    }

@router.patch("/{field_id}", response_model=dict)
def update_field(field_id: int, payload: FieldUpdate):
    updates = payload.dict(exclude_unset=True)
    if updates:
        updates["updated_at"] = datetime.now().isoformat()
        res = supabase.table("shipment_fields").update(updates).eq("field_id", field_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Field not found")
        return res.data[0]
    raise HTTPException(status_code=400, detail="No updates provided")

@router.delete("/{field_id}", response_model=dict)
def delete_field(field_id: int):
    # Soft delete: mark active=False
    now = datetime.now().isoformat()
    res = supabase.table("shipment_fields").update({
        "active": False,
        "updated_at": now
    }).eq("field_id", field_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Field not found")
    return {"deleted": True}
