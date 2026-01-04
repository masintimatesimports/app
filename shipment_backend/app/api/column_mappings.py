from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Dict
import logging
from app.core.supabase import supabase
from datetime import datetime

router = APIRouter(prefix="/mappings", tags=["Column Mappings"])


class MappingPayload(BaseModel):
    agent_id: int = Field(..., gt=0)
    sheet_name: str
    mappings: Dict[str, str]


def _sanitize_mappings(raw: Dict[str, str]):
    clean = {}
    for k, v in (raw or {}).items():
        if v is None:
            continue
        s = str(v).strip()
        if s == "" or s.lower() == "none":
            continue
        clean[k] = s
    return clean


@router.post("/")
def save_mapping(payload: MappingPayload):
    agent_id = int(payload.agent_id)
    sheet_name = payload.sheet_name
    mappings = _sanitize_mappings(payload.mappings)

    if not mappings:
        raise HTTPException(status_code=422, detail="No mappings provided after sanitization")

    try:
        # delete all previous mappings for this agent+sheet (they're being replaced)
        supabase.table("column_mappings") \
            .delete() \
            .eq("agent_id", agent_id) \
            .eq("sheet_name", sheet_name) \
            .execute()

        now = datetime.now().isoformat()
        rows = [{
            "agent_id": agent_id,
            "sheet_name": sheet_name,
            "standard_column_name": std,
            "excel_column_name": excel,
            "active": True,
            "created_at": now,
            "updated_at": now
        } for std, excel in mappings.items()]

        if rows:
            res = supabase.table("column_mappings").insert(rows).execute()
            # check for errors in supabase response if available
            if hasattr(res, 'error') and res.error:
                logging.error("Supabase insert error: %s", res.error)
                raise Exception(res.error)

        return {"saved": True}
    except HTTPException:
        raise
    except Exception as e:
        logging.exception("Error saving mappings")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/")
def get_mappings(agent_id: int, sheet_name: str):
    res = supabase.table("column_mappings") \
        .select("*") \
        .eq("agent_id", agent_id) \
        .eq("sheet_name", sheet_name) \
        .eq("active", True) \
        .execute()

    data = res.data or []
    # return as dict: standard_column_name -> excel_column_name
    return {item["standard_column_name"]: item["excel_column_name"] for item in data}
