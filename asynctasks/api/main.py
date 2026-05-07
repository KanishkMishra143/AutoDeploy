from fastapi import FastAPI
from api.database import engine
from api.models import Base
from api.routes.jobs import router as jobs_router

Base.metadata.create_all(bind=engine)
app = FastAPI()
app.include_router(jobs_router)


@app.get("/")
def root():
    return {"status": "running"}