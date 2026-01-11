# Start with official Python 3.11 image
FROM python:3.11-slim

# Set working directory inside container
WORKDIR /app

# Copy requirements file first (for better caching)
COPY shipment_backend/requirements.txt .

# Install all Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy the rest of your backend code
COPY shipment_backend/ ./shipment_backend/

# Set WORKDIR to shipment_backend folder
WORKDIR /app/shipment_backend

# Expose port 8000 (FastAPI default)
EXPOSE 8000

# Command to run your app - NO 'cd' needed!
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]