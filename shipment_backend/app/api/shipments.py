from fastapi import APIRouter
from app.core.supabase import supabase
from datetime import datetime

router = APIRouter(prefix="/shipments", tags=["Shipments"])

@router.get("/{hbl}")
def get_shipment(agent_id: int, hbl: str):
    return supabase.table("shipments")         .select("*")         .eq("agent_id", agent_id)         .eq("hbl_number", hbl)         .execute().data

@router.patch("/{hbl}/status")
def update_status(agent_id: int, hbl: str, status: str):
    res = supabase.table("shipments").update({
        "clearance_status": status,
        "updated_at": datetime.now().isoformat()
    }).eq("agent_id", agent_id).eq("hbl_number", hbl).execute()
    return {"updated": bool(res.data)}
