from worker.celery_app import app

result = app.send_task(
    "worker.tasks.add",
    args=[2, 3]
)

print(result.get(timeout=10))