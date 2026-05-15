from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Query, Depends
from sqlalchemy.orm import Session
from typing import List, Optional
from core.database import get_db
from core.models import Job, Worker, Application, AppAccess
from core.schemas import JobCreate, JobResponse, JobListResponse, JobLogsResponse
from worker.tasks import process_job, stop_job
from uuid import UUID
from core.auth import get_current_user

router = APIRouter(dependencies=[Depends(get_current_user)])

def check_job_access(job_id: UUID, user_id: str, db: Session, required_role: str = "VIEWER"):
    """Verifies if a user has access to a job via its parent application."""
    user_uuid = UUID(user_id)
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if not job.app_id:
        # Standalone job? Check owner_id
        if job.owner_id != user_uuid:
            raise HTTPException(status_code=403, detail="Access denied")
        return job
    
    # Check app access
    from api.routes.apps import get_app_with_access
    get_app_with_access(job.app_id, user_id, db, required_role=required_role)
    return job

@router.post("/jobs/{job_id}/rerun", response_model=JobResponse)
def rerun_job(job_id: UUID, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Creates a new job using the payload of an existing job (Rollback/Restore)."""
    # Rerunning (Rollback) requires ADMIN role
    old_job = check_job_access(job_id, current_user["sub"], db, required_role="ADMIN")

    # Calculate version number of the old job for better UX
    old_version_number = db.query(Job).filter(
        Job.app_id == old_job.app_id,
        Job.created_at <= old_job.created_at
    ).count()
    
    new_job = Job(
        app_id=old_job.app_id,
        owner_id=current_user["sub"],
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
def delete_job(job_id: UUID, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Triggers the termination of a running job/service."""
    # Stopping a job requires ADMIN role
    job = check_job_access(job_id, current_user["sub"], db, required_role="ADMIN")
    
    stop_job.delay(str(job_id))
    return job

@router.post("/jobs", response_model=JobResponse)
def create_job(job: JobCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if job.app_id:
        from api.routes.apps import get_app_with_access
        get_app_with_access(job.app_id, current_user["sub"], db, required_role="ADMIN")
        
    new_job = Job(
        app_id=job.app_id,
        owner_id=current_user["sub"],
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
def list_jobs(app_id: Optional[UUID] = None, skip: int = 0, limit: int = 50, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Lists jobs with filtering by Application and access."""
    user_uuid = UUID(current_user["sub"])
    
    if app_id:
        from api.routes.apps import get_app_with_access
        get_app_with_access(app_id, current_user["sub"], db)
        query = db.query(Job).filter(Job.app_id == app_id)
    else:
        # Get all apps user has access to
        owned_app_ids = db.query(Application.id).filter(Application.owner_id == user_uuid).all()
        shared_app_ids = db.query(AppAccess.app_id).filter(AppAccess.user_id == user_uuid).all()
        app_ids = [r[0] for r in owned_app_ids] + [r[0] for r in shared_app_ids]
        query = db.query(Job).filter(Job.app_id.in_(app_ids))
        
    total = query.count()
    jobs = query.order_by(Job.created_at.desc()).offset(skip).limit(limit).all()
    
    for i, job in enumerate(jobs):
        job.build_number = total - skip - i
        
    return {"total": total, "jobs": jobs}

@router.get("/jobs/{job_id}", response_model=JobResponse)
def get_job(job_id: UUID, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    job = check_job_access(job_id, current_user["sub"], db)
    
    # Calculate build number for this specific job
    if job.app_id:
        job.build_number = db.query(Job).filter(
            Job.app_id == job.app_id,
            Job.created_at <= job.created_at
        ).count()
        
    return job

@router.get("/jobs/{job_id}/logs", response_model=JobLogsResponse)
def get_job_logs(job_id: UUID, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    job = check_job_access(job_id, current_user["sub"], db)
    return {"job_id": job.id, "logs": job.logs}

@router.get("/workers")
def list_workers(db: Session = Depends(get_db)):
    threshold = datetime.utcnow() - timedelta(seconds=10)
    workers = db.query(Worker).filter(Worker.last_heartbeat > threshold).all()
    return {
        "count": len(workers),
        "workers": workers
    }
