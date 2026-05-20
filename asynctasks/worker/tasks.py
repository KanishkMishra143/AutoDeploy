import re
import os 
import shutil
import tempfile
import subprocess
import json
import shlex
from worker.celery_app import app
from core.redis import redis_client
import traceback
import time
from core.database import session_scope
from core.models import Job, Log, Worker
from celery.utils.log import get_task_logger
import socket
from datetime import datetime
from celery import chain, signature
from core.crypto import decrypt_dict

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
ENV PORT {port}
EXPOSE {port}
CMD ["python", "main.py"]
""",
    "nodejs":"""
FROM node:18-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
ENV PORT {port}
EXPOSE {port}
CMD ["npm", "start"]
""",
    "static": """
FROM nginx:alpine
COPY . /usr/share/nginx/html
RUN printf "server { listen %s; location / { root /usr/share/nginx/html; index index.html; } }" {port} > /etc/nginx/conf.d/default.conf
EXPOSE {port}
"""
}

logger = get_task_logger(__name__)

def save_log(db, job_id, message, owner_id=None, buffer=None):
    """Helper to publish log to Redis (Real-time) and buffer for DB (Persistence)"""
    timestamp = datetime.utcnow().isoformat()
    log_entry = {
        "message": message,
        "created_at": timestamp,
        "job_id": job_id,
        "owner_id": str(owner_id) if owner_id else None
    }
    
    # 1. REAL-TIME: Publish to Redis Channel immediately
    redis_client.publish(f"logs:{job_id}", json.dumps(log_entry))
    
    # 2. PERSISTENCE: If buffer provided, add to it. Otherwise, save immediately.
    if buffer is not None:
        buffer.append(Log(
            job_id=job_id, 
            message=message, 
            owner_id=owner_id,
            created_at=datetime.utcnow()
        ))
        # Optional: Auto-flush if buffer gets too big
        if len(buffer) >= 50:
            db.bulk_save_objects(buffer)
            db.commit()
            buffer.clear()
    else:
        new_log = Log(job_id=job_id, message=message, owner_id=owner_id)
        db.add(new_log)
        db.commit()
    
    print(f"DEBUG LOG [{job_id[:8]}]: {message}")

def run_command(db, job_id, command, cwd=None, owner_id=None):
    """Executes a shell command and streams its output line-by-line to our Log Engine."""
    process = subprocess.Popen(
        command,
        cwd=cwd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )

    log_buffer = []
    diagnosis = None
    last_flush = time.time()

    for line in iter(process.stdout.readline, ""):
        if line:
            # --- CANCELLATION CHECK ---
            if redis_client.get(f"cancel:{job_id}"):
                process.terminate()
                save_log(db, job_id, " ", owner_id=owner_id)
                save_log(db, job_id, "🛑 CANCELLATION SIGNAL RECEIVED. Terminating process...", owner_id=owner_id)
                save_log(db, job_id, "🧹 Re-rolling state and cleaning up ghosts...", owner_id=owner_id)
                # Ensure the status is updated to stopped
                job = db.query(Job).filter(Job.id == job_id).first()
                if job:
                    job.status = "stopped"
                    db.commit()
                raise RuntimeError("Job cancelled by user")

            save_log(db, job_id, line.strip(), owner_id=owner_id, buffer=log_buffer)
            
            # 🕒 Periodical Flush (Every 5 seconds) to reduce DB latency
            if time.time() - last_flush > 5:
                if log_buffer:
                    db.bulk_save_objects(log_buffer)
                    db.commit()
                    print(f"DEBUG: Periodic flush of {len(log_buffer)} logs for job {job_id[:8]}")
                    log_buffer.clear()
                last_flush = time.time()

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

    # Final Flush of the buffer
    if log_buffer:
        db.bulk_save_objects(log_buffer)
        db.commit()
        log_buffer.clear()

    # Emit the diagnosis at the very end for maximum visibility
    if diagnosis:
        save_log(db, job_id, " ", owner_id=owner_id)
        save_log(db, job_id, f"💡 AUTO-DIAGNOSIS: {diagnosis['title']} detected!", owner_id=owner_id)
        save_log(db, job_id, f"👉 Suggestion: {diagnosis['suggestion']}", owner_id=owner_id)
        save_log(db, job_id, " ", owner_id=owner_id)
    
    if return_code != 0:
        raise subprocess.CalledProcessError(return_code, command)

def run_container(db, job_id, image_tag, env_vars=None, app_name=None, internal_port=8000, owner_id=None, volumes=None, cpu_limit=0.5, memory_limit_mb=512, pids_limit=100):
    """Starts a Docker container with Hardened Resource Quotas and Traefik labels."""
    from core.secrets_engine import resolver as secret_resolver
    import os

    # Get the base domain from environment variables, default to auto-deploy.tech for production
    base_domain = os.getenv("BASE_DOMAIN", "auto-deploy.tech")

    if app_name:
        clean_name = "".join(e for e in app_name.lower() if e.isalnum() or e == "-")
        user_suffix = str(owner_id)[:8] if owner_id else "local"
        container_name = f"ad-{clean_name}-{user_suffix}"
        hostname = f"{clean_name}-{user_suffix}.{base_domain}"
    else:
        clean_name = "unknown"
        container_name = f"ad-{str(job_id)[:8]}"
        hostname = f"{container_name}.{base_domain}"        
    network_name = "autodeploy-net"
    
    # --- TASK 7 SECURITY HARDENING (DATABASE DRIVEN) ---
    # Resource Quotas: Prevent resource exhaustion / DoS attacks
    resource_flags = [
        "--memory", f"{memory_limit_mb}m", 
        "--memory-swap", f"{memory_limit_mb}m",   # Disable swap for predictable performance
        "--cpus", str(cpu_limit),               # Dynamic CPU core limit
        "--pids-limit", str(pids_limit),         # Prevent fork bombs
        "--ulimit", "nofile=1024:1024"          # Limit open file handles
    ]
    
    # Security Profiles: Prevent container escape & host takeover
    security_flags = [
        "--security-opt", "no-new-privileges", # Prevent setuid/setgid privilege escalation
        "--cap-drop", "ALL",                   # Drop all kernel capabilities
        "--cap-add", "NET_BIND_SERVICE"        # Only allow binding to low ports (<1024) if needed
    ]

    labels = [
        "--label", "traefik.enable=true",
        "--label", f"traefik.http.routers.{container_name}.rule=Host(`{hostname}`)",
        "--label", f"traefik.http.services.{container_name}.loadbalancer.server.port={internal_port}",
        "--label", "autodeploy.managed=true",  # Identify for maintenance sweeps
        "--label", f"autodeploy.owner_id={owner_id}"
    ]

    env_flags = []
    if env_vars:
        resolved_env_vars = secret_resolver.resolve_secrets(env_vars)
        for key, value in resolved_env_vars.items():
            env_flags.extend(["-e", f"{key}={value}"])
        save_log(db, job_id, f"🔑 Injected {len(resolved_env_vars)} environment variables.", owner_id=owner_id)

    volume_flags = []
    if volumes:
        # Base directory for persistent volumes on the host
        vol_root = os.path.expanduser("~/.autodeploy/volumes")
        app_vol_dir = os.path.join(vol_root, clean_name)
        
        for vol in volumes:
            if ":" not in vol:
                save_log(db, job_id, f"⚠️ Invalid volume format: {vol}. Expected host_path:container_path", owner_id=owner_id)
                continue
                
            host_path, container_path = vol.split(":", 1)
            
            # Handle relative host paths (e.g. ./data or data)
            if not host_path.startswith("/"):
                # Clean up relative path if it starts with ./
                rel_path = host_path[2:] if host_path.startswith("./") else host_path
                host_path = os.path.abspath(os.path.join(app_vol_dir, rel_path))
                
            # Ensure host path directory exists
            try:
                os.makedirs(os.path.dirname(host_path), exist_ok=True)
            except Exception as e:
                save_log(db, job_id, f"⚠️ Failed to create host directory for volume {host_path}: {str(e)}", owner_id=owner_id)
            
            volume_flags.extend(["-v", f"{host_path}:{container_path}"])
            save_log(db, job_id, f"📦 Mounted volume: {host_path} -> {container_path}", owner_id=owner_id)

    # Pre-emptive cleanup of existing container with the same name
    save_log(db, job_id, f"🧹 Cleaning up any existing container named {container_name}...", owner_id=owner_id)
    subprocess.run(["docker", "rm", "-f", container_name], capture_output=True)

    command = [
        "docker", "run", "-d", 
        "--name", container_name, 
        "--network", network_name,
        "--restart", "unless-stopped"
    ] + resource_flags + security_flags + labels + env_flags + volume_flags + ["-p", f"0:{internal_port}", image_tag]

    try:
        result = subprocess.run(command, capture_output=True, text=True, check=True)
        container_id = result.stdout.strip()
    except subprocess.CalledProcessError as e:
        save_log(db, job_id, f"❌ Docker run failed: {e.stderr}", owner_id=owner_id)
        raise

    inspect_result = subprocess.run(
        ["docker", "inspect", "--format", f"{{{{(index (index .NetworkSettings.Ports \"{internal_port}/tcp\") 0).HostPort}}}}", container_name],
        capture_output=True, text=True, check=True
    )
    assigned_port = inspect_result.stdout.strip()

    save_log(db, job_id, f"✅ Container hardened and started! ID: {container_id[:12]}", owner_id=owner_id)
    save_log(db, job_id, f"🌐 Dynamic URL: http://{hostname}", owner_id=owner_id)

    return {
        "container_id": container_id,
        "container_name": container_name,
        "hostname": hostname,
        "port": assigned_port,
        "url": f"http://{hostname}"
    }

def clone_repository(repo_url: str, dest_dir: str, branch: str = "main", credential: dict = None) -> None:
    """Clones a repository, handling optional SSH or PAT credentials."""
    env = os.environ.copy()
    ssh_key_path = None

    try:
        if credential:
            cred_type = credential.get("type")
            cred_value = credential.get("value")

            if cred_type == "PAT":
                # Inject PAT into the URL: https://<token>@github.com/user/repo.git
                if "://" in repo_url:
                    proto, rest = repo_url.split("://", 1)
                    repo_url = f"{proto}://{cred_value}@{rest}"
                else:
                    repo_url = f"https://{cred_value}@{repo_url}"
            
            elif cred_type == "SSH":
                # Create a temporary SSH key file
                fd, ssh_key_path = tempfile.mkstemp(prefix="ad_ssh_")
                with os.fdopen(fd, 'w') as f:
                    f.write(cred_value)
                os.chmod(ssh_key_path, 0o600)
                
                # Use GIT_SSH_COMMAND to point to our temp key
                env["GIT_SSH_COMMAND"] = f"ssh -i {ssh_key_path} -o StrictHostKeyChecking=no"

        subprocess.run(
            ["git", "clone", "-b", branch, repo_url, dest_dir],
            capture_output=True,
            text=True,
            check=True,
            env=env
        )
    except subprocess.CalledProcessError as e:
        # Scrub credentials from error message
        error_msg = e.stderr
        if credential and credential.get("value"):
            error_msg = error_msg.replace(credential["value"], "********")
        raise RuntimeError(f"Git clone failed: {error_msg}")
    finally:
        if ssh_key_path and os.path.exists(ssh_key_path):
            os.remove(ssh_key_path)

def update_job_progress(db, job_id, message, progress=None):
    job = db.query(Job).filter(Job.id == job_id).first()
    if job:
        current_result = job.result or {}
        job.result = {**current_result, "progress_msg": message, "progress_pct": progress}
        db.commit()

# --- CONFIG AUTODISCOVERY ---

def reconcile_port_in_dockerfile(dockerfile_path, port, db, job_id, owner_id):
    """
    Surgically modifies a Dockerfile to match the overridden internal_port.
    Handles both shell-style and JSON-style (exec) commands.
    """
    try:
        with open(dockerfile_path, "r") as f:
            lines = f.readlines()
        
        new_lines = []
        modified = False
        
        # We'll inject the ENV before the first CMD/ENTRYPOINT or at the end
        injection_index = -1
        
        for i, line in enumerate(lines):
            line_upper = line.strip().upper()
            
            # 1. Update EXPOSE (Handle EXPOSE 8000 or EXPOSE 8000/tcp)
            if line_upper.startswith("EXPOSE"):
                new_line = re.sub(r"\d+", str(port), line)
                if new_line != line:
                    new_lines.append(new_line)
                    modified = True
                    continue
            
            # 2. Update --port in CMD/ENTRYPOINT (Robust regex for JSON and shell)
            # Matches: --port 8000, --port=8000, "--port", "8000", '--port', '8000'
            if line_upper.startswith("CMD") or line_upper.startswith("ENTRYPOINT"):
                if injection_index == -1: injection_index = len(new_lines)

                # Complex regex to handle quotes and commas in JSON arrays
                new_line = re.sub(r'(--port["\s,=]+)(\d+)', f"\\g<1>{port}", line)
                if new_line != line:
                    new_lines.append(new_line)
                    modified = True
                    continue
            
            new_lines.append(line)
        
        # 3. Inject ENV PORT (Try to put it before CMD, otherwise at the end)
        env_line = f"\n# Auto-injected by AutoDeploy Swift-Resolution\nENV PORT {port}\n"
        if injection_index != -1:
            new_lines.insert(injection_index, env_line)
        else:
            new_lines.append(env_line)
        
        # Always write if we reached here to ensure the ENV is present
        with open(dockerfile_path, "w") as f:
            f.writelines(new_lines)
        
        if modified:
            save_log(db, job_id, f"⚡ SWIFT-RESOLUTION: Patched Dockerfile to use port {port}.", owner_id=owner_id)
            
    except Exception as e:
        save_log(db, job_id, f"⚠️ SWIFT-RESOLUTION failed: {str(e)}", owner_id=owner_id)

def reconcile_port_in_yml(yml_path, port, db, job_id, owner_id):
    """Surgically modifies autodeploy.yml to match the overridden internal_port."""
    if not os.path.exists(yml_path): return
    try:
        import yaml
        with open(yml_path, "r") as f:
            data = yaml.safe_load(f) or {}
        
        if data.get("internal_port") != port:
            data["internal_port"] = port
            with open(yml_path, "w") as f:
                yaml.dump(data, f)
            save_log(db, job_id, f"⚡ SWIFT-RESOLUTION: Updated autodeploy.yml to use port {port}.", owner_id=owner_id)
    except Exception as e:
        save_log(db, job_id, f"⚠️ SWIFT-RESOLUTION (YAML) failed: {str(e)}", owner_id=owner_id)

def discover_config(workspace_dir: str):
    """
    Scans the repository for configuration (port, volumes, etc.).
    Priority: autodeploy.yml > Dockerfile > None
    """
    config = {
        "internal_port": None,
        "volumes": [],
        "source": None,
        "warning": None
    }
    
    yml_port = None
    docker_port = None
    
    # 1. Check autodeploy.yml
    yml_path = os.path.join(workspace_dir, "autodeploy.yml")
    if os.path.exists(yml_path):
        try:
            import yaml
            with open(yml_path, "r") as f:
                yml_data = yaml.safe_load(f)
                if yml_data:
                    yml_port = yml_data.get("internal_port")
                    config["volumes"] = yml_data.get("volumes", [])
        except Exception as e:
            print(f"Error parsing autodeploy.yml: {e}")

    # 2. Check Dockerfile (only for port)
    docker_path = os.path.join(workspace_dir, "Dockerfile")
    if os.path.exists(docker_path):
        try:
            with open(docker_path, "r") as f:
                content = f.read()
                # Look for EXPOSE XXXX
                expose_match = re.search(r"EXPOSE\s+(\d+)", content, re.IGNORECASE)
                if expose_match:
                    docker_port = int(expose_match.group(1))
                else:
                    # Look for --port XXXX in CMD/ENTRYPOINT
                    port_match = re.search(r"--port[\s=](\d+)", content, re.IGNORECASE)
                    if port_match:
                        docker_port = int(port_match.group(1))
        except:
            pass

    # 3. Resolve Priority & detect mismatches
    if yml_port and docker_port and yml_port != docker_port:
        config["internal_port"] = yml_port
        config["source"] = "autodeploy.yml (Override)"
        config["warning"] = f"⚠️ Port Conflict: autodeploy.yml specifies {yml_port} but Dockerfile indicates {docker_port}. Using autodeploy.yml."
    elif yml_port:
        config["internal_port"] = yml_port
        config["source"] = "autodeploy.yml"
    elif docker_port:
        config["internal_port"] = docker_port
        config["source"] = "Dockerfile"

    return config

def discover_port(workspace_dir: str):
    """Legacy wrapper for discover_config().internal_port"""
    config = discover_config(workspace_dir)
    return config["internal_port"], config["source"]

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
        save_log(db, job_id, "🎬 Pipeline initialized. Starting sequence...", owner_id=job.owner_id)
    return job_id

@app.task(name="worker.pipeline.clone")
def pipeline_clone(job_id: str):
    """Step: Clone the repository into a workspace."""
    with session_scope() as db:
        from core.models import Credential
        from core.crypto import decrypt_string
        
        job = db.query(Job).filter(Job.id == job_id).first()
        repo_url = job.payload.get("repo")
        branch = job.payload.get("branch", "main")
        owner_id = job.owner_id
        cred_id = job.payload.get("credential_id")
        
        credential_data = None
        if cred_id:
            cred = db.query(Credential).filter(Credential.id == cred_id).first()
            if cred:
                credential_data = {
                    "type": cred.type,
                    "value": decrypt_string(cred.encrypted_value)
                }
                save_log(db, job_id, f"🔑 Using private credential: {cred.name} ({cred.type})", owner_id=owner_id)

        workspace_dir = tempfile.mkdtemp(prefix=f"build_{job_id}_")
        save_log(db, job_id, f"📂 Workspace created: {workspace_dir}", owner_id=owner_id)
        
        try:
            update_job_progress(db, job_id, "Cloning Repository", 20)
            clone_repository(repo_url, workspace_dir, branch=branch, credential=credential_data)
            save_log(db, job_id, "✅ Repository cloned successfully.", owner_id=owner_id)
            return {"job_id": job_id, "workspace_dir": workspace_dir, "owner_id": str(owner_id) if owner_id else None}
        except Exception as e:
            save_log(db, job_id, f"❌ Clone failed: {str(e)}", owner_id=owner_id)
            shutil.rmtree(workspace_dir, ignore_errors=True)
            raise

@app.task(name="worker.pipeline.custom_step")
def pipeline_custom_step(prev_result: dict, step_name: str, command: str, in_container: bool = False):
    """
    Step: Execute a custom shell command.
    If in_container=True, it runs via 'docker exec' in the deployed container.
    Otherwise, it runs in the host workspace directory.
    """
    job_id = prev_result["job_id"]
    workspace_dir = prev_result.get("workspace_dir")
    owner_id = prev_result.get("owner_id")
    
    with session_scope() as db:
        save_log(db, job_id, f"🛠️ Starting custom step: {step_name}...", owner_id=owner_id)
        
        # Report progress
        update_job_progress(db, job_id, f"Running: {step_name}", 40)
        
        try:
            if in_container:
                container_id = prev_result.get("deploy_info", {}).get("container_id")
                if not container_id:
                    raise RuntimeError("Cannot run post-build step: Container ID not found.")
                
                save_log(db, job_id, f"📦 Executing inside container {container_id[:12]}...", owner_id=owner_id)
                save_log(db, job_id, f"💻 Command: {command}", owner_id=owner_id)
                
                cmd_args = ["docker", "exec", container_id] + shlex.split(command)
                run_command(db, job_id, cmd_args, owner_id=owner_id)
            else:
                save_log(db, job_id, f"💻 Command (Host): {command}", owner_id=owner_id)
                cmd_args = shlex.split(command)
                run_command(db, job_id, cmd_args, cwd=workspace_dir, owner_id=owner_id)
                
            save_log(db, job_id, f"✅ Custom step '{step_name}' finished successfully.", owner_id=owner_id)
            return prev_result
        except Exception as e:
            save_log(db, job_id, f"❌ Custom step '{step_name}' failed: {str(e)}", owner_id=owner_id)
            raise

@app.task(name="worker.pipeline.build")
def pipeline_build(prev_result: dict):
    """Step: Build the Docker image."""
    job_id = prev_result["job_id"]
    workspace_dir = prev_result["workspace_dir"]
    owner_id = prev_result.get("owner_id")
    
    with session_scope() as db:
        job = db.query(Job).filter(Job.id == job_id).first()
        stack = job.payload.get("stack", "dockerfile")
        root_dir = job.payload.get("root_dir", ".")
        
        # Calculate effective workspace dir for monorepos
        effective_workspace = os.path.abspath(os.path.join(workspace_dir, root_dir))
        save_log(db, job_id, f"📂 Effective workspace: {root_dir}", owner_id=owner_id)
        
        dockerfile_path = os.path.join(effective_workspace, "Dockerfile")
        
        # Template Injection
        if not os.path.exists(dockerfile_path):
            if stack == "dockerfile":
                if os.path.exists(os.path.join(effective_workspace, "package.json")): stack = "nodejs"
                elif os.path.exists(os.path.join(effective_workspace, "requirements.txt")): stack = "python"
                elif os.path.exists(os.path.join(effective_workspace, "index.html")): stack = "static"
            
            if stack in STACK_TEMPLATES:
                save_log(db, job_id, f"💡 Injecting {stack} template...", owner_id=owner_id)
                
                # Dynamic port injection for templates
                internal_port = job.payload.get("internal_port", 8000)
                template_content = STACK_TEMPLATES[stack].strip()
                if "{port}" in template_content:
                    template_content = template_content.format(port=internal_port)
                
                with open(dockerfile_path, "w") as f:
                    f.write(template_content)

        update_job_progress(db, job_id, "Building Image", 60)
        
        # New Tagging Convention: ad-{clean_app_name}:{job_id_short}
        app_name = job.payload.get("app_name", "unknown")
        clean_name = "".join(e for e in app_name.lower() if e.isalnum() or e == "-")
        image_tag = f"ad-{clean_name}:{str(job_id)[:8]}"
        
        # --- CONFIG AUTODISCOVERY ---
        config = discover_config(effective_workspace)
        payload_updates = {}
        
        dashboard_port = job.payload.get("internal_port")
        discovered_port = config["internal_port"]

        if config["warning"]:
            save_log(db, job_id, config["warning"], owner_id=owner_id)
        
        # --- SWIFT-RESOLUTION: Respect Dashboard Choice & Patch Repo ---
        if discovered_port and dashboard_port and discovered_port != dashboard_port:
            save_log(db, job_id, f"⚡ User override detected: Enforcing port {dashboard_port} (Dashboard) over {discovered_port} ({config['source']}).", owner_id=owner_id)
            reconcile_port_in_dockerfile(dockerfile_path, dashboard_port, db, job_id, owner_id)
            reconcile_port_in_yml(os.path.join(effective_workspace, "autodeploy.yml"), dashboard_port, db, job_id, owner_id)
            # We keep internal_port as dashboard_port
        elif discovered_port:
            save_log(db, job_id, f"🔍 Autodiscovered port {discovered_port} from {config['source']}.", owner_id=owner_id)
            payload_updates["internal_port"] = discovered_port
            
        if config["volumes"]:
            save_log(db, job_id, f"📦 Found {len(config['volumes'])} volume mappings in autodeploy.yml.", owner_id=owner_id)
            payload_updates["volumes"] = config["volumes"]
            
        if payload_updates:
            job.payload = {**job.payload, **payload_updates}
            # Sync with Application record
            app_id = job.app_id
            if app_id:
                from core.models import Application
                db.query(Application).filter(Application.id == app_id).update(payload_updates)
            db.commit()

        try:
            # Important: We build with context as effective_workspace
            run_command(db, job_id, ["docker", "build", "-t", image_tag, "."], cwd=effective_workspace, owner_id=owner_id)
            save_log(db, job_id, "✅ Build successful.", owner_id=owner_id)
            return {**prev_result, "image_tag": image_tag, "stack": stack}
        except Exception as e:
            save_log(db, job_id, f"❌ Build failed: {str(e)}", owner_id=owner_id)
            raise

@app.task(name="worker.pipeline.deploy")
def pipeline_deploy(prev_result: dict):
    """Step: Run the container with decrypted environment variables and user-level resource quotas."""
    job_id = prev_result["job_id"]
    image_tag = prev_result["image_tag"]
    stack = prev_result["stack"]
    owner_id = prev_result.get("owner_id")
    
    with session_scope() as db:
        from core.models import Job, Profile
        job = db.query(Job).filter(Job.id == job_id).first()
        
        # 🔓 Decrypt the environment variables right before they go into Docker
        encrypted_env = job.payload.get("env", {})
        decrypted_env = decrypt_dict(encrypted_env)
        
        app_name = job.payload.get("app_name")
        internal_port = job.payload.get("internal_port")
        if not internal_port:
            internal_port = 80 if stack == "static" else 8000
            
        volumes = job.payload.get("volumes", [])
        
        # --- TASK 7: USER-LEVEL RESOURCE QUOTAS ---
        # Fetch the owner's profile to get their specific tier limits
        profile = db.query(Profile).filter(Profile.user_id == owner_id).first() if owner_id else None
        
        cpu_limit = profile.cpu_limit if profile else 0.5
        memory_limit = profile.memory_limit_mb if profile else 512
        pids_limit = profile.pids_limit if profile else 100

        update_job_progress(db, job_id, "Deploying", 90)
        
        # We pass decrypted_env, volumes, and user quotas here!
        deploy_info = run_container(
            db, job_id, image_tag, 
            env_vars=decrypted_env, 
            app_name=app_name, 
            internal_port=internal_port,
            owner_id=owner_id,
            volumes=volumes,
            cpu_limit=cpu_limit,
            memory_limit_mb=memory_limit,
            pids_limit=pids_limit
        )
        
        save_log(db, job_id, f"✅ Deployment live. Quota Applied: {memory_limit}MB RAM / {cpu_limit} CPU", owner_id=owner_id)
        return {**prev_result, "deploy_info": deploy_info}

@app.task(name="worker.tasks.prune_old_images")
def prune_old_images(app_id: str):
    """
    Enforces the application's retention_limit (count) and retention_days (time).
    Keeps the 'N' most recent successful build images that are also within 'D' days.
    """
    from datetime import datetime, timedelta, timezone
    
    with session_scope() as db:
        from core.models import Application, Job
        app = db.query(Application).filter(Application.id == app_id).first()
        if not app:
            return "App not found"
        
        limit_count = app.retention_limit
        limit_days = app.retention_days
        
        # 1. Fetch successful jobs, latest first
        successful_jobs = db.query(Job).filter(
            Job.app_id == app.id,
            Job.status == "success"
        ).order_by(Job.created_at.desc()).all()

        if not successful_jobs:
            return "No successful builds found. Skipping prune."

        # 2. Identify jobs to prune
        jobs_to_prune = []
        now = datetime.now(timezone.utc)
        time_threshold = now - timedelta(days=limit_days)

        for i, job in enumerate(successful_jobs):
            # Never prune the latest build (it's the active one)
            if i == 0: continue
            
            # Prune if past count limit OR past time limit
            is_past_count = i >= limit_count
            # Ensure job.created_at is aware for comparison
            created_at = job.created_at
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
                
            is_past_time = created_at < time_threshold
            
            if is_past_count or is_past_time:
                jobs_to_prune.append(job)
        
        if not jobs_to_prune:
            return f"Retention limits not reached. Keeping all {len(successful_jobs)} images."

        pruned_count = 0
        clean_app_name = "".join(e for e in app.name.lower() if e.isalnum() or e == "-")
        
        for job in jobs_to_prune:
            # New Tagging Convention: ad-{clean_app_name}:{job_id_short}
            image_tag = f"ad-{clean_app_name}:{str(job.id)[:8]}"
            
            try:
                # Remove the image
                res = subprocess.run(["docker", "rmi", image_tag], capture_output=True, text=True)
                if res.returncode == 0:
                    pruned_count += 1
            except Exception:
                continue
        
        return f"Pruned {pruned_count} old images for {app.name} based on count ({limit_count}) and time ({limit_days} days) policies."

@app.task(name="worker.pipeline.finalize")
def pipeline_finalize(prev_result: dict):
    """Final Step: Cleanup and mark success."""
    job_id = prev_result["job_id"]
    workspace_dir = prev_result["workspace_dir"]
    deploy_info = prev_result["deploy_info"]
    owner_id = prev_result.get("owner_id")
    
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
        
        save_log(db, job_id, "🧹 Cleaning up workspace...", owner_id=owner_id)
        shutil.rmtree(workspace_dir, ignore_errors=True)
        
        # TRIGGER IMAGE PRUNING
        if job.app_id:
            save_log(db, job_id, "🧹 Triggering image retention policy cleanup...", owner_id=owner_id)
            prune_old_images.delay(str(job.app_id))

        save_log(db, job_id, "🏁 Pipeline sequence finished successfully.", owner_id=owner_id)
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
            # If the job was already marked as stopped, don't overwrite with 'failed'
            if job.status == "stopped":
                save_log(db, job_id, f"🛑 Pipeline sequence halted. Cleanup complete.")
                return "Handled (Cancelled)"
                
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

@app.task(name="worker.tasks.maintenance_sweep")
def maintenance_sweep():
    """
    Global maintenance task that triggers image pruning for ALL applications.
    Useful for Celery Beat (Scheduled) or Startup Hooks.
    """
    from core.models import Application
    with session_scope() as db:
        apps = db.query(Application).all()
        app_ids = [str(app.id) for app in apps]

    print(f"🧹 MAINTENANCE: Starting global sweep for {len(app_ids)} applications...")

    results = []
    for app_id in app_ids:
        # We call it synchronously within the loop to avoid overwhelming the worker 
        # with hundreds of simultaneous sub-tasks, or we could use .delay() 
        # if we want parallel execution. For maintenance, sequential is safer.
        result = prune_old_images(app_id)
        results.append(result)

    print(f"✅ MAINTENANCE: Global sweep complete. Summary: {len(results)} apps processed.")
    return results

@app.task(name="worker.tasks.process_job",

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

                # 3. Deploy
                steps.append(pipeline_deploy.s())

                # 4. Post-Build Custom Steps (Executed INSIDE the container)
                post_steps = job.payload.get("post_build_steps", [])
                for idx, cmd in enumerate(post_steps):
                    steps.append(pipeline_custom_step.s(f"Post-Build {idx+1}", cmd, in_container=True))

                # 5. Finalize
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
    """Kills a running container, removes its associated Docker image, and cleans up workspace."""
    with session_scope() as db:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            return "Job not found"

        app_name = job.payload.get("app_name")
        owner_id = job.owner_id
        
        if app_name:
            clean_name = "".join(e for e in app_name.lower() if e.isalnum() or e == "-")
            user_suffix = str(owner_id)[:8] if owner_id else "local"
            container_name = f"ad-{clean_name}-{user_suffix}"
        else:
            container_name = f"ad-{str(job_id)[:8]}"

        image_tag = f"ad-{clean_name}:{str(job_id)[:8]}"

        # 1. Cleanup Docker
        subprocess.run(["docker", "rm", "-f", container_name], capture_output=True)
        subprocess.run(["docker", "rmi", image_tag], capture_output=True)
        
        # 2. Cleanup Workspace (Search for temp dirs)
        tmp_dir = tempfile.gettempdir()
        for d in os.listdir(tmp_dir):
            if d.startswith(f"build_{job_id}_"):
                save_log(db, job_id, f"🧹 Cleaning up ghost workspace: {d}", owner_id=owner_id)
                shutil.rmtree(os.path.join(tmp_dir, d), ignore_errors=True)

        job.status = "stopped"
        db.commit()
        return "Stopped"

@app.task(name="worker.tasks.cleanup_app")
def cleanup_app(app_name: str, image_tags: list, owner_id: str = None):
    """Background task to remove all Docker resources for an application."""
    clean_name = "".join(e for e in app_name.lower() if e.isalnum() or e == "-")
    user_suffix = str(owner_id)[:8] if owner_id else "local"
    container_name = f"ad-{clean_name}-{user_suffix}"
    
    # 1. Stop and remove the container
    subprocess.run(["docker", "rm", "-f", container_name], capture_output=True)
    
    # 2. Prune images associated with this app (optional but good for space)
    for tag in image_tags:
        subprocess.run(["docker", "rmi", tag], capture_output=True)
    
    return f"Cleaned up {app_name}"
