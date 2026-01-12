from fastapi import APIRouter, Query, HTTPException
from app.core.supabase import supabase
from datetime import datetime

router = APIRouter(prefix="/shipments", tags=["Shipments"])

@router.get("/total-count")
def total_shipment_count():
    """Count ALL shipments - using COUNT(*) SQL"""
    try:
        response = supabase.table("shipments").select("*", count="exact").execute()
        return {"count": response.count or 0}
    except Exception as e:
        print(f"Error counting total shipments: {e}")
        return {"count": 0}

@router.get("/pending-count")
def pending_shipment_count():
    """Count ALL shipments without clearance status"""
    try:
        response = supabase.table("shipments") \
            .select("*", count="exact") \
            .is_("clearance_status", "null") \
            .execute()
        return {"count": response.count or 0}
    except Exception as e:
        print(f"Error counting pending shipments: {e}")
        return {"count": 0}

@router.get("/recent")
def get_recent_shipments(agent_id: int = Query(...), limit: int = Query(6, ge=1, le=100)):
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

# FIXED: This is the correct way to make agent_id optional
@router.get("/search")
def search_shipments(
    hbl: str = Query(..., description="HBL number to search"),
    agent_id: int = Query(None, description="Optional agent ID filter")
):
    """Search shipments by HBL number across agents"""
    try:
        query = supabase.table("shipments").select("*")
        
        # Add HBL filter
        query = query.ilike("hbl_number", f"%{hbl}%")
        
        # Add agent filter if provided
        if agent_id is not None:  # Check if agent_id is not None
            query = query.eq("agent_id", agent_id)
        
        response = query.execute()
        
        return response.data or []
        
    except Exception as e:
        print(f"Error searching shipments: {e}")
        return []

# KEEP ONLY ONE /{hbl} endpoint - remove the duplicate!
@router.get("/{hbl}")
def get_shipment_by_hbl(
    hbl: str,
    agent_id: int = Query(..., description="Agent ID")
):
    """Get specific shipment for a specific agent"""
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
def update_status(
    hbl: str,
    agent_id: int = Query(..., description="Agent ID"),
    status: str = Query(..., description="New clearance status")
):
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