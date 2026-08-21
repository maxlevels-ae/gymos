FROM python:3.12-slim

WORKDIR /svc
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY discover.py .

EXPOSE 8081
# --host 0.0.0.0 so the ERP container can reach it; keep it on the LAN only.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8081"]
