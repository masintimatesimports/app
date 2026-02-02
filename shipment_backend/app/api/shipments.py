from fastapi import APIRouter, Query
from app.core.supabase import supabase
from datetime import datetime

router = APIRouter(prefix="/shipments", tags=["Shipments"])

# 1. SPECIFIC ENDPOINTS FIRST
@router.get("/total-count")
def total_shipment_count():
    try:
        response = supabase.table("shipments").select("*", count="exact").execute()
        return {"count": response.count or 0}
    except Exception as e:
        print(f"Error counting total shipments: {e}")
        return {"count": 0}

@router.get("/pending-count")
def pending_shipment_count():
    try:
        response = supabase.table("shipments") \
            .select("*", count="exact") \
            .is_("clearance_status", "null") \
            .execute()
        return {"count": response.count or 0}
    except Exception as e:
        print(f"Error counting pending shipments: {e}")
        return {"count": 0}

@router.get("/standardized-counts")
def get_standardized_counts():
    """Get counts for each standardized_status - FIXED VERSION"""
    try:
        counts = {}
        page = 0
        page_size = 1000
        
        while True:
            # Get data in pages
            response = supabase.table("shipments") \
                .select("standardized_status") \
                .range(page * page_size, (page + 1) * page_size - 1) \
                .execute()
            
            if not response.data or len(response.data) == 0:
                break
            
            # Count statuses in this page
            for shipment in response.data:
                status = shipment.get('standardized_status')
                if status is None:
                    status = "NULL"
                elif status == "":
                    status = "EMPTY"
                counts[status] = counts.get(status, 0) + 1
            
            # If we got less than page_size, we're done
            if len(response.data) < page_size:
                break
                
            page += 1
        
        print(f"DEBUG: Final counts: {counts}")
        return counts
        
    except Exception as e:
        print(f"Error in standardized-counts: {e}")
        return {"ERROR": str(e)}
    
@router.get("/recent")
def get_recent_shipments(agent_id: int = Query(...), limit: int = Query(6, ge=1, le=100)):
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

@router.get("/search")
def search_shipments(
    hbl: str = Query(...),
    agent_id: int = Query(None)
):
    try:
        query = supabase.table("shipments").select("*")
        query = query.ilike("hbl_number", f"%{hbl}%")
        if agent_id is not None:
            query = query.eq("agent_id", agent_id)
        response = query.execute()
        return response.data or []
    except Exception as e:
        print(f"Error searching shipments: {e}")
        return []

# ==================== NEW ENDPOINT ====================
@router.get("/vessel-summary")
def get_vessel_summary():
    """Get vessel summary for pending shipments"""
    try:
        response = supabase.table("shipments") \
            .select("vessel_name, Second_vessel, voyage_no, eta, hbl_number") \
            .eq("standardized_status", "PENDING") \
            .not_.is_("eta", "null") \
            .execute()
        
        if not response.data:
            return []
        
        groups = {}
        today = datetime.now().date()
        
        for shipment in response.data:
            vessel = shipment.get('Second_vessel') or shipment.get('vessel_name')
            voyage = shipment.get('voyage_no')
            hbl = shipment.get('hbl_number')
            eta_str = shipment.get('eta')
            
            if not vessel or not voyage or not eta_str:
                continue
            
            # Parse date
            try:
                if isinstance(eta_str, str):
                    eta_date = datetime.fromisoformat(eta_str.replace('Z', '+00:00')).date()
                elif hasattr(eta_str, 'date'):
                    eta_date = eta_str.date()
                else:
                    continue
            except:
                continue
            
            key = f"{vessel}|{voyage}"
            
            if key not in groups:
                groups[key] = {
                    'vessel': vessel,
                    'voyage': voyage,
                    'count': 0,
                    'etas': []
                }
            
            groups[key]['count'] += 1
            groups[key]['etas'].append(eta_date)
        
        # Process groups
        result = []
        for key, data in groups.items():
            earliest_eta = min(data['etas'])
            days_diff = (earliest_eta - today).days
            
            # Criticality level
            if days_diff < 0:
                criticality = 'critical'
            elif days_diff <= 2:
                criticality = 'high'
            elif days_diff <= 5:
                criticality = 'medium'
            elif days_diff <= 10:
                criticality = 'low'
            else:
                criticality = 'normal'
            
            result.append({
                'vessel': data['vessel'],
                'voyage': data['voyage'],
                'bl_count': data['count'],
                'eta': earliest_eta.isoformat().split('T')[0],
                'days_until_eta': days_diff,
                'criticality': criticality
            })
        
        # Sort: overdue first, then by eta
        result.sort(key=lambda x: (x['days_until_eta'], x['eta']))
        
        return result
        
    except Exception as e:
        print(f"Error getting vessel summary: {e}")
        return []

# 2. PARAMETERIZED/CATCH-ALL ENDPOINTS LAST (KEEP THESE AT THE BOTTOM)
@router.get("/{hbl}")
def get_shipment_by_hbl(
    hbl: str,
    agent_id: int = Query(...)
):
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
    agent_id: int = Query(...),
    status: str = Query(...)
):
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