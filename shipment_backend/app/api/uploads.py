from fastapi import APIRouter, UploadFile, File, Form
from app.services.excel_parser import read_excel
from app.services.shipment_ingest import ingest_sheet
from app.core.supabase import supabase
from datetime import datetime

router = APIRouter(prefix="/uploads", tags=["Uploads"])

@router.post("/excel")
async def upload_excel(
    file: UploadFile = File(...),
    agent_id: int = Form(...),
    sheets: str = Form(...)
):
    sheets = sheets.split(",")
    file_bytes = await file.read()

    res = supabase.table("staging_files").insert({
        "agent_id": agent_id,
        "file_name": file.filename,
        "uploaded_at": datetime.now().isoformat()
    }).execute()

    file_id = res.data[0]["file_id"]
    total, all_errors = 0, []

    for sheet in sheets:
        df = read_excel(file_bytes, sheet)
        processed, errors = ingest_sheet(df, agent_id, sheet)
        total += processed
        all_errors.extend(errors)

    return {"file_id": file_id, "rows_processed": total, "errors": all_errors}

@router.get("/count")
def count_uploads(agent_id: int):
    res = supabase.table("staging_files") \
        .select("file_id", count="exact") \
        .eq("agent_id", agent_id) \
        .execute()
    return {"count": res.count or 0}

@router.get("/latest")
def get_latest_upload(agent_id: int):
    res = supabase.table("staging_files") \
        .select("uploaded_at") \
        .eq("agent_id", agent_id) \
        .order("uploaded_at", desc=True) \
        .limit(1) \
        .execute()
    
    if res.data and len(res.data) > 0:
        return res.data[0]
    return {"uploaded_at": None}


@router.get("/sheets")
def get_available_sheets(agent_id: int):
    """Get list of sheets from recent uploads"""
    try:
        # Get recent uploads and extract unique sheet names
        res = supabase.table("column_mappings") \
            .select("sheet_name") \
            .eq("agent_id", agent_id) \
            .eq("active", True) \
            .execute()
        
        sheets = set()
        for item in res.data or []:
            sheets.add(item["sheet_name"])
        
        return list(sheets)
    except Exception as e:
        print(f"Error getting sheets: {e}")
        return []
