from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from app.core.supabase import supabase

router = APIRouter(prefix="/agents", tags=["Agents"])

# ====================
# Pydantic Models
# ====================
class AgentCreate(BaseModel):
    agent_code: str
    agent_name: str
    agent_role_id: Optional[int] = None
    mode_type_id: Optional[int] = None
    specialization_id: Optional[int] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    address: Optional[str] = None

class AgentUpdate(BaseModel):
    agent_name: Optional[str] = None
    agent_role_id: Optional[int] = None
    mode_type_id: Optional[int] = None
    specialization_id: Optional[int] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    address: Optional[str] = None
    active: Optional[bool] = None  # Changed from is_active to active

class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None
    sort_order: int = 0

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None

# ====================
# Agent CRUD Endpoints
# ====================
@router.get("/", response_model=List[dict])
def get_agents(active: bool = True):  # Changed parameter name
    """Get all agents with their category names"""
    try:
        # Get agents
        query = supabase.table("agents").select("*")
        if active is not None:
            query = query.eq("active", active)  # Changed from is_active to active
        agents_res = query.order("agent_name").execute()
        agents = agents_res.data or []
        
        # Get all categories for lookup
        roles = {}
        modes = {}
        specs = {}
        
        try:
            roles_res = supabase.table("agent_roles").select("*").eq("is_active", True).execute()
            roles = {r["role_id"]: r for r in (roles_res.data or [])}
        except:
            pass  # Table might not exist yet
            
        try:
            modes_res = supabase.table("mode_types").select("*").eq("is_active", True).execute()
            modes = {m["mode_id"]: m for m in (modes_res.data or [])}
        except:
            pass
            
        try:
            specs_res = supabase.table("specializations").select("*").eq("is_active", True).execute()
            specs = {s["spec_id"]: s for s in (specs_res.data or [])}
        except:
            pass
        
        # Enrich agents with category names
        for agent in agents:
            agent["agent_role"] = roles.get(agent.get("agent_role_id"))
            agent["mode_type"] = modes.get(agent.get("mode_type_id"))
            agent["specialization"] = specs.get(agent.get("specialization_id"))
        
        return agents
        
    except Exception as e:
        print(f"Error getting agents: {e}")
        return []

@router.post("/", response_model=dict)
def create_agent(payload: AgentCreate):
    # Check if agent_code already exists
    existing = supabase.table("agents").select("*").eq("agent_code", payload.agent_code).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Agent code already exists")
    
    now = datetime.now().isoformat()
    agent_data = {
        "agent_code": payload.agent_code,
        "agent_name": payload.agent_name,
        "active": True,  # Changed from is_active to active
        "created_at": now,
        "updated_at": now
    }
    
    # Add optional fields if provided
    if payload.agent_role_id is not None:
        agent_data["agent_role_id"] = payload.agent_role_id
    if payload.mode_type_id is not None:
        agent_data["mode_type_id"] = payload.mode_type_id
    if payload.specialization_id is not None:
        agent_data["specialization_id"] = payload.specialization_id
    if payload.contact_email:
        agent_data["contact_email"] = payload.contact_email
    if payload.contact_phone:
        agent_data["contact_phone"] = payload.contact_phone
    if payload.address:
        agent_data["address"] = payload.address
    
    res = supabase.table("agents").insert(agent_data).execute()
    return res.data[0] if res.data else {}

@router.get("/{agent_id}", response_model=dict)
def get_agent(agent_id: int):
    try:
        # Get agent
        agent_res = supabase.table("agents").select("*").eq("agent_id", agent_id).execute()
        if not agent_res.data:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        agent = agent_res.data[0]
        
        # Get categories for this agent (if tables exist)
        try:
            if agent.get("agent_role_id"):
                role_res = supabase.table("agent_roles").select("*").eq("role_id", agent["agent_role_id"]).execute()
                agent["agent_role"] = role_res.data[0] if role_res.data else None
        except:
            agent["agent_role"] = None
            
        try:
            if agent.get("mode_type_id"):
                mode_res = supabase.table("mode_types").select("*").eq("mode_id", agent["mode_type_id"]).execute()
                agent["mode_type"] = mode_res.data[0] if mode_res.data else None
        except:
            agent["mode_type"] = None
            
        try:
            if agent.get("specialization_id"):
                spec_res = supabase.table("specializations").select("*").eq("spec_id", agent["specialization_id"]).execute()
                agent["specialization"] = spec_res.data[0] if spec_res.data else None
        except:
            agent["specialization"] = None
        
        return agent
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting agent {agent_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error retrieving agent: {str(e)}")

@router.patch("/{agent_id}", response_model=dict)
def update_agent(agent_id: int, payload: AgentUpdate):
    updates = payload.dict(exclude_unset=True)
    if updates:
        updates["updated_at"] = datetime.now().isoformat()
        res = supabase.table("agents").update(updates).eq("agent_id", agent_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Agent not found")
        return res.data[0]
    raise HTTPException(status_code=400, detail="No updates provided")

@router.delete("/{agent_id}")
def delete_agent(agent_id: int):
    """Soft delete - set active to False"""
    updates = {
        "active": False,  # Changed from is_active to active
        "updated_at": datetime.now().isoformat()
    }
    res = supabase.table("agents").update(updates).eq("agent_id", agent_id).execute()
    return {"deleted": bool(res.data)}

# ====================
# Category Management Endpoints
# ====================

# Agent Roles
@router.get("/roles/", response_model=List[dict])
def get_agent_roles(is_active: bool = True):
    try:
        query = supabase.table("agent_roles").select("*")
        if is_active is not None:
            query = query.eq("is_active", is_active)
        res = query.order("sort_order").execute()
        return res.data or []
    except Exception as e:
        print(f"Error getting roles: {e}")
        return []

@router.post("/roles/", response_model=dict)
def create_agent_role(payload: CategoryCreate):
    try:
        existing = supabase.table("agent_roles").select("*").eq("role_name", payload.name).execute()
        if existing.data:
            raise HTTPException(status_code=400, detail="Role name already exists")
    except:
        pass  # Table might not exist yet
    
    now = datetime.now().isoformat()
    try:
        res = supabase.table("agent_roles").insert({
            "role_name": payload.name,
            "description": payload.description,
            "sort_order": payload.sort_order,
            "created_at": now,
            "updated_at": now
        }).execute()
        return res.data[0] if res.data else {}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating role: {str(e)}")

# Mode Types
@router.get("/modes/", response_model=List[dict])
def get_mode_types(is_active: bool = True):
    try:
        query = supabase.table("mode_types").select("*")
        if is_active is not None:
            query = query.eq("is_active", is_active)
        res = query.order("sort_order").execute()
        return res.data or []
    except Exception as e:
        print(f"Error getting modes: {e}")
        return []

@router.post("/modes/", response_model=dict)
def create_mode_type(payload: CategoryCreate):
    try:
        existing = supabase.table("mode_types").select("*").eq("mode_name", payload.name).execute()
        if existing.data:
            raise HTTPException(status_code=400, detail="Mode name already exists")
    except:
        pass
    
    now = datetime.now().isoformat()
    try:
        res = supabase.table("mode_types").insert({
            "mode_name": payload.name,
            "description": payload.description,
            "sort_order": payload.sort_order,
            "created_at": now,
            "updated_at": now
        }).execute()
        return res.data[0] if res.data else {}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating mode: {str(e)}")

# Specializations
@router.get("/specializations/", response_model=List[dict])
def get_specializations(is_active: bool = True):
    try:
        query = supabase.table("specializations").select("*")
        if is_active is not None:
            query = query.eq("is_active", is_active)
        res = query.order("sort_order").execute()
        return res.data or []
    except Exception as e:
        print(f"Error getting specializations: {e}")
        return []

@router.post("/specializations/", response_model=dict)
def create_specialization(payload: CategoryCreate):
    try:
        existing = supabase.table("specializations").select("*").eq("spec_name", payload.name).execute()
        if existing.data:
            raise HTTPException(status_code=400, detail="Specialization name already exists")
    except:
        pass
    
    now = datetime.now().isoformat()
    try:
        res = supabase.table("specializations").insert({
            "spec_name": payload.name,
            "description": payload.description,
            "sort_order": payload.sort_order,
            "created_at": now,
            "updated_at": now
        }).execute()
        return res.data[0] if res.data else {}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating specialization: {str(e)}")

# Update category endpoints
@router.patch("/roles/{role_id}", response_model=dict)
def update_agent_role(role_id: int, payload: CategoryUpdate):
    return update_category("agent_roles", "role_id", role_id, payload)

@router.patch("/modes/{mode_id}", response_model=dict)
def update_mode_type(mode_id: int, payload: CategoryUpdate):
    return update_category("mode_types", "mode_id", mode_id, payload)

@router.patch("/specializations/{spec_id}", response_model=dict)
def update_specialization(spec_id: int, payload: CategoryUpdate):
    return update_category("specializations", "spec_id", spec_id, payload)

def update_category(table: str, id_field: str, item_id: int, payload: CategoryUpdate):
    updates = payload.dict(exclude_unset=True)
    
    # Map 'name' field to the correct column name for each table
    if 'name' in updates:
        if table == 'agent_roles':
            updates['role_name'] = updates.pop('name')
        elif table == 'mode_types':
            updates['mode_name'] = updates.pop('name')
        elif table == 'specializations':
            updates['spec_name'] = updates.pop('name')
    
    if updates:
        updates["updated_at"] = datetime.now().isoformat()
        try:
            res = supabase.table(table).update(updates).eq(id_field, item_id).execute()
            if not res.data:
                raise HTTPException(status_code=404, detail="Item not found")
            return res.data[0]
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error updating category: {str(e)}")
    raise HTTPException(status_code=400, detail="No updates provided")