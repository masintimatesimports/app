from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from app.core.supabase import supabase


router = APIRouter(prefix="/status-categories", tags=["Status Categories"])

class PatternCreate(BaseModel):
    raw_pattern: str
    status_category_id: int
    match_type: str = "CONTAINS"

@router.get("/categories")
def get_categories():
    res = supabase.table("shipment_status_categories") \
        .select("*") \
        .eq("is_active", True) \
        .order("priority") \
        .execute()
    return res.data or []

@router.post("/patterns")
def create_pattern(payload: PatternCreate):
    res = supabase.table("status_pattern_mappings").insert({
        "raw_pattern": payload.raw_pattern,
        "status_category_id": payload.status_category_id,
        "match_type": payload.match_type
    }).execute()
    return res.data[0] if res.data else {}