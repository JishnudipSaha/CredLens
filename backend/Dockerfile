# CredLens backend - production image
FROM python:3.13-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# System deps for building bcrypt / cryptography wheels
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
# data/ is created at runtime by the app
RUN mkdir -p ./data ./app/ml/artifacts

# Train the synthetic model at build time so the image is self-contained
RUN python -c "from app.ml import train_synthetic; train_synthetic.train_and_save()" || true

EXPOSE 8000

# In production: no --reload, multiple workers for concurrency
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2", "--proxy-headers", "--forwarded-allow-ips", "*"]
