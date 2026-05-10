from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List
from api.database import get_db
from api.models import Application, Job
from api.schemas import AppCreate, AppResponse, AppListResponse, JobResponse
from worker.tasks import process_job
from uuid import UUID

router = APIRouter(prefix="/apps", tags=["apps"])

@router.post("", response_model=AppResponse)
def create_app(app: AppCreate, db: Session = Depends(get_db)):
    """Creates a new application identity."""
    existing = db.query(Application).filter(Application.name == app.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Application name already exists")
    
    new_app = Application(
        name=app.name,
        repo_url=app.repo_url,
        env_vars=app.env_vars
    )
    db.add(new_app)
    db.commit()
    db.refresh(new_app)
    return new_app

@router.get("", response_model=AppListResponse)
def list_apps(db: Session = Depends(get_db)):
    """Lists all managed applications."""
    apps = db.query(Application).all()
    return {"total": len(apps), "apps": apps}

@router.get("/{app_id}", response_model=AppResponse)
def get_app(app_id: UUID, db: Session = Depends(get_db)):
    """Gets details of a specific application."""
    app = db.query(Application).filter(Application.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return app

@router.post("/{app_id}/deploy", response_model=JobResponse)
def deploy_app(app_id: UUID, db: Session = Depends(get_db)):
    """Triggers a manual deployment for an application."""
    app = db.query(Application).filter(Application.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    
    new_job = Job(
        app_id=app.id,
        type="DEPLOY",
        status="queued",
        trigger_reason="Manual", # Tracking the reason
        payload={
            "repo": app.repo_url,
            "env": app.env_vars,
            "app_name": app.name
        }
    )
    db.add(new_job)
    db.commit()
    db.refresh(new_job)
    
    process_job.delay(str(new_job.id))
    return new_job

@router.delete("/{app_id}")
def delete_app(app_id: UUID, db: Session = Depends(get_db)):
    """Deletes an application and all its history."""
    app = db.query(Application).filter(Application.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    
    db.delete(app)
    db.commit()
    return {"message": f"Application '{app.name}' and all associated jobs deleted."}
