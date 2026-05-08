from pydantic import BaseModel
from typing import Dict, Any, Optional, List
from uuid import UUID
from datetime import datetime


class JobCreate(BaseModel):
    type: str = "DEPLOY"
    payload: Dict[str, Any]


class JobResponse(BaseModel):
    id: UUID
    type: str
    status: str
    result: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class JobListResponse(BaseModel):
    total: int
    jobs: List[JobResponse]

    class Config:
        from_attributes = True

class LogResponse(BaseModel):
    id: UUID
    message: str
    created_at: datetime

    class Config: 
        from_attributes = True

class JobLogsResponse(BaseModel):
    job_id: UUID
    logs: List[LogResponse]

    class Config:
        from_attributes = True