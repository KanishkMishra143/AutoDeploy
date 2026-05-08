from worker.celery_app import app
import time

@app.task
def add(x, y):
    return x + y

@app.task(name="worker.tasks.process_deployment")
def process_deployment(repo_url: str):
    print(f"Starting deployment for: {repo_url}")
    time.sleep(5)
    print(f"Deployment finished for: {repo_url}")
    return {"status": "success", "repo": repo_url}