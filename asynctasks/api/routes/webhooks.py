from fastapi import APIRouter, Request, Header, HTTPException, Depends
from sqlalchemy.orm import Session
from api.database import get_db
from api.models import Job, Application
from worker.tasks import process_job
import logging

router = APIRouter(prefix="/webhooks", tags=["webhooks"])
logger = logging.getLogger("uvicorn")

@router.post("/github")
async def github_webhook(
    request: Request,
    db: Session = Depends(get_db),
    x_github_event: str = Header(None)
):
    """Receives push events from GitHub and triggers a DEPLOY job for matching apps."""

    if x_github_event != "push":
        return {"message": f"Ignoring event type: {x_github_event}"}

    payload = await request.json()

    raw_repo_url = payload.get("repository", {}).get("clone_url")
    if not raw_repo_url:
        raise HTTPException(status_code=400, detail="Invalid payload: Missing clone_url")

    # 1. Normalize URLs (Strip .git and make case-insensitive)
    normalized_incoming = raw_repo_url.lower().removesuffix(".git")
    
    # 2. Extract branch from ref (e.g., "refs/heads/master" -> "master")
    ref = payload.get("ref", "")
    pushed_branch = ref.replace("refs/heads/", "") if "refs/heads/" in ref else "main"

    # Metadata extraction
    commit_id = payload.get("after", "unknown")[:8]
    pusher = payload.get("pusher", {}).get("name", "unknown")

    logger.info(f"🔔 Webhook: {normalized_incoming} | Branch: {pushed_branch} | Commit: {commit_id}")

    # 3. Find matching applications
    all_apps = db.query(Application).all()
    matching_apps = [
        a for a in all_apps 
        if a.repo_url.lower().removesuffix(".git") == normalized_incoming 
        and a.branch == pushed_branch
    ]
    
    if not matching_apps:
        logger.warning(f"⚠️ No matching app found for {normalized_incoming} on branch {pushed_branch}")
        return {"message": "No matching application found, ignoring."}

    triggered_ids = []
    for app in matching_apps:
        job_payload = {
            "repo": app.repo_url, 
            "branch": app.branch,
            "stack": app.stack,
            "pre_build_steps": app.pre_build_steps,
            "post_build_steps": app.post_build_steps,
            "app_name": app.name,
            "source": "github_webhook"
        }
        
        # Inject env vars
        job_payload["env"] = app.env_vars or {}

        new_job = Job(
            app_id=app.id,
            type="DEPLOY",
            status="queued",
            trigger_reason="Webhook",
            trigger_metadata={
                "commit_id": commit_id,
                "pusher": pusher,
                "branch": pushed_branch
            },
            payload=job_payload
        )
        db.add(new_job)
        db.commit()
        db.refresh(new_job)

        process_job.delay(str(new_job.id))
        triggered_ids.append(str(new_job.id))

    return {
        "message": f"Webhook received, {len(triggered_ids)} deployment(s) triggered",
        "jobs": triggered_ids
    }
