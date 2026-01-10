from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import uploads, shipments, column_mappings, shipment_fields, agents
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

app = FastAPI(title="Shipment Backend")

# Get frontend URL from environment or default
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url],  # Dynamic origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(uploads.router)
app.include_router(shipments.router)
app.include_router(column_mappings.router)
app.include_router(shipment_fields.router)
app.include_router(agents.router)

# Add health check endpoint
@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "shipment-backend"}