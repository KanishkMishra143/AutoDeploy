from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from pydantic import BaseModel
from core.database import get_db
from core.models import Application, Job, Log, AppAccess, Profile
from core.schemas import AppCreate, AppUpdate, AppResponse, AppListResponse, JobResponse, AppAccessCreate, AppAccessResponse
from worker.tasks import process_job, cleanup_app, discover_port
from uuid import UUID
from core.auth import get_current_user
from core.crypto import encrypt_dict, decrypt_dict
from core.vault import vault
from typing import Dict

import subprocess
import shutil
import tempfile
import os

router = APIRouter(
    prefix="/apps", 
    tags=["apps"],
    dependencies=[Depends(get_current_user)]
)

def mask_env(env_vars: Dict[str, str]) -> Dict[str, str]:
    """Masks secret values for safe transport to the dashboard."""
    if not env_vars:
        return {}
    return {k: "********" for k in env_vars.keys()}

@router.get("/{app_id}/detect-port")
def detect_app_port(app_id: UUID, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    app = db.query(Application).filter(Application.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    
    get_app_with_access(app_id, current_user["sub"], db)

    temp_dir = tempfile.mkdtemp(prefix="port_detect_")
    try:
        from worker.tasks import clone_repository, discover_port
        from core.crypto import decrypt_string
        
        credential_data = None
        if app.credential:
            credential_data = {
                "type": app.credential.type,
                "value": decrypt_string(app.credential.encrypted_value)
            }

        clone_repository(app.repo_url, temp_dir, branch=app.branch, credential=credential_data)
        
        # Handle monorepo root directory
        effective_path = os.path.join(temp_dir, app.root_dir.lstrip("/")) if app.root_dir else temp_dir
        
        port, source = discover_port(effective_path)
        
        # --- TEMPLATE AWARE FALLBACK ---
        # If no port discovered but using a template, use stack default
        if not port:
            if app.stack == "nodejs": port, source = 8000, "Node.js Template"
            elif app.stack == "python": port, source = 8000, "Python Template"
            elif app.stack == "static": port, source = 80, "Static Site Template"

        return {"detected_port": port, "source": source}
    except Exception as e:
        # Include detailed error for frontend debugging
        return {"detected_port": None, "source": None, "error": f"Repository Scan Failed: {str(e)}"}
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

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
def get_repo_branches(repo_url: str, credential_id: Optional[UUID] = None, pat: Optional[str] = None, db: Session = Depends(get_db)):
    """Fetches all branches from a remote repository, supporting private repos with credentials or PAT."""
    env = os.environ.copy()
    ssh_key_path = None
    
    # 1. Handle PAT or Credential for authentication
    if pat:
        if "://" in repo_url:
            proto, rest = repo_url.split("://", 1)
            repo_url = f"{proto}://{pat}@{rest}"
    elif credential_id:
        from core.models import Credential
        from core.crypto import decrypt_string
        cred = db.query(Credential).filter(Credential.id == credential_id).first()
        if cred and cred.type == "PAT":
            pat_val = decrypt_string(cred.encrypted_value)
            if "://" in repo_url:
                proto, rest = repo_url.split("://", 1)
                repo_url = f"{proto}://{pat_val}@{rest}"
        elif cred and cred.type == "SSH":
            cred_value = decrypt_string(cred.encrypted_value)
            # Create a temporary SSH key file
            fd, ssh_key_path = tempfile.mkstemp(prefix="ad_fetch_ssh_")
            with os.fdopen(fd, 'w') as f:
                f.write(cred_value)
            os.chmod(ssh_key_path, 0o600)
            
            # Use GIT_SSH_COMMAND to point to our temp key
            env["GIT_SSH_COMMAND"] = f"ssh -i {ssh_key_path} -o StrictHostKeyChecking=no"

    try:
        result = subprocess.run(
            ["git", "ls-remote", "--heads", repo_url],
            capture_output=True,
            text=True,
            check=True,
            env=env
        )
        # Parse the output: refs/heads/main -> main
        branches = []
        for line in result.stdout.strip().split("\n"):
            if line:
                parts = line.split("\t")
                if len(parts) > 1:
                    ref = parts[1]
                    branch_name = ref.replace("refs/heads/", "")
                    branches.append(branch_name)
        
        return {"branches": branches}
    except Exception as e:
        # Scrub credentials from error message if possible
        err_str = str(e)
        if pat: err_str = err_str.replace(pat, "********")
        raise HTTPException(status_code=400, detail=f"Failed to fetch branches: {err_str}")
    finally:
        if ssh_key_path and os.path.exists(ssh_key_path):
            os.remove(ssh_key_path)

@router.post("", response_model=AppResponse)
def create_app(app_data: AppCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Creates a new application identity with idempotency and row locking."""
    # Use with_for_update on the uniqueness check to prevent double-insertions during rapid clicks
    existing = db.query(Application).with_for_update().filter(Application.name == app_data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Application name already exists")

    new_app = Application(
        owner_id=current_user["sub"],
        name=app_data.name,
        repo_url=app_data.repo_url,
        branch=app_data.branch,
        stack=app_data.stack,
        internal_port=app_data.internal_port,
        volumes=app_data.volumes or [],
        root_dir=app_data.root_dir or ".",
        pre_build_steps=app_data.pre_build_steps or [],
        post_build_steps=app_data.post_build_steps or [],
        env_vars={}, # We store env-vars in Vault now
        credential_id=app_data.credential_id,
        command=app_data.command,
        entrypoint=app_data.entrypoint,
        healthcheck=app_data.healthcheck,
        restart=app_data.restart or "unless-stopped",
        labels=app_data.labels or {},
        build_args=app_data.build_args or {}
    )
    db.add(new_app)
    try:
        db.commit()
        db.refresh(new_app)
        
        # Store in Vault using the newly generated UUID
        if app_data.env_vars:
            vault.store_env_vars(new_app.id, app_data.env_vars)
            
    except Exception as e:
        db.rollback()
        # Cleanup Vault if DB failed
        if 'new_app' in locals() and new_app.id:
            vault.delete_env_vars(new_app.id)
        raise HTTPException(status_code=400, detail=f"A concurrency error occurred: {str(e)}")

    # Return with masked vars for the response
    new_app.env_vars = mask_env(app_data.env_vars)
    new_app.role = "OWNER"
    return new_app

@router.patch("/{app_id}", response_model=AppResponse)
def update_app(app_id: UUID, app_data: AppUpdate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Updates an application's configuration with row-level locking."""
    # We use with_for_update() to lock the application row during the update
    app = db.query(Application).with_for_update().filter(Application.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
        
    get_app_with_access(app_id, current_user["sub"], db, required_role="ADMIN")

    update_data = app_data.dict(exclude_unset=True)
    
    if "name" in update_data and update_data["name"] != app.name:
        existing = db.query(Application).filter(Application.name == update_data["name"]).first()
        if existing:
            raise HTTPException(status_code=400, detail="Application name already exists")

    if "env_vars" in update_data:
        # Fetch current secrets from Vault to handle masking
        current_secrets = vault.get_env_vars(app_id)
        incoming_env = update_data["env_vars"]
        
        # Merge logic: if incoming value is "********", keep the old value.
        # Otherwise, update with the new value.
        # If a key is missing from incoming_env, it is deleted (implicitly by not being in final_env).
        final_env = {}
        for k, v in incoming_env.items():
            if v == "********":
                final_env[k] = current_secrets.get(k, "")
            else:
                final_env[k] = v
        
        # Update Vault with the merged/final set
        vault.store_env_vars(app_id, final_env)
        
        # Ensure DB record remains empty of secrets
        app.env_vars = {} 
        del update_data["env_vars"]

    for key, value in update_data.items():
        setattr(app, key, value)

    db.commit()
    db.refresh(app)

    # Return with masked vars
    app.env_vars = mask_env(vault.get_env_vars(app_id))
    return app
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
        # Mask env vars from Vault
        app.env_vars = mask_env(vault.get_env_vars(app.id))

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
            app.env_vars = mask_env(vault.get_env_vars(app.id))
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
    # Mask env vars from Vault
    app_with_access.env_vars = mask_env(vault.get_env_vars(app_id))
    return app_with_access

@router.post("/{app_id}/deploy", response_model=JobResponse)
def deploy_app(app_id: UUID, trigger_reason: str = "Manual", db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Triggers a manual deployment with a concurrency lock to prevent 'double-click' build floods."""
    # 1. Fetch app with a row-level lock
    app = db.query(Application).with_for_update().filter(Application.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
        
    get_app_with_access(app_id, current_user["sub"], db, required_role="ADMIN")

    # 2. Check for active 'running' jobs for this app to prevent overlapping deployments
    # This is a critical idempotency check
    active_job = db.query(Job).filter(
        Job.app_id == app_id, 
        Job.status.in_(["queued", "running"])
    ).first()
    
    if active_job:
        raise HTTPException(status_code=409, detail="A deployment is already in progress for this application.")
    
    # 3. Fetch real secrets from Vault for the deployment payload
    real_env = vault.get_env_vars(app_id)
    # Re-encrypt using our internal crypto for safe passage in Job payload
    encrypted_env = encrypt_dict(real_env)

    new_job = Job(
        app_id=app.id,
        owner_id=current_user["sub"],
        type="DEPLOY",
        status="queued",
        trigger_reason=trigger_reason,
        payload={
            "repo": app.repo_url,
            "branch": app.branch,
            "env": encrypted_env, # Encrypted for the payload
            "app_name": app.name,
            "stack": app.stack,
            "internal_port": app.internal_port,
            "volumes": app.volumes,
            "root_dir": app.root_dir,
            "pre_build_steps": app.pre_build_steps,
            "post_build_steps": app.post_build_steps,
            "credential_id": str(app.credential_id) if app.credential_id else None,
            "command": app.command,
            "entrypoint": app.entrypoint,
            "healthcheck": app.healthcheck,
            "restart": app.restart,
            "labels": app.labels,
            "build_args": app.build_args
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

    # Use with_for_update or simply handle IntegrityError if we add a unique constraint.
    # For now, let's use a lock-based check to prevent duplicates.
    existing = db.query(AppAccess).with_for_update().filter(
        AppAccess.app_id == app_id, 
        AppAccess.user_id == target_user_id
    ).first()
    
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
    try:
        db.commit()
        db.refresh(new_access)
    except Exception:
        db.rollback()
        # Retry fetch if commit failed (likely due to concurrent insert)
        existing = db.query(AppAccess).filter(AppAccess.app_id == app_id, AppAccess.user_id == target_user_id).first()
        if existing: return existing
        raise HTTPException(status_code=500, detail="Failed to share application")
        
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
        cleanup_app.delay(app.name, image_tags, owner_id=str(user_uuid))

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
    
    # Use with_for_update to lock the row and prevent race conditions
    app = db.query(Application).with_for_update().filter(
        Application.id == app_id,
        Application.owner_id == user_uuid
    ).first()
    
    if not app:
        # If the app is already deleted by a concurrent request, return 204 or 404
        # Since the user wants to delete it, 204 No Content is also acceptable, 
        # but 404 is standard for "resource doesn't exist".
        raise HTTPException(status_code=404, detail="Application already deleted or you are not the owner")
    
    # 1. Eagerly load job IDs to avoid lazy loading issues after deletion
    job_ids = [str(job.id) for job in app.jobs]
    app_name = app.name # Capture name before deletion
    
    # 2. Trigger background Docker cleanup (Container + Images)
    image_tags = [f"autodeploy-app:{jid[:8]}" for jid in job_ids]
    cleanup_app.delay(app_name, image_tags, owner_id=str(user_uuid))
    
    # 3. HIGH-PERFORMANCE DB DELETE
    # We delete everything manually using bulk deletes for speed.
    if job_ids:
        db.query(Log).filter(Log.job_id.in_(job_ids)).delete(synchronize_session=False)
        db.query(Job).filter(Job.app_id == app_id).delete(synchronize_session=False)
    
    db.query(AppAccess).filter(AppAccess.app_id == app_id).delete(synchronize_session=False)
    
    # 4. Final App deletion (Bulk)
    db.query(Application).filter(Application.id == app_id).delete(synchronize_session=False)
    db.commit()

    # 5. Cleanup Vault
    vault.delete_env_vars(app_id)
    
    return {"message": f"Application '{app_name}' and all associated history successfully deleted."}

