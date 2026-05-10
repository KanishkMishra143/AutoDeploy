from celery import Celery
import redis

app = Celery(
    "worker",
    broker="redis://localhost:6379/0",
    backend="redis://localhost:6379/1",
    include=["worker.tasks"]
)

# We use DB 2 to separate locks from Celery's broker (DB 0) and backend (DB 1)
redis_client = redis.from_url("redis://localhost:6379/2", decode_responses=True)

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
