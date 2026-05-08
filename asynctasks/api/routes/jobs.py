from fastapi import APIRouter, HTTPException, Query, Depends
from sqlalchemy.orm import Session
from typing import List
from api.database import get_db
from api.models import Job
from api.schemas import JobCreate, JobResponse, JobListResponse, JobLogsResponse
from worker.tasks import process_job
from uuid import UUID

router = APIRouter()

@router.post("/jobs", response_model=JobResponse)
def create_job(job: JobCreate, db: Session = Depends(get_db)):    
    new_job = Job(
        type=job.type,
        status="queued",
        payload=job.payload
    )
    db.add(new_job)
    db.commit()
    db.refresh(new_job)

    process_job.delay(str(new_job.id))

    return new_job



@router.get("/jobs", response_model=JobListResponse)
def list_jobs(skip: int = 0, limit: int = 10, db: Session = Depends(get_db)):
    total = db.query(Job).count()
    jobs = db.query(Job).offset(skip).limit(limit).all()
    return {"total": total, "jobs": jobs}

@router.get("/jobs/{job_id}", response_model=JobResponse)
def get_job(job_id: UUID, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@router.get("/jobs/{job_id}/logs", response_model=JobLogsResponse)
def get_job_logs(job_id: UUID, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return {"job_id": job.id, "logs": job.logs}