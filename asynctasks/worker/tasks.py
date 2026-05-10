from worker.celery_app import app, redis_client
import traceback
import time
from api.database import session_scope
from api.models import Job, Log, Worker
from celery.utils.log import get_task_logger
import socket

logger = get_task_logger(__name__)

def save_log(db, job_id, message):
    """Helper to save a log message to the database instantly"""
    new_log = Log(job_id=job_id, message=message)
    db.add(new_log)
    db.commit()
    print(f"DEBUG LOG: {message}")
def run_deploy_logic(db, job_id, payload):
    """Contains the specific steps for a DEPLOYMENT job."""
    repo_url = payload.get("repo", "unknown")
    save_log(db, job_id, f"Starting deployment process for: {repo_url}")
    
    save_log(db, job_id, "Analyzing repository structure...")
    time.sleep(2)
    save_log(db, job_id, "Framework detected: FastAPI/Python")
    save_log(db, job_id, "Installing dependencies from pyproject.toml...")
    time.sleep(3)
    
    if "fail" in repo_url:
        save_log(db, job_id, "ERROR: System crash simulated during build phase!")
        raise ValueError("Simulated deployment failure!")
    
    save_log(db, job_id, "Containerizing application...")
    time.sleep(2)
    save_log(db, job_id, "Deployment finished successfully!")
    return {
        "message": "Deployment successful",
        "url": f"https://{repo_url.split('/')[-1]}.deploy.com"
    }
def run_scan_logic(db, job_id, payload):
    """Contains the specific steps for a SECURITY SCAN job."""
    repo_url = payload.get("repo", "unknown")
    save_log(db, job_id, f"Starting security scan for: {repo_url}")
    time.sleep(2)
    
    save_log(db, job_id, "Running Bandit security analysis...")
    time.sleep(2)
    
    save_log(db, job_id, "Running Safety dependency check...")
    time.sleep(2)
    
    save_log(db, job_id, "Security scan completed. No critical vulnerabilities found.")
    
    return {
        "message": "Scan completed",
        "vulnerabilities_found": 0,
        "status": "SECURE"
    }

@app.task(
    name="worker.tasks.process_job",
    bind=True,
    max_retries=3,
    default_retry_delay=5
 )
def process_job(self, job_id: str):
    lock_key = f"lock:job:{job_id}"
    lock_acquired = redis_client.set(lock_key, "processing", ex=600, nx=True)

    if not lock_acquired:
        print(f"DEBUG: Job {job_id} is already being handled by another worker. Skipping")
        return "Locked"

    try:
        with session_scope() as db:
            # Fetch the job from DB to see its type and payload
            job = db.query(Job).filter(Job.id == job_id).first()
            if not job or job.status in ["success", "failed"]: 
                return "Skipped"

            # Update status to running
            job.status = "running"
            job.result = {"attempt": self.request.retries + 1, "status": "processing"}
            
            # ROUTING: Decide which logic to run
            if job.type == "DEPLOY":
                result_data = run_deploy_logic(db, job_id, job.payload)
            else:
                result_data = run_scan_logic(db, job_id, job.payload)
            
            # Final Success Update
            job.status = "success"
            job.result = result_data

    except Exception as exc:
        if self.request.retries < self.max_retries:
            # Exponential Backoff
            countdown = self.default_retry_delay * (2 ** self.request.retries)
            raise self.retry(exc=exc, countdown=countdown)
        else:
            with session_scope() as error_db:
                job = error_db.query(Job).filter(Job.id == job_id).first()
                if job:
                    job.status = "failed"
                    job.result = {"error": str(exc)}
        raise
    finally:
        redis_client.delete(lock_key)

from datetime import datetime

@app.task(name="worker.heartbeat")
def worker_heartbeat():
    """Periodic task to update worker status in the DB."""
    worker_id = socket.gethostname()
    with session_scope() as db:
        worker = db.query(Worker).filter(Worker.id == worker_id).first()
        if not worker:
            worker = Worker(id=worker_id, status="online", last_heartbeat=datetime.utcnow())
            db.add(worker)
        else:
            worker.status = "online"
            worker.last_heartbeat = datetime.utcnow()
        print(f"💓 Heartbeat sent from {worker_id}")