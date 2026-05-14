import re
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
from datetime import datetime
from celery import chain, signature
from api.crypto import decrypt_dict

# --- AUTO-HEALING & ERROR DIAGNOSIS ---

AUTO_HEAL_TEMPLATES = {
    r"npm (?:ERR!|error) missing: ([\w@/-]+)": {
        "title": "Missing NPM Dependency",
        "suggestion": "The build failed because '{0}' is missing. Try adding it to your package.json.",
        "category": "dependency"
    },
    r"npm (?:ERR!|error) .*?ENOENT: no such file or directory, open '.*?/?package\.json'": {
        "title": "Missing package.json",
        "suggestion": "The Node.js build failed because package.json is missing. This file is required for 'npm install'.",
        "category": "dependency"
    },
    r"ModuleNotFoundError: No module named '([\w-]+)'": {
        "title": "Missing Python Module",
        "suggestion": "The module '{0}' was not found. Please add it to your requirements.txt.",
        "category": "dependency"
    },
    r"EADDRINUSE: address already in use :::(\d+)": {
        "title": "Port Conflict",
        "suggestion": "Port {0} is already being used by another process or container.",
        "category": "network"
    },
    r"docker: Error response from daemon: Conflict": {
        "title": "Container Name Conflict",
        "suggestion": "A container with this name already exists. AutoDeploy will attempt a force-cleanup on next run.",
        "category": "docker"
    },
    r"Permission denied": {
        "title": "Permission Denied",
        "suggestion": "The worker doesn't have enough permissions to execute a script. Try 'chmod +x' on your scripts.",
        "category": "security"
    },
    r"failed to read dockerfile: open Dockerfile: no such file or directory": {
        "title": "Missing Dockerfile",
        "suggestion": "Your repository is missing a Dockerfile and AutoDeploy couldn't auto-detect a supported stack (Node, Python, or Static). Please add a Dockerfile or ensure your entry files (like package.json) are in the root directory.",
        "category": "path"
    },
    r"No such file or directory": {
        "title": "Missing File",
        "suggestion": "A required file or directory was not found in the workspace. Check your file paths.",
        "category": "path"
    },
    r"\"/([^\"]+)\": not found": {
        "title": "Missing Project File",
        "suggestion": "The file '{0}' was required by the Dockerfile but was not found in your repository. Please ensure it exists in the root directory.",
        "category": "path"
    },
    r"COPY failed: stat (.*): no such file or directory": {
        "title": "Missing Build Asset",
        "suggestion": "Docker could not find '{0}'. If you are using a template, ensure your project structure matches the expected stack (e.g., package.json for Node.js).",
        "category": "path"
    }
}

def diagnose_log(line):
    """Scans a log line for known error patterns and returns a diagnosis if found."""
    for pattern, info in AUTO_HEAL_TEMPLATES.items():
        match = re.search(pattern, line)
        if match:
            found_val = match.group(1) if match.groups() else ""
            return {
                "title": info["title"],
                "suggestion": info["suggestion"].format(found_val),
                "category": info["category"],
                "detected_at": datetime.utcnow().isoformat()
            }
    return None

# --- STACK TEMPLATES ---
STACK_TEMPLATES = {
    "python": """
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["python", "main.py"]
""",
    "nodejs":"""
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 8000
CMD ["npm", "start"]    
""",
    "static": """
FROM nginx:alpine
COPY . /usr/share/nginx/html
EXPOSE 80    
"""
}

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

    diagnosis = None
    for line in iter(process.stdout.readline, ""):
        if line:
            save_log(db, job_id, line.strip())
            # Smart Diagnosis - capture but don't log yet
            if not diagnosis:
                diagnosis = diagnose_log(line)
                if diagnosis:
                    job = db.query(Job).filter(Job.id == job_id).first()
                    if job:
                        current_result = job.result or {}
                        job.result = {**current_result, "diagnosis": diagnosis}
                        db.commit()
            
    process.stdout.close()
    return_code = process.wait()

    # Emit the diagnosis at the very end for maximum visibility
    if diagnosis:
        save_log(db, job_id, " ")
        save_log(db, job_id, f"💡 AUTO-DIAGNOSIS: {diagnosis['title']} detected!")
        save_log(db, job_id, f"👉 Suggestion: {diagnosis['suggestion']}")
        save_log(db, job_id, " ")
    
    if return_code != 0:
        raise subprocess.CalledProcessError(return_code, command)

def run_container(db, job_id, image_tag, env_vars=None, app_name=None, internal_port=8000):
    """Starts a Docker container with Hardened Resource Quotas and Traefik labels."""
    if app_name:
        clean_name = "".join(e for e in app_name.lower() if e.isalnum() or e == "-")
        container_name = f"autodeploy_{clean_name}"
    else:
        container_name = f"autodeploy_{str(job_id)[:8]}"
        
    hostname = f"{container_name}.localhost"
    network_name = "autodeploy-net"
    
    resource_flags = ["--memory", "512m", "--cpus", "0.5"]
    
    labels = [
        "--label", "traefik.enable=true",
        "--label", f"traefik.http.routers.{container_name}.rule=Host(`{hostname}`)",
        "--label", f"traefik.http.services.{container_name}.loadbalancer.server.port={internal_port}",
    ]

    env_flags = []
    if env_vars:
        for key, value in env_vars.items():
            env_flags.extend(["-e", f"{key}={value}"])
        save_log(db, job_id, f"🔑 Injected {len(env_vars)} environment variables.")

    # Pre-emptive cleanup of existing container with the same name
    save_log(db, job_id, f"🧹 Cleaning up any existing container named {container_name}...")
    subprocess.run(["docker", "rm", "-f", container_name], capture_output=True)

    command = [
        "docker", "run", "-d", 
        "--name", container_name, 
        "--network", network_name,
        "--restart", "unless-stopped"
    ] + resource_flags + labels + env_flags + ["-p", f"0:{internal_port}", image_tag]

    try:
        result = subprocess.run(command, capture_output=True, text=True, check=True)
        container_id = result.stdout.strip()
    except subprocess.CalledProcessError as e:
        save_log(db, job_id, f"❌ Docker run failed: {e.stderr}")
        raise

    inspect_result = subprocess.run(
        ["docker", "inspect", "--format", f"{{{{(index (index .NetworkSettings.Ports \"{internal_port}/tcp\") 0).HostPort}}}}", container_name],
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

def clone_repository(repo_url: str, dest_dir: str, branch: str = "main") -> None:
    try:
        subprocess.run(
            ["git", "clone", "-b", branch, repo_url, dest_dir],
            capture_output=True,
            text=True,
            check=True
        )
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"Git clone failed: {e.stderr}")

def update_job_progress(db, job_id, message, progress=None):
    job = db.query(Job).filter(Job.id == job_id).first()
    if job:
        current_result = job.result or {}
        job.result = {**current_result, "progress_msg": message, "progress_pct": progress}
        db.commit()

# --- ATOMIC PIPELINE TASKS ---

@app.task(name="worker.pipeline.initialize")
def pipeline_initialize(job_id: str):
    """Starts the pipeline and marks job as running."""
    with session_scope() as db:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job: return "Job Not Found"
        
        job.status = "running"
        job.result = {"status": "initializing", "started_at": datetime.utcnow().isoformat()}
        db.commit()
        save_log(db, job_id, "🎬 Pipeline initialized. Starting sequence...")
    return job_id

@app.task(name="worker.pipeline.clone")
def pipeline_clone(job_id: str):
    """Step: Clone the repository into a workspace."""
    with session_scope() as db:
        job = db.query(Job).filter(Job.id == job_id).first()
        repo_url = job.payload.get("repo")
        branch = job.payload.get("branch", "main")
        
        workspace_dir = tempfile.mkdtemp(prefix=f"build_{job_id}_")
        save_log(db, job_id, f"📂 Workspace created: {workspace_dir}")
        
        try:
            update_job_progress(db, job_id, "Cloning Repository", 20)
            clone_repository(repo_url, workspace_dir, branch=branch)
            save_log(db, job_id, "✅ Repository cloned successfully.")
            return {"job_id": job_id, "workspace_dir": workspace_dir}
        except Exception as e:
            save_log(db, job_id, f"❌ Clone failed: {str(e)}")
            shutil.rmtree(workspace_dir, ignore_errors=True)
            raise

@app.task(name="worker.pipeline.custom_step")
def pipeline_custom_step(prev_result: dict, step_name: str, command: str):
    """Step: Execute a custom shell command in the workspace."""
    job_id = prev_result["job_id"]
    workspace_dir = prev_result["workspace_dir"]
    
    with session_scope() as db:
        save_log(db, job_id, f"🛠️ Starting custom step: {step_name}...")
        save_log(db, job_id, f"💻 Command: {command}")
        
        # Report progress for custom step
        update_job_progress(db, job_id, f"Running: {step_name}", 40) # Approximate progress
        
        try:
            # We use our existing run_command wrapper to stream logs
            run_command(db, job_id, command.split(), cwd=workspace_dir)
            save_log(db, job_id, f"✅ Custom step '{step_name}' finished successfully.")
            return prev_result
        except Exception as e:
            save_log(db, job_id, f"❌ Custom step '{step_name}' failed: {str(e)}")
            raise

@app.task(name="worker.pipeline.build")
def pipeline_build(prev_result: dict):
    """Step: Build the Docker image."""
    job_id = prev_result["job_id"]
    workspace_dir = prev_result["workspace_dir"]
    
    with session_scope() as db:
        job = db.query(Job).filter(Job.id == job_id).first()
        stack = job.payload.get("stack", "dockerfile")
        
        dockerfile_path = os.path.join(workspace_dir, "Dockerfile")
        
        # Template Injection
        if not os.path.exists(dockerfile_path):
            if stack == "dockerfile":
                if os.path.exists(os.path.join(workspace_dir, "package.json")): stack = "nodejs"
                elif os.path.exists(os.path.join(workspace_dir, "requirements.txt")): stack = "python"
                elif os.path.exists(os.path.join(workspace_dir, "index.html")): stack = "static"
            
            if stack in STACK_TEMPLATES:
                save_log(db, job_id, f"💡 Injecting {stack} template...")
                with open(dockerfile_path, "w") as f:
                    f.write(STACK_TEMPLATES[stack].strip())

        update_job_progress(db, job_id, "Building Image", 60)
        image_tag = f"autodeploy-app:{str(job_id)[:8]}"
        
        try:
            run_command(db, job_id, ["docker", "build", "-t", image_tag, "."], cwd=workspace_dir)
            save_log(db, job_id, "✅ Build successful.")
            return {**prev_result, "image_tag": image_tag, "stack": stack}
        except Exception as e:
            save_log(db, job_id, f"❌ Build failed: {str(e)}")
            raise

@app.task(name="worker.pipeline.deploy")
def pipeline_deploy(prev_result: dict):
    """Step: Run the container with decrypted environment variables."""
    job_id = prev_result["job_id"]
    image_tag = prev_result["image_tag"]
    stack = prev_result["stack"]
    
    with session_scope() as db:
        job = db.query(Job).filter(Job.id == job_id).first()
        
        # 🔓 Decrypt the environment variables right before they go into Docker
        encrypted_env = job.payload.get("env", {})
        decrypted_env = decrypt_dict(encrypted_env)
        
        app_name = job.payload.get("app_name")
        internal_port = 80 if stack == "static" else 8000
        
        update_job_progress(db, job_id, "Deploying", 90)
        
        # We pass decrypted_env here!
        deploy_info = run_container(
            db, job_id, image_tag, 
            env_vars=decrypted_env, 
            app_name=app_name, 
            internal_port=internal_port
        )
        
        save_log(db, job_id, "✅ Deployment live with secure secrets.")
        return {**prev_result, "deploy_info": deploy_info}

@app.task(name="worker.pipeline.finalize")
def pipeline_finalize(prev_result: dict):
    """Final Step: Cleanup and mark success."""
    job_id = prev_result["job_id"]
    workspace_dir = prev_result["workspace_dir"]
    deploy_info = prev_result["deploy_info"]
    
    with session_scope() as db:
        job = db.query(Job).filter(Job.id == job_id).first()
        job.status = "success"
        job.result = {
            "message": "Pipeline complete",
            "url": deploy_info["url"],
            "container": deploy_info,
            "progress_msg": "Deployment Live",
            "progress_pct": 100
        }
        db.commit()
        
        save_log(db, job_id, "🧹 Cleaning up workspace...")
        shutil.rmtree(workspace_dir, ignore_errors=True)
        save_log(db, job_id, "🏁 Pipeline sequence finished successfully.")
    return "Success"

@app.task(name="worker.pipeline.error_handler")
def pipeline_error_handler(request, exc, traceback, job_id):
    """Global error handler for the pipeline chain."""
    # The 'request' in an error handler is often a Context object
    # We use getattr to safely find the task name
    task_name = getattr(request, 'task', 'Unknown Step')
    
    with session_scope() as db:
        job = db.query(Job).filter(Job.id == job_id).first()
        if job:
            job.status = "failed"
            job.result = {
                "error": str(exc), 
                "step": task_name,
                "progress_msg": "Pipeline Failed",
                "progress_pct": 0
            }
            db.commit()
            save_log(db, job_id, f"🚨 PIPELINE FAILURE in {task_name}: {str(exc)}")
    return "Handled"

# --- MAIN ENTRY POINT ---

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
        return "Locked"

    try:
        with session_scope() as db:
            job = db.query(Job).filter(Job.id == job_id).first()
            if not job or job.status in ["success", "failed"]: 
                return "Skipped"

            if job.type == "DEPLOY":
                # BUILD DYNAMIC PIPELINE STEPS
                steps = [
                    pipeline_initialize.s(job_id),
                    pipeline_clone.s(),
                ]

                # 1. Pre-Build Custom Steps
                pre_steps = job.payload.get("pre_build_steps", [])
                for idx, cmd in enumerate(pre_steps):
                    steps.append(pipeline_custom_step.s(f"Pre-Build {idx+1}", cmd))

                # 2. Core Build
                steps.append(pipeline_build.s())

                # 3. Post-Build Custom Steps
                post_steps = job.payload.get("post_build_steps", [])
                for idx, cmd in enumerate(post_steps):
                    steps.append(pipeline_custom_step.s(f"Post-Build {idx+1}", cmd))

                # 4. Deploy & Finalize
                steps.append(pipeline_deploy.s())
                steps.append(pipeline_finalize.s())

                # CONSTRUCT THE DAG (Chain)
                deployment_chain = chain(*steps)
                
                # Link the error handler
                deployment_chain.link_error(pipeline_error_handler.s(job_id))
                
                # Mark as running immediately to avoid double-triggers
                job.status = "running"
                db.commit()

                deployment_chain.apply_async()
                return "Pipeline Started"
            else:
                # Legacy handling for scan
                job.status = "running"
                db.commit()
                # Dummy scan logic
                time.sleep(2)
                job.status = "success"
                job.result = {"status": "scan complete"}
                return "Scan Complete"

    except Exception as exc:
        raise self.retry(exc=exc)
    finally:
        redis_client.delete(lock_key)

@app.task(name="worker.heartbeat")
def worker_heartbeat():
    """Periodic task to update worker status in the DB."""
    worker_id = f"{socket.gethostname()}:{os.getpid()}"
    with session_scope() as db:
        worker = db.query(Worker).filter(Worker.id == worker_id).first()
        if not worker:
            worker = Worker(id=worker_id, status="online", last_heartbeat=datetime.utcnow())
            db.add(worker)
        else:
            worker.status = "online"
            worker.last_heartbeat = datetime.utcnow()
        
@app.task(name="worker.tasks.stop_job")
def stop_job(job_id: str):
    """Kills a running container and removes its associated Docker image."""
    container_name = f"autodeploy_{str(job_id)[:8]}"
    image_tag = f"autodeploy-app:{str(job_id)[:8]}"
    
    with session_scope() as db:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            return "Job not found"

        subprocess.run(["docker", "rm", "-f", container_name], capture_output=True)
        subprocess.run(["docker", "rmi", image_tag], capture_output=True)
        
        job.status = "stopped"
        db.commit()
        return "Stopped"
