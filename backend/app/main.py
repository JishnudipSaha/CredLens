"""CredLens FastAPI application entry point.

Wires up:
- Layer 1 /api/v1/ingest/*
- Layer 2 /api/v1/score/*
- Layer 3 /api/v1/decisions/*
- Layer 4 (cross-cutting) - auth, CORS, request logging, monitoring
- Feedback loop /api/v1/feedback
- Admin /api/v1/admin/*  (users, policies, audit log, model monitor)
- Government /api/v1/government/*
- Auth /api/v1/auth/*
"""
from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.api import admin as admin_api
from app.api import auth as auth_api
from app.api import decision as decision_api
from app.api import feedback as feedback_api
from app.api import government as government_api
from app.api import ingestion as ingestion_api
from app.api import msme as msme_api
from app.api import scoring as scoring_api
from app.config import settings
from app.core.logging import configure_logging
from app.database import Base, SessionLocal, engine
from app.models.audit_log import AuditAction, AuditLog


log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    log.info("Starting %s v%s", settings.app_name, settings.version)

    # Create tables
    Base.metadata.create_all(engine)

    # Auto-seed on first run
    from app.seed import seed_all
    seed_all()

    yield
    log.info("Shutting down")


app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description=(
        "AI Powered MSME Credit Intelligence Platform.\n\n"
        "**Layer 1** Ingestion  -  **Layer 2** AI & Analytics  -  "
        "**Layer 3** Decision Engine  -  **Layer 4** Platform Infrastructure."
    ),
    lifespan=lifespan,
)


# ---------- Layer 4 - Security: CORS ----------

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Layer 4 - Monitoring & Logging: request-level audit middleware ----------

@app.middleware("http")
async def audit_request_middleware(request: Request, call_next):
    started = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = int((time.perf_counter() - started) * 1000)
    response.headers["X-Response-Time-ms"] = str(elapsed_ms)

    # Don't log health checks or static noise
    path = request.url.path
    if path in ("/", "/health", "/favicon.ico", "/docs", "/openapi.json", "/redoc"):
        return response

    # Best-effort: log to DB if a JWT user id is present
    try:
        auth_header = request.headers.get("authorization", "")
        if auth_header.lower().startswith("bearer "):
            from app.core.security import decode_token
            payload = decode_token(auth_header.split(" ", 1)[1])
            user_id = int(payload.get("sub")) if payload.get("sub") else None
        else:
            user_id = None
        if user_id is not None:
            with SessionLocal() as db:
                AuditLog.log(
                    db,
                    action=AuditAction.INGEST,  # generic - actual action is in API log
                    actor_user_id=user_id,
                    endpoint=f"{request.method} {path}",
                    status_code=response.status_code,
                    latency_ms=elapsed_ms,
                    details={},
                )
                db.commit()
    except Exception:
        # Never let monitoring break the response
        pass

    log.info("request", extra={"ctx_method": request.method, "ctx_path": path,
                               "ctx_status": response.status_code, "ctx_ms": elapsed_ms})
    return response


# ---------- global exception handler ----------

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    log.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "type": type(exc).__name__},
    )


# ---------- health ----------

@app.get("/", tags=["meta"])
def root() -> dict:
    return {
        "name": settings.app_name,
        "version": settings.version,
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health", tags=["meta"])
def health() -> dict:
    return {"status": "ok"}


# ---------- routers ----------

API_PREFIX = "/api/v1"
app.include_router(auth_api.router, prefix=API_PREFIX)
app.include_router(msme_api.router, prefix=API_PREFIX)
app.include_router(ingestion_api.router, prefix=API_PREFIX)
app.include_router(scoring_api.router, prefix=API_PREFIX)
app.include_router(decision_api.router, prefix=API_PREFIX)
app.include_router(feedback_api.router, prefix=API_PREFIX)
app.include_router(admin_api.router, prefix=API_PREFIX)
app.include_router(government_api.router, prefix=API_PREFIX)
