from worker.celery_app import app
import traceback
import time
from api.database import SessionLocal
from api.models import Job, Log
from celery.exceptions import MaxRetriesExceededError

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
    db = SessionLocal()
    try:
        # Fetch the job from DB to see its type and payload
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job: 
            return "Job not found"
        # Update status to running
        job.status = "running"
        job.result = {"attempt": self.request.retries + 1, "status": "processing"}
        db.commit()
        # ROUTING: Decide which logic to run
        if job.type == "DEPLOY":
            result_data = run_deploy_logic(db, job_id, job.payload)
        elif job.type == "SCAN":
            result_data = run_scan_logic(db, job_id, job.payload)
        else:
            save_log(db, job_id, f"❌ Unknown job type: {job.type}")
            raise ValueError(f"Unsupported job type: {job.type}")
        # Final Success Update
        job.status = "success"
        job.result = result_data
        db.commit()
    except Exception as exc:
        db.rollback()
        error_trace = traceback.format_exc()
        if self.request.retries < self.max_retries:
            # Exponential Backoff
            countdown = self.default_retry_delay * (2 ** self.request.retries)
            save_log(db, job_id, f"⚠️ Attempt {self.request.retries + 1} failed. Retrying in {countdown}s...")
            raise self.retry(exc=exc, countdown=countdown)
        else:
            # Final Failure
            save_log(db, job_id, f"❌ Max retries reached. Marking job as failed.")
            job = db.query(Job).filter(Job.id == job_id).first()
            if job:
                job.status = "failed"
                job.result = {
                    "error": str(exc),
                    "traceback": error_trace,
                    "total_attempts": self.request.retries + 1
                }
                db.commit()
    finally:
        db.close()
