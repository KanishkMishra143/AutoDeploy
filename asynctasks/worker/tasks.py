from worker.celery_app import app
import time
from api.database import SessionLocal
from api.models import Job

@app.task
def add(x, y):
    return x + y

@app.task(name="worker.tasks.process_deployment")
def process_deployment(job_id: str, repo_url: str):
    db = SessionLocal()
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if job:
            job.status = "running"
            db.commit()
        # TEST : to invoke fail status in db for a task    
        # if "fail" in repo_url:
        #     raise ValueError("SYSTEM CRASH: Simulated deployment failure!")
        time.sleep(5)
        if job:
            job.status = "success"
            db.commit()
    except Exception as e:
        db.rollback()
        job = db.query(Job).filter(Job.id == job_id).first()
        if job:
            job.status = "failed"
            db.commit()
    finally:
        db.close()
    
            