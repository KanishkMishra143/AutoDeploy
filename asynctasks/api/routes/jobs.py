from fastapi import APIRouter, HTTPException, Query, Depends
from sqlalchemy.orm import Session
from typing import List, Optional
from api.database import get_db
from api.models import Job, Worker
from api.schemas import JobCreate, JobResponse, JobListResponse, JobLogsResponse
from worker.tasks import process_job, stop_job
from uuid import UUID
from datetime import datetime, timedelta

router = APIRouter()

@router.post("/jobs/{job_id}/rerun", response_model=JobResponse)
def rerun_job(job_id: UUID, db: Session = Depends(get_db)):
    """Creates a new job using the payload of an existing job (Rollback/Restore)."""
    old_job = db.query(Job).filter(Job.id == job_id).first()
    if not old_job:
        raise HTTPException(status_code=404, detail="Original job not found")

    # Calculate version number of the old job for better UX
    old_version_number = db.query(Job).filter(
        Job.app_id == old_job.app_id,
        Job.created_at <= old_job.created_at
    ).count()
    
    new_job = Job(
        app_id=old_job.app_id,
        type=old_job.type,
        status="queued",
        trigger_reason="Rollback",
        trigger_metadata={
            "from_job_id": str(job_id),
            "from_version": old_version_number
        },
        payload=old_job.payload
    )
    db.add(new_job)
    db.commit()
    db.refresh(new_job)
    
    process_job.delay(str(new_job.id))
    return new_job

@router.delete("/jobs/{job_id}", response_model=JobResponse)
def delete_job(job_id: UUID, db: Session = Depends(get_db)):
    """Triggers the termination of a running job/service."""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    stop_job.delay(str(job_id))
    return job

@router.post("/jobs", response_model=JobResponse)
def create_job(job: JobCreate, db: Session = Depends(get_db)):    
    new_job = Job(
        app_id=job.app_id,
        type=job.type,
        status="queued",
        trigger_reason=job.trigger_reason or "Manual",
        trigger_metadata=job.trigger_metadata,
        payload=job.payload
    )
    db.add(new_job)
    db.commit()
    db.refresh(new_job)
    process_job.delay(str(new_job.id))
    return new_job

@router.get("/jobs", response_model=JobListResponse)
def list_jobs(app_id: Optional[UUID] = None, skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    """Lists jobs with optional filtering by Application."""
    query = db.query(Job)
    if app_id:
        query = query.filter(Job.app_id == app_id)
        
    total = query.count()
    jobs = query.order_by(Job.created_at.desc()).offset(skip).limit(limit).all()
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

@router.get("/workers")
def list_workers(db: Session = Depends(get_db)):
    threshold = datetime.utcnow() - timedelta(seconds=10)
    workers = db.query(Worker).filter(Worker.last_heartbeat > threshold).all()
    return {
        "count": len(workers),
        "workers": workers
    }
