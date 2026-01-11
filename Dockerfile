FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Copy requirements and install
COPY shipment_backend/requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy ALL backend code
COPY shipment_backend/ .

# Run from the /app directory (which now has all your code)
WORKDIR /app

# Use the PORT environment variable that Railway provides
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "${PORT:-8000}"]