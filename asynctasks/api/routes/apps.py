from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List
from api.database import get_db
from api.models import Application, Job
from api.schemas import AppCreate, AppResponse, AppListResponse, JobResponse
from worker.tasks import process_job
from uuid import UUID
from api.auth import get_current_user
from api.crypto import encrypt_dict, decrypt_dict

import subprocess

router = APIRouter(
    prefix="/apps", 
    tags=["apps"],
    dependencies=[Depends(get_current_user)]
)

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
    """Creates a new application identity with encrypted secrets."""
    existing = db.query(Application).filter(Application.name == app.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Application name already exists")
    
    # Encrypt env vars before storing
    encrypted_env = encrypt_dict(app.env_vars) if app.env_vars else {}

    new_app = Application(
        name=app.name,
        repo_url=app.repo_url,
        branch=app.branch,
        stack=app.stack,
        pre_build_steps=app.pre_build_steps or [],
        post_build_steps=app.post_build_steps or [],
        env_vars=encrypted_env
    )
    db.add(new_app)
    db.commit()
    db.refresh(new_app)
    
    # Decrypt for the response
    new_app.env_vars = decrypt_dict(new_app.env_vars)
    return new_app

@router.get("", response_model=AppListResponse)
def list_apps(db: Session = Depends(get_db)):
    """Lists all managed applications (decrypted for Dashboard)."""
    apps = db.query(Application).all()
    for app in apps:
        app.env_vars = decrypt_dict(app.env_vars)
    return {"total": len(apps), "apps": apps}

@router.get("/{app_id}", response_model=AppResponse)
def get_app(app_id: UUID, db: Session = Depends(get_db)):
    """Gets details of a specific application."""
    app = db.query(Application).filter(Application.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    
    app.env_vars = decrypt_dict(app.env_vars)
    return app

@router.post("/{app_id}/deploy", response_model=JobResponse)
def deploy_app(app_id: UUID, db: Session = Depends(get_db)):
    """Triggers a manual deployment for an application."""
    app = db.query(Application).filter(Application.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    
    # Decrypt env vars for the job payload so worker doesn't need to know how to decrypt 
    # (Optional: Worker can also decrypt, but for now we decrypt here for the task payload)
    # Actually, best practice is to keep it encrypted in the payload too, 
    # and let the worker decrypt just before injection.
    
    new_job = Job(
        app_id=app.id,
        type="DEPLOY",
        status="queued",
        trigger_reason="Manual",
        payload={
            "repo": app.repo_url,
            "branch": app.branch,
            "env": app.env_vars, # Keep encrypted in payload
            "app_name": app.name,
            "stack": app.stack,
            "pre_build_steps": app.pre_build_steps,
            "post_build_steps": app.post_build_steps
        }
    )
    db.add(new_job)
    db.commit()
    db.refresh(new_job)
    
    process_job.delay(str(new_job.id))
    return new_job

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

@router.delete("/{app_id}")
def delete_app(app_id: UUID, db: Session = Depends(get_db)):
    """Deletes an application and all its history, including the Docker container."""
    app = db.query(Application).filter(Application.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    
    container_name = f"autodeploy_{app.name.lower().replace(' ', '')}"
    subprocess.run(["docker", "rm", "-f", container_name], capture_output=True)
    
    db.delete(app)
    db.commit()
    return {"message": f"Application '{app.name}' and all associated jobs deleted."}

@router.patch("/{app_id}", response_model=AppResponse)
def update_app(app_id: UUID, payload: dict, db: Session = Depends(get_db)):
    """Updates application settings with encryption for env vars."""
    app = db.query(Application).filter(Application.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    
    if "env_vars" in payload:
        app.env_vars = encrypt_dict(payload["env_vars"])
    if "pre_build_steps" in payload:
        app.pre_build_steps = payload["pre_build_steps"]
    if "post_build_steps" in payload:
        app.post_build_steps = payload["post_build_steps"]
    if "branch" in payload:
        app.branch = payload["branch"]
    
    db.commit()
    db.refresh(app)
    app.env_vars = decrypt_dict(app.env_vars)
    return app

