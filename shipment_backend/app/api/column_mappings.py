from fastapi import APIRouter
from app.core.supabase import supabase
from datetime import datetime

router = APIRouter(prefix="/mappings", tags=["Column Mappings"])

@router.post("/")
def save_mapping(agent_id: int, sheet_name: str, mappings: dict):
    supabase.table("column_mappings")         .update({"active": False})         .eq("agent_id", agent_id)         .eq("sheet_name", sheet_name)         .execute()

    now = datetime.now().isoformat()
    rows = [{
        "agent_id": agent_id,
        "sheet_name": sheet_name,
        "standard_column_name": std,
        "excel_column_name": excel,
        "active": True,
        "created_at": now
    } for std, excel in mappings.items()]

    supabase.table("column_mappings").insert(rows).execute()
    return {"saved": True}
