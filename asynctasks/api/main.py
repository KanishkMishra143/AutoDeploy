import os
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from core.database import engine, get_db, session_scope
from core.models import Base, Log, Application, Job, Worker
from api.routes.jobs import router as jobs_router
from fastapi.middleware.cors import CORSMiddleware
import asyncio
from datetime import datetime
from api.routes.webhooks import router as webhooks_router
from api.routes.apps import router as apps_router
from api.routes.auth import router as auth_router

Base.metadata.create_all(bind=engine)
ENABLE_API_DOCS = os.getenv("ENABLE_API_DOCS", "false").lower() == "true"
app = FastAPI(
    title="AsyncTasks API",
    docs_url="/docs" if ENABLE_API_DOCS else None,
    redoc_url="/redoc" if ENABLE_API_DOCS else None,
    openapi_url="/openapi.json" if ENABLE_API_DOCS else None,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://auto-deploy.tech",
        "https://www.auto-deploy.tech",
        "http://localhost:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(jobs_router)
app.include_router(webhooks_router)
app.include_router(apps_router)
app.include_router(auth_router)


@app.on_event("startup")
async def startup_event():
    """Trigger maintenance sweep on startup to clean up any 'ghost' state."""
    from worker.tasks import maintenance_sweep
    print("API STARTUP: Triggering global maintenance sweep...")
    maintenance_sweep.delay()


@app.get("/health")
def health_check():
    return {"status": "healthy"}

from core.auth import get_current_user, verify_token
from core.redis import async_redis_client
import json

@app.websocket("/ws/logs/{job_id}")
async def websocket_logs(websocket: WebSocket, job_id: str):
    # 🔐 WEBSOCKET AUTHENTICATION
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001)
        return

    user_id = None

    # 1. Check for API Key (CLI)
    if token.startswith("ad_live_"):
        import hashlib
        from core.models import APIKey
        key_hash = hashlib.sha256(token.encode()).hexdigest()
        with session_scope() as db:
            api_key = db.query(APIKey).filter(APIKey.key_hash == key_hash).first()
            if api_key:
                user_id = str(api_key.user_id)

    # 2. Fallback to JWT (Dashboard)
    if not user_id:
        payload = verify_token(token)
        if payload:
            user_id = payload["sub"]

    if not user_id:
        await websocket.close(code=4001)
        return

    await websocket.accept()

    # 1. INITIAL HISTORY: Send all existing logs from the database once
    with session_scope() as db:
        # First, check if this is an Application ID by mistake
        is_app = db.query(Application).filter(Application.id == job_id).first()
        if is_app:
            await websocket.send_json([{"message": "❌ ERROR: You provided an APPLICATION ID. This endpoint requires a JOB ID (Build ID).", "created_at": datetime.utcnow().isoformat()}])
            await websocket.close()
            return

        job = db.query(Job).filter(Job.id == job_id, Job.owner_id == user_id).first()
        if not job:
            await websocket.send_json([{"message": "🚨 Access Denied: Job not found or you do not have permission.", "created_at": datetime.utcnow().isoformat()}])
            await websocket.close()
            return

        logs = db.query(Log).filter(Log.job_id == job_id).order_by(Log.created_at.asc()).all()
        history = [{"message": l.message, "created_at": l.created_at.isoformat()} for l in logs]
        await websocket.send_json(history)

    # 2. REAL-TIME STREAMING: Subscribe to Redis channel for this job
    pubsub = async_redis_client.pubsub()
    await pubsub.subscribe(f"logs:{job_id}")

    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                # Message is already a JSON string from the worker
                log_data = json.loads(message["data"])
                # Send as a list to maintain compatibility with the frontend expected format
                await websocket.send_json([log_data])

    except WebSocketDisconnect:
        print(f"Client disconnected from logs for job {job_id}")
    finally:
        await pubsub.unsubscribe(f"logs:{job_id}")
        await pubsub.close()
