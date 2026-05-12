from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List
from api.database import get_db
from api.models import Application, Job
from api.schemas import AppCreate, AppResponse, AppListResponse, JobResponse
from worker.tasks import process_job
from uuid import UUID

import subprocess

router = APIRouter(prefix="/apps", tags=["apps"])

@router.get("/branches")
def get_repo_branches(repo_url: str):
    """Fetches all branches from a remote repository without cloning."""
    try:
        result = subprocess.run(
            ["git", "ls-remote", "--heads", repo_url],
            capture_output=True,
            text=True,
            check=True
        )
        # Parse the output: refs/heads/main -> main
        branches = []
        for line in result.stdout.strip().split("\n"):
            if line:
                ref = line.split("\t")[1]
                branch_name = ref.replace("refs/heads/", "")
                branches.append(branch_name)
        
        return {"branches": branches}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch branches: {str(e)}")

@router.post("", response_model=AppResponse)
def create_app(app: AppCreate, db: Session = Depends(get_db)):
    """Creates a new application identity."""
    existing = db.query(Application).filter(Application.name == app.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Application name already exists")
    
    new_app = Application(
        name=app.name,
        repo_url=app.repo_url,
        branch=app.branch,
        stack=app.stack,
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
            "branch": app.branch,
            "env": app.env_vars,
            "app_name": app.name,
            "stack": app.stack
        }
    )
    db.add(new_job)
    db.commit()
    db.refresh(new_job)
    
    process_job.delay(str(new_job.id))
    return new_job

@router.delete("/{app_id}")
def delete_app(app_id: UUID, db: Session = Depends(get_db)):
    """Deletes an application and all its history, including the Docker container."""
    app = db.query(Application).filter(Application.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    
    # Kill the container if it's running
    container_name = f"autodeploy_{app.name.lower().replace(' ', '')}" # Matches worker's naming logic
    subprocess.run(["docker", "rm", "-f", container_name], capture_output=True)
    
    db.delete(app)
    db.commit()
    return {"message": f"Application '{app.name}' and all associated jobs deleted."}

@router.delete("/purge")
def purge_apps(db: Session = Depends(get_db)):
    """Deletes ALL applications and their containers. Destructive operation."""
    apps = db.query(Application).all()
    
    for app in apps:
        container_name = f"autodeploy_{app.name.lower().replace(' ', '')}"
        subprocess.run(["docker", "rm", "-f", container_name], capture_output=True)
        db.delete(app)
    
    db.commit()
    return {"message": f"Successfully purged {len(apps)} applications and cleaned up containers."}

@router.patch("/{app_id}", response_model=AppResponse)
def update_app(app_id: UUID, payload: dict, db: Session = Depends(get_db)):
    """Updates application settings (e.g., environment variables)."""
    app = db.query(Application).filter(Application.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    
    if "env_vars" in payload:
        app.env_vars = payload["env_vars"]
    
    db.commit()
    db.refresh(app)
    return app

