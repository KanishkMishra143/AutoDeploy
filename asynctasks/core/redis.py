import os
import redis
import redis.asyncio as async_redis
from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

# Sync client for Worker/Celery
redis_client = redis.from_url(f"{REDIS_URL}/2", decode_responses=True)

# Async client for FastAPI WebSockets
async_redis_client = async_redis.from_url(f"{REDIS_URL}/2", decode_responses=True)
