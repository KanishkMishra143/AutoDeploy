from fastapi import FastAPI
import os

app = FastAPI()

@app.get("/")
def read_root():
    return {
        "message": "Hello from AutoDeploy! The build was successful.",
        "environment": os.getenv("APP_ENV", "development")
    }
