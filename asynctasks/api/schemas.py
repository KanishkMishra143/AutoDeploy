from pydantic import BaseModel
from typing import Dict, Any, Optional, List
from uuid import UUID
from datetime import datetime


class AppCreate(BaseModel):
    name: str
    repo_url: str
    env_vars: Optional[Dict[str, str]] = {}


class AppUpdate(BaseModel):
    name: Optional[str] = None
    repo_url: Optional[str] = None
    env_vars: Optional[Dict[str, str]] = None


class AppResponse(BaseModel):
    id: UUID
    name: str
    repo_url: str
    env_vars: Dict[str, str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AppListResponse(BaseModel):
    total: int
    apps: List[AppResponse]


class JobCreate(BaseModel):
    type: str = "DEPLOY"
    payload: Dict[str, Any]
    app_id: Optional[UUID] = None
    trigger_reason: Optional[str] = "Manual"
    trigger_metadata: Optional[Dict[str, Any]] = None


class JobResponse(BaseModel):
    id: UUID
    app_id: Optional[UUID] = None
    type: str
    status: str
    trigger_reason: Optional[str] = None
    trigger_metadata: Optional[Dict[str, Any]] = None
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
