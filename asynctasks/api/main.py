from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from api.database import engine, get_db, session_scope
from api.models import Base, Log, Application, Job, Worker
from api.routes.jobs import router as jobs_router
from fastapi.middleware.cors import CORSMiddleware
import asyncio
from api.routes.webhooks import router as webhooks_router
from api.routes.apps import router as apps_router

Base.metadata.create_all(bind=engine)
app = FastAPI(title="AsyncTasks API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(jobs_router)
app.include_router(webhooks_router)
app.include_router(apps_router)


@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.websocket("/ws/logs/{job_id}")
async def websocket_logs(websocket: WebSocket, job_id: str):
    await websocket.accept()
    try:
        while True:
            with session_scope() as db:
                logs = db.query(Log).filter(Log.job_id == job_id).order_by(Log.created_at.asc()).all()
                log_list = [{"message": l.message, "created_at": l.created_at.isoformat()} for l in logs]
                await websocket.send_json(log_list)
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        print(f"Client disconnected from logs for job {job_id}")

