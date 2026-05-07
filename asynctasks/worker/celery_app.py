from celery import Celery

app = Celery(
    "worker",
    broker="redis://localhost:6379/0",
    backend="redis://localhost:6379/1",
    include=["worker.tasks"]
)

app.conf.task_routes = {
    "worker.tasks.*": {"queue": "default"}
}