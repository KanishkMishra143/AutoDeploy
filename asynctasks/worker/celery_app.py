from celery import Celery
from core.redis import redis_client

app = Celery(
    "worker",
    broker="redis://localhost:6379/0",
    backend="redis://localhost:6379/1",
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
    }
)
