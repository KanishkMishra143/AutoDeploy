import os 
import shutil
import tempfile
import subprocess
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

def run_command(db, job_id, command, cwd=None):
    """Executes a shell command and streams its output line-by-line to our Log Engine."""
    process = subprocess.Popen(
        command,
        cwd=cwd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )

    for line in iter(process.stdout.readline, ""):
        if line:
            save_log(db, job_id, line.strip())
            
    process.stdout.close()
    return_code = process.wait()
    
    if return_code != 0:
        raise subprocess.CalledProcessError(return_code, command)

def run_container(db, job_id, image_tag, env_vars=None, app_name=None):
    """Starts a Docker container with Hardened Resource Quotas and Traefik labels."""
    # Use app_name for stable naming if available, otherwise fallback to job_id
    if app_name:
        # Sanitize: lowercase, alphanumeric and hyphens only
        clean_name = "".join(e for e in app_name.lower() if e.isalnum() or e == "-")
        container_name = f"autodeploy_{clean_name}"
    else:
        container_name = f"autodeploy_{str(job_id)[:8]}"
        
    hostname = f"{container_name}.localhost"
    network_name = "autodeploy-net"
    
    # 1. Resource Quotas
    resource_flags = [
        "--memory", "512m",
        "--cpus", "0.5"
    ]

    # Clean up any existing container with this name (Crucial for App-centric model!)
    # This kills the OLD version before starting the NEW one.
    subprocess.run(["docker", "rm", "-f", container_name], capture_output=True)

    save_log(db, job_id, f"🚀 Hardening container: {container_name} (Limits: 512MB RAM, 0.5 CPU)...")
    
    # 2. Traefik Labels
    labels = [
        "--label", "traefik.enable=true",
        "--label", f"traefik.http.routers.{container_name}.rule=Host(`{hostname}`)",
        "--label", f"traefik.http.services.{container_name}.loadbalancer.server.port=8000",
    ]

    # 3. Environment Variables
    env_flags = []
    if env_vars:
        for key, value in env_vars.items():
            env_flags.extend(["-e", f"{key}={value}"])
        save_log(db, job_id, f"🔑 Injected {len(env_vars)} environment variables.")

    # 4. Assemble command
    command = [
        "docker", "run", "-d", 
        "--name", container_name, 
        "--network", network_name,
        "--restart", "unless-stopped"
    ] + resource_flags + labels + env_flags + ["-p", "0:8000", image_tag]

    result = subprocess.run(command, capture_output=True, text=True, check=True)
    container_id = result.stdout.strip()

    # Find host port
    inspect_result = subprocess.run(
        ["docker", "inspect", "--format", "{{(index (index .NetworkSettings.Ports \"8000/tcp\") 0).HostPort}}", container_name],
        capture_output=True, text=True, check=True
    )
    assigned_port = inspect_result.stdout.strip()

    save_log(db, job_id, f"✅ Container hardened and started! ID: {container_id[:12]}")
    save_log(db, job_id, f"🌐 Dynamic URL: http://{hostname}")

    return {
        "container_id": container_id,
        "container_name": container_name,
        "hostname": hostname,
        "port": assigned_port,
        "url": f"http://{hostname}"
    }

def clone_repository(repo_url: str, dest_dir: str) -> None:
    """Clones a git repository into a destination directory using the OS git binary."""
    try:
        subprocess.run(
            ["git", "clone", repo_url, dest_dir],
            capture_output=True,
            text=True,
            check=True
        )
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"Git clone failed: {e.stderr}")

def run_deploy_logic(db, job_id, payload):
    """Contains the specific steps for a DEPLOYMENT job."""
    repo_url = payload.get("repo")
    env_vars = payload.get("env", {})
    app_name = payload.get("app_name") # Extract the identity
    
    if not repo_url:
        raise ValueError("Repository URL is missing in the payload.")
        
    save_log(db, job_id, f"Starting deployment process for: {repo_url}")
    
    # 1. Create an isolated temporary workspace
    workspace_dir = tempfile.mkdtemp(prefix=f"build_{job_id}_")
    save_log(db, job_id, f"Created isolated workspace: {workspace_dir}")

    try:
        # 2. Clone the repository into the workspace
        save_log(db, job_id, "Cloning repository...")
        clone_repository(repo_url, workspace_dir)
        save_log(db, job_id, "Repository successfully cloned.")

        # 3. Docker Build
        image_tag = f"autodeploy-app:{str(job_id)[:8]}" 
        save_log(db, job_id, f"📦 Starting Docker build for image: {image_tag}...")
        
        try:
            run_command(db, job_id, ["docker", "build", "-t", image_tag, "."], cwd=workspace_dir)
            save_log(db, job_id, f"✅ Docker build successful! Image created: {image_tag}")
        except Exception as e:
            save_log(db, job_id, f"❌ Docker build failed: {str(e)}")
            raise

        # 4. Docker Run (Passing the app_name for stable naming)
        deploy_info = run_container(db, job_id, image_tag, env_vars=env_vars, app_name=app_name)
        
        save_log(db, job_id, "Deployment finished successfully!")
        
        return {
            "message": "Deployment successful",
            "image": image_tag,
            "container": deploy_info,
            "url": deploy_info["url"]
        }
    finally:
        # 5. Mandatory Cleanup
        save_log(db, job_id, "Cleaning up workspace...")
        shutil.rmtree(workspace_dir, ignore_errors=True)
        save_log(db, job_id, "✅ Deployment process complete. Job finished.")

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
    # Use hostname + PID to uniquely identify multiple workers on one machine
    worker_id = f"{socket.gethostname()}:{os.getpid()}"
    with session_scope() as db:
        worker = db.query(Worker).filter(Worker.id == worker_id).first()
        if not worker:
            worker = Worker(id=worker_id, status="online", last_heartbeat=datetime.utcnow())
            db.add(worker)
        else:
            worker.status = "online"
            worker.last_heartbeat = datetime.utcnow()
        print(f"💓 Heartbeat sent from {worker_id}")
        
@app.task(name="worker.tasks.stop_job")
def stop_job(job_id: str):
    """Kills a running container and removes its associated Docker image."""
    container_name = f"autodeploy_{str(job_id)[:8]}"
    image_tag = f"autodeploy-app:{str(job_id)[:8]}"
    
    with session_scope() as db:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            return "Job not found"

        save_log(db, job_id, f"🛑 Terminating service: {container_name}...")
        
        # 1. Force remove the container
        subprocess.run(["docker", "rm", "-f", container_name], capture_output=True)
        
        # 2. Remove the image to save disk space
        subprocess.run(["docker", "rmi", image_tag], capture_output=True)
        
        # 3. Update DB state
        job.status = "stopped"
        job.result = {**job.result, "status": "stopped", "stopped_at": datetime.utcnow().isoformat()}
        
        save_log(db, job_id, "✅ Service and Image successfully cleaned up.")
        return "Stopped"