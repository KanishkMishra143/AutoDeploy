from fastapi import FastAPI
import os
import sys

app = FastAPI()

# Validate environment on startup
REQUIRED_VAR = os.getenv("VALIDATION_TOKEN")
FEATURE_ENABLED = os.getenv("ENABLE_ADVANCED_UI", "false").lower() == "true"

@app.get("/")
def read_root():
    if not REQUIRED_VAR:
        return {
            "status": "error",
            "message": "ENV INJECTION FAILED: 'VALIDATION_TOKEN' is missing!",
            "hint": "Add VALIDATION_TOKEN to your App Settings in the dashboard."
        }
    
    return {
        "status": "success",
        "message": "AutoDeploy Environment Injection Verified!",
        "token_detected": f"{REQUIRED_VAR[:3]}...{REQUIRED_VAR[-3:]}" if len(REQUIRED_VAR) > 6 else "***",
        "advanced_features": "ENABLED" if FEATURE_ENABLED else "DISABLED",
        "runtime_info": {
            "python_version": sys.version,
            "container_id": os.getenv("HOSTNAME", "unknown")
        }
    }

@app.get("/secure-data")
def get_secure_data():
    if REQUIRED_VAR == "super-secret-123":
        return {"data": "This is protected information unlocked by the correct ENV VAR."}
    return {"error": "Invalid token. Access denied."}
