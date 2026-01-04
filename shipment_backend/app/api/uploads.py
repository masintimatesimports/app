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
