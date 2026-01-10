from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import uploads, shipments, column_mappings, shipment_fields, agents  # Add agents here

app = FastAPI(title="Shipment Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(uploads.router)
app.include_router(shipments.router)
app.include_router(column_mappings.router)
app.include_router(shipment_fields.router)
app.include_router(agents.router)  # Add this line