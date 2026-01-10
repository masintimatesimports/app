from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import uploads, shipments, column_mappings, shipment_fields, agents
import os

app = FastAPI(title="Shipment Backend", version="1.0.0")

# CORS Configuration
# Allow both localhost for development and your Render frontend
allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

# Add Render frontend URL dynamically
frontend_url = os.getenv("FRONTEND_URL")
if frontend_url:
    allowed_origins.append(frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(uploads.router)
app.include_router(shipments.router)
app.include_router(column_mappings.router)
app.include_router(shipment_fields.router)
app.include_router(agents.router)

# Health check endpoint
@app.get("/health")
async def health_check():
    return {
        "status": "healthy", 
        "service": "shipment-backend",
        "version": "1.0.0"
    }

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "Shipment Backend API",
        "docs": "/docs",
        "health": "/health"
    }