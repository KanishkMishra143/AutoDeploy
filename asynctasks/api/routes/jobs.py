from fastapi import APIRouter
from api.database import SessionLocal
from api.models import Job
from api.schemas import JobCreate, JobResponse

router = APIRouter()


@router.post("/jobs", response_model=JobResponse)
def create_job(job: JobCreate):
    db = SessionLocal()
    
    new_job = Job(
        status="queued",
        payload=job.payload
    )

    db.add(new_job)
    db.commit()
    db.refresh(new_job)
    db.close()

    return JobResponse(
        job_id=new_job.id,
        status=new_job.status
    )