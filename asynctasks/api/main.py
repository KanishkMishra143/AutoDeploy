from fastapi import FastAPI
from api.database import engine, get_db
from api.models import Base
from api.routes.jobs import router as jobs_router

Base.metadata.create_all(bind=engine)
app = FastAPI(title="AsyncTasks API")
app.include_router(jobs_router)

@app.get("/health")
def health_check():
    return {"status": "healthy"}

