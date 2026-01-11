FROM python:3.11-slim

# Debug: List directory structure
RUN ls -la

WORKDIR /app

# Copy requirements
COPY shipment_backend/requirements.txt .
RUN cat requirements.txt  # Debug: Show requirements
RUN pip install -r requirements.txt

# Copy backend code
COPY shipment_backend/ .

# Debug: Show what was copied
RUN find /app -type f -name "*.py" | head -20

# Run with simple shell command
CMD ["sh", "-c", "cd /app && pwd && ls -la && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]