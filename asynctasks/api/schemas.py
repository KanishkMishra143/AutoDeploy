from pydantic import BaseModel
from typing import Dict, Any
from uuid import UUID


class JobCreate(BaseModel):
    payload: Dict[str, Any]


class JobResponse(BaseModel):
    job_id: UUID
    status: str