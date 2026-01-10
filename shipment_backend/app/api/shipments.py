from fastapi import APIRouter
from app.core.supabase import supabase
from datetime import datetime

router = APIRouter(prefix="/shipments", tags=["Shipments"])

@router.get("/total-count")
def total_shipment_count():
    """Count ALL shipments - using COUNT(*) SQL"""
    try:
        # Use execute() method for raw SQL
        response = supabase.table("shipments").select("*", count="exact").execute()
        
        # The count is available in response.count
        return {"count": response.count or 0}
        
    except Exception as e:
        print(f"Error counting total shipments: {e}")
        return {"count": 0}

@router.get("/pending-count")
def pending_shipment_count():
    """Count ALL shipments without clearance status"""
    try:
        # Use select with count="exact" for filtered count
        response = supabase.table("shipments") \
            .select("*", count="exact") \
            .is_("clearance_status", "null") \
            .execute()
        
        return {"count": response.count or 0}
        
    except Exception as e:
        print(f"Error counting pending shipments: {e}")
        return {"count": 0}

@router.get("/recent")
def get_recent_shipments(agent_id: int, limit: int = 6):
    """Get recent shipments for specific agent"""
    try:
        response = supabase.table("shipments") \
            .select("*") \
            .eq("agent_id", agent_id) \
            .order("last_excel_upload_at", desc=True) \
            .limit(limit) \
            .execute()
        return response.data or []
    except Exception as e:
        print(f"Error getting recent shipments: {e}")
        return []

@router.get("/{hbl}")
def get_shipment(agent_id: int, hbl: str):
    """Get specific shipment"""
    try:
        response = supabase.table("shipments") \
            .select("*") \
            .eq("agent_id", agent_id) \
            .eq("hbl_number", hbl) \
            .execute()
        return response.data or []
    except Exception as e:
        print(f"Error getting shipment {hbl}: {e}")
        return []

@router.patch("/{hbl}/status")
def update_status(agent_id: int, hbl: str, status: str):
    """Update shipment status"""
    try:
        response = supabase.table("shipments") \
            .update({
                "clearance_status": status,
                "updated_at": datetime.now().isoformat()
            }) \
            .eq("agent_id", agent_id) \
            .eq("hbl_number", hbl) \
            .execute()
        
        return {"updated": bool(response.data)}
    except Exception as e:
        print(f"Error updating status: {e}")
        return {"updated": False}
