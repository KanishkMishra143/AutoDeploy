from fastapi import FastAPI
import os
import sys
import datetime

app = FastAPI()

# Validate environment on startup
REQUIRED_VAR = os.getenv("VALIDATION_TOKEN")
FEATURE_ENABLED = os.getenv("ENABLE_ADVANCED_UI", "false").lower() == "true"

# Volume Persistence Test Config
DATA_FILE = "/app/data/persistence.txt"

@app.get("/")
def read_root():
    # Persistence Logic
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    # Ensure directory exists (the host side is handled by worker, but let's be safe inside)
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    
    try:
        with open(DATA_FILE, "a") as f:
            f.write(f"Deployment/Access at {now}\n")
    except Exception as e:
        return {"status": "error", "message": f"Failed to write to volume: {str(e)}"}

    # Read history
    history = []
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, "r") as f:
            history = f.readlines()

    if not REQUIRED_VAR:
        return {
            "status": "warning",
            "message": "AutoDeploy Persistence Test Active!",
            "persistence_log": [line.strip() for line in history],
            "hint": "Add VALIDATION_TOKEN to your App Settings to see full success state."
        }
    
    return {
        "status": "success",
        "message": "AutoDeploy Full Verification (Env + Volumes)!",
        "persistence_log": [line.strip() for line in history],
        "token_detected": f"{REQUIRED_VAR[:3]}...{REQUIRED_VAR[-3:]}" if len(REQUIRED_VAR) > 6 else "***",
        "runtime_info": {
            "python_version": sys.version,
            "container_id": os.getenv("HOSTNAME", "unknown")
        }
    }
