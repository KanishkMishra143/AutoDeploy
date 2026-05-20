import os
from celery import Celery
from core.redis import REDIS_URL

app = Celery(
    "worker",
    broker=f"{REDIS_URL}/0",
    backend=f"{REDIS_URL}/1",
    include=["worker.tasks"]
)

app.conf.update(
    task_serializer="json",                 
    accept_content=["json"],                 
    result_serializer="json",               
    timezone="UTC",                          
    enable_utc=True,
    beat_schedule = {
        "worker-heartbeat-every-2-seconds": {
            "task": "worker.heartbeat",
            "schedule": 2.0,
        },
        "global-maintenance-sweep-daily": {
            "task": "worker.tasks.maintenance_sweep",
            "schedule": 86400.0, # Every 24 hours
        },
    }
)
