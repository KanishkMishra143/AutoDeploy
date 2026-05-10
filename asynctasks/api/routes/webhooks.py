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
    """Receives push events from GitHub and triggers a DEPLOY job."""

    if x_github_event != "push":
        return {"message": f"Ignoring event type: {x_github_event}"}

    payload = await request.json()

    repo_url = payload.get("repository", {}).get("clone_url")
    env_vars = payload.get("env", {}) 
    
    # Advanced metadata extraction
    commit_id = payload.get("after", "unknown")[:8] # Get the push commit hash
    pusher = payload.get("pusher", {}).get("name", "unknown")

    if not repo_url:
        raise HTTPException(status_code=400, detail="Invalid payload: Missing clone_url")

    logger.info(f"🔔 Received GitHub Webhook for: {repo_url} | Commit: {commit_id}")

    app = db.query(Application).filter(Application.repo_url == repo_url).first()
    
    if not app:
        repo_name = payload.get("repository", {}).get("name", "unnamed-app")
        app = Application(
            name=repo_name,
            repo_url=repo_url,
            env_vars=env_vars
        )
        db.add(app)
        db.commit()
        db.refresh(app)

    job_payload = {"repo": repo_url, "source": "github_webhook"}
    if env_vars:
        job_payload["env"] = env_vars
    elif app.env_vars:
        job_payload["env"] = app.env_vars

    new_job = Job(
        app_id=app.id,
        type="DEPLOY",
        status="queued",
        trigger_reason="Webhook", # Track the reason
        trigger_metadata={
            "commit_id": commit_id,
            "pusher": pusher
        },
        payload=job_payload
    )
    db.add(new_job)
    db.commit()
    db.refresh(new_job)

    process_job.delay(str(new_job.id))

    return {
        "message": "Webhook received, deployment triggered",
        "app_name": app.name,
        "commit": commit_id,
        "job_id": str(new_job.id)
    }
