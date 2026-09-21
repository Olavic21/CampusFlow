FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Contexte de build : dossier backend/  (cf. backend/docker-compose.yml)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# Point d'entrée réel de l'API : app/main.py (backend/app/main.py → app.main:app)
# --workers 1 : obligatoire (simulateur de capteurs + hub WebSocket en mémoire)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
