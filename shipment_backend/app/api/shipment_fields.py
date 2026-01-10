from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from app.core.supabase import supabase

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

@router.post("/", response_model=dict)
def create_field(payload: FieldCreate):
    # check unique key
    existing = supabase.table("shipment_fields").select("*") \
        .eq("field_key", payload.field_key).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="field_key already exists")

    now = datetime.now().isoformat()
    res = supabase.table("shipment_fields").insert({
        "field_key": payload.field_key,
        "field_label": payload.field_label,
        "field_type": payload.field_type,
        "required": payload.required,
        "active": True,
        "created_at": now,
        "updated_at": now
    }).execute()

    return res.data[0]

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
