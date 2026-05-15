from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session, joinedload
from typing import List
from pydantic import BaseModel
from core.database import get_db
from core.models import Application, Job, Log, AppAccess, Profile
from core.schemas import AppCreate, AppResponse, AppListResponse, JobResponse, AppAccessCreate, AppAccessResponse
from worker.tasks import process_job, cleanup_app
from uuid import UUID
from core.auth import get_current_user
from core.crypto import encrypt_dict, decrypt_dict

import subprocess

router = APIRouter(
    prefix="/apps", 
    tags=["apps"],
    dependencies=[Depends(get_current_user)]
)

def get_app_with_access(app_id: UUID, user_id: str, db: Session, required_role: str = "VIEWER"):
    """
    Helper to fetch an app and verify the user has the required access level.
    Roles: OWNER > ADMIN > VIEWER
    """
    user_uuid = UUID(user_id)
    app = db.query(Application).filter(Application.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    
    if app.owner_id == user_uuid:
        app.role = "OWNER"
        return app
    
    access = db.query(AppAccess).filter(
        AppAccess.app_id == app_id,
        AppAccess.user_id == user_uuid
    ).first()
    
    if not access:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Simple role hierarchy: OWNER and ADMIN can do everything for now, VIEWER only read.
    if required_role == "ADMIN":
        if access.role not in ["ADMIN", "OWNER"]:
             raise HTTPException(status_code=403, detail="Admin privileges required")
        
    app.role = access.role
    return app

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
def create_app(app: AppCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Creates a new application identity with encrypted secrets."""
    existing = db.query(Application).filter(Application.name == app.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Application name already exists")
    
    # Encrypt env vars before storing
    encrypted_env = encrypt_dict(app.env_vars) if app.env_vars else {}

    new_app = Application(
        owner_id=current_user["sub"],
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
    new_app.role = "OWNER"
    return new_app

@router.get("", response_model=AppListResponse)
def list_apps(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Lists all managed applications for the current user (owned or shared)."""
    user_uuid = UUID(current_user["sub"])
    
    # Owned apps with access list and profiles
    owned_apps = db.query(Application).options(
        joinedload(Application.owner_profile),
        joinedload(Application.access_list).joinedload(AppAccess.profile)
    ).filter(Application.owner_id == user_uuid).order_by(Application.updated_at.desc()).all()
    
    for app in owned_apps:
        app.role = "OWNER"
        app.env_vars = decrypt_dict(app.env_vars)

    # Shared apps
    shared_access = db.query(AppAccess).filter(AppAccess.user_id == user_uuid).all()
    shared_apps = []
    for access in shared_access:
        app = db.query(Application).options(
            joinedload(Application.owner_profile),
            joinedload(Application.access_list).joinedload(AppAccess.profile)
        ).filter(Application.id == access.app_id).first()
        
        if app:
            app.role = access.role
            app.env_vars = decrypt_dict(app.env_vars)
            shared_apps.append(app)
    
    # Sort shared apps by updated_at DESC (latest first)
    shared_apps.sort(key=lambda x: x.updated_at, reverse=True)
    
    all_apps = owned_apps + shared_apps
    return {"total": len(all_apps), "apps": all_apps}

@router.get("/{app_id}", response_model=AppResponse)
def get_app(app_id: UUID, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Gets details of a specific application."""
    # Ensure access list and profiles are loaded
    app = db.query(Application).options(
        joinedload(Application.owner_profile),
        joinedload(Application.access_list).joinedload(AppAccess.profile)
    ).filter(Application.id == app_id).first()

    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    app_with_access = get_app_with_access(app_id, current_user["sub"], db)
    app_with_access.env_vars = decrypt_dict(app_with_access.env_vars)
    return app_with_access

@router.post("/{app_id}/deploy", response_model=JobResponse)
def deploy_app(app_id: UUID, trigger_reason: str = "Manual", db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Triggers a manual deployment for an application."""
    # Deploying requires at least ADMIN role if shared
    app = get_app_with_access(app_id, current_user["sub"], db, required_role="ADMIN")
    
    new_job = Job(
        app_id=app.id,
        owner_id=current_user["sub"],
        type="DEPLOY",
        status="queued",
        trigger_reason=trigger_reason,
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

class AppShareRequest(BaseModel):
    user_id_or_username: str
    role: str

@router.post("/{app_id}/share", response_model=AppAccessResponse)
def share_app(app_id: UUID, share_req: AppShareRequest, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Shares an application with another user via UUID or custom Username."""
    # Owners and Admins can share
    app = get_app_with_access(app_id, current_user["sub"], db, required_role="ADMIN")
    
    target_user_id = None
    # 1. Try to resolve as UUID
    try:
        target_user_id = UUID(share_req.user_id_or_username)
    except ValueError:
        # 2. Try to resolve as Username
        profile = db.query(Profile).filter(Profile.username == share_req.user_id_or_username.lower()).first()
        if not profile:
            raise HTTPException(status_code=404, detail=f"User '{share_req.user_id_or_username}' not found")
        target_user_id = profile.user_id

    if target_user_id == UUID(current_user["sub"]):
        raise HTTPException(status_code=400, detail="You cannot share an app with yourself")

    # Check if already shared
    existing = db.query(AppAccess).filter(AppAccess.app_id == app_id, AppAccess.user_id == target_user_id).first()
    if existing:
        existing.role = share_req.role
        db.commit()
        db.refresh(existing)
        return existing
    
    new_access = AppAccess(
        app_id=app_id,
        user_id=target_user_id,
        role=share_req.role
    )
    db.add(new_access)
    db.commit()
    db.refresh(new_access)
    return new_access

@router.delete("/{app_id}/revoke/{user_id}")
def revoke_access(app_id: UUID, user_id: UUID, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Revokes a user's access to an application."""
    # Owners and Admins can revoke
    app = get_app_with_access(app_id, current_user["sub"], db, required_role="ADMIN")
    
    # Validation: Admins cannot revoke the owner
    if user_id == app.owner_id:
        raise HTTPException(status_code=403, detail="The owner's access cannot be revoked")
    
    # Validation: Admins cannot revoke themselves (user must ask owner or another admin)
    if user_id == UUID(current_user["sub"]) and app.role == "ADMIN":
        raise HTTPException(status_code=400, detail="You cannot revoke your own access. Contact the owner.")

    access = db.query(AppAccess).filter(AppAccess.app_id == app_id, AppAccess.user_id == user_id).first()
    if not access:
        raise HTTPException(status_code=404, detail="Access record not found")
    
    db.delete(access)
    db.commit()
    return {"message": "Access revoked successfully"}

@router.delete("/purge")
def purge_apps(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Deletes all applications owned by the current user and their containers."""
    user_uuid = UUID(current_user["sub"])
    apps = db.query(Application).filter(Application.owner_id == user_uuid).all()
    
    for app in apps:
        job_ids = [str(job.id) for job in app.jobs]
        image_tags = [f"autodeploy-app:{jid[:8]}" for jid in job_ids]
        cleanup_app.delay(app.name, image_tags)

        job_uuid_list = [job.id for job in app.jobs]
        if job_uuid_list:
            db.query(Log).filter(Log.job_id.in_(job_uuid_list)).delete(synchronize_session=False)
            db.query(Job).filter(Job.app_id == app.id).delete(synchronize_session=False)
        db.delete(app)
    
    db.commit()
    return {"message": f"Successfully purged {len(apps)} of your applications."}

@router.delete("/{app_id}")
def delete_app(app_id: UUID, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Deletes an application and all its history with high-performance cleanup."""
    user_uuid = UUID(current_user["sub"])
    # Only owner can delete the whole app
    app = db.query(Application).filter(
        Application.id == app_id,
        Application.owner_id == user_uuid
    ).first()
    
    if not app:
        raise HTTPException(status_code=404, detail="Application not found or you are not the owner")
    
    # 1. Gather all job IDs for this app to clean up Docker images
    job_ids = [str(job.id) for job in app.jobs]
    image_tags = [f"autodeploy-app:{jid[:8]}" for jid in job_ids]
    
    # 2. Trigger background Docker cleanup (Container + Images)
    cleanup_app.delay(app.name, image_tags)
    
    # 3. HIGH-PERFORMANCE DB DELETE
    job_uuid_list = [job.id for job in app.jobs]
    if job_uuid_list:
        db.query(Log).filter(Log.job_id.in_(job_uuid_list)).delete(synchronize_session=False)
        db.query(Job).filter(Job.app_id == app_id).delete(synchronize_session=False)
    
    # 4. Final App deletion
    db.delete(app)
    db.commit()
    
    return {"message": f"Application '{app.name}' and all associated history scheduled for deletion."}

@router.patch("/{app_id}", response_model=AppResponse)
def update_app(app_id: UUID, payload: dict, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Updates application settings with encryption for env vars."""
    # Updating requires at least ADMIN role
    app = get_app_with_access(app_id, current_user["sub"], db, required_role="ADMIN")

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

