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


@router.get("/pending-operations")
def get_pending_operations():
    """Get pending operations dashboard data"""
    try:
        from datetime import datetime
        
        # Get all pending shipments
        response = supabase.table("shipments") \
            .select("hbl_number, eta, standardized_status, agent_id") \
            .eq("standardized_status", "PENDING") \
            .not_.is_("eta", "null") \
            .execute()
        
        if not response.data:
            return {
                "summary": {"overdue": 0, "arrived": 0, "en_route": 0, "total": 0},
                "priority_heatmap": {},
                "aging_timeline": {}
            }
        
        today = datetime.now().date()
        summary_counts = {"overdue": 0, "arrived": 0, "en_route": 0}
        
        # Store data for categorization
        overdue_items = []
        arrived_items = []
        en_route_items = []
        
        for shipment in response.data:
            try:
                eta_str = shipment.get('eta')
                if isinstance(eta_str, str):
                    eta_date = datetime.fromisoformat(eta_str.replace('Z', '+00:00')).date()
                elif hasattr(eta_str, 'date'):
                    eta_date = eta_str.date()
                else:
                    continue
                
                days_diff = (today - eta_date).days
                hbl = shipment.get('hbl_number')
                agent_id = shipment.get('agent_id')
                
                # Categorize
                if days_diff > 0:  # ETA in past (overdue)
                    summary_counts["overdue"] += 1
                    overdue_items.append({
                        "hbl": hbl,
                        "days_overdue": days_diff,
                        "agent_id": agent_id
                    })
                elif days_diff == 0:  # ETA today (arrived today)
                    summary_counts["arrived"] += 1
                    arrived_items.append({
                        "hbl": hbl,
                        "days_overdue": 0,
                        "agent_id": agent_id
                    })
                else:  # ETA in future (en route)
                    summary_counts["en_route"] += 1
                    en_route_items.append({
                        "hbl": hbl,
                        "days_until_eta": abs(days_diff),
                        "agent_id": agent_id
                    })
                    
            except Exception as e:
                print(f"Error processing shipment: {e}")
                continue
        
        total = sum(summary_counts.values())
        
        # Priority Heatmap Calculation
        priority_counts = {
            "critical": {"count": 0, "items": []},
            "high": {"count": 0, "items": []},
            "medium": {"count": 0, "items": []},
            "low": {"count": 0, "items": []}
        }
        
        # Process overdue items for priority
        for item in overdue_items:
            days = item["days_overdue"]
            
            if days > 7:
                priority_counts["critical"]["count"] += 1
                priority_counts["critical"]["items"].append(item)
            elif days >= 4:
                priority_counts["high"]["count"] += 1
                priority_counts["high"]["items"].append(item)
            elif days >= 1:
                priority_counts["medium"]["count"] += 1
                priority_counts["medium"]["items"].append(item)
            # days = 0 (arrived today) goes to low priority
        
        # Add arrived today items to low priority
        priority_counts["low"]["count"] = summary_counts["arrived"] + summary_counts["en_route"]
        priority_counts["low"]["items"] = arrived_items + en_route_items
        
        # Get sample items (max 3 per category)
        for category in priority_counts:
            items = priority_counts[category]["items"]
            priority_counts[category]["sample"] = items[:3] if len(items) > 3 else items
        
        # Aging Timeline Calculation
        aging_timeline = {
            "0_3": 0,    # 0-3 days overdue
            "4_7": 0,    # 4-7 days overdue
            "8_14": 0,   # 8-14 days overdue
            "15_30": 0,  # 15-30 days overdue
            "30_plus": 0 # 30+ days overdue
        }
        
        for item in overdue_items:
            days = item["days_overdue"]
            if days <= 3:
                aging_timeline["0_3"] += 1
            elif days <= 7:
                aging_timeline["4_7"] += 1
            elif days <= 14:
                aging_timeline["8_14"] += 1
            elif days <= 30:
                aging_timeline["15_30"] += 1
            else:
                aging_timeline["30_plus"] += 1
        
        # Agent distribution
        agent_counts = {}
        all_items = overdue_items + arrived_items + en_route_items
        for item in all_items:
            agent_id = item.get("agent_id")
            if agent_id:
                agent_counts[agent_id] = agent_counts.get(agent_id, 0) + 1
        
        return {
            "summary": {
                **summary_counts,
                "total": total
            },
            "priority_heatmap": priority_counts,
            "aging_timeline": aging_timeline,
            "agent_distribution": agent_counts
        }
        
    except Exception as e:
        print(f"Error in pending-operations: {e}")
        return {"error": str(e)}

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