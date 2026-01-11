FROM python:3.11

WORKDIR /app

COPY shipment_backend/requirements.txt .
RUN pip install -r requirements.txt

COPY shipment_backend/ .

# Use Railway's PORT variable
CMD uvicorn app.main:app --host 0.0.0.0 --port $PORT