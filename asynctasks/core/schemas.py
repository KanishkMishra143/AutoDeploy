from pydantic import BaseModel
from typing import Dict, Any, Optional, List
from uuid import UUID
from datetime import datetime


class AppCreate(BaseModel):
    name: str
    repo_url: str
    branch: str = "main"
    stack: str = "dockerfile"
    internal_port: Optional[int] = 8000
    volumes: Optional[List[str]] = []
    root_dir: Optional[str] = "."
    pre_build_steps: Optional[List[str]] = []
    post_build_steps: Optional[List[str]] = []
    env_vars: Optional[Dict[str, str]] = {}
    credential_id: Optional[UUID] = None
    
    # Orchestration overrides
    command: Optional[str] = None
    entrypoint: Optional[List[str]] = None
    healthcheck: Optional[Dict[str, Any]] = None
    restart: Optional[str] = "unless-stopped"
    labels: Optional[Dict[str, str]] = {}
    build_args: Optional[Dict[str, str]] = {}


class AppUpdate(BaseModel):
    name: Optional[str] = None
    repo_url: Optional[str] = None
    branch: Optional[str] = None
    internal_port: Optional[int] = None
    volumes: Optional[List[str]] = None
    root_dir: Optional[str] = None
    pre_build_steps: Optional[List[str]] = None
    post_build_steps: Optional[List[str]] = None
    env_vars: Optional[Dict[str, str]] = None
    credential_id: Optional[UUID] = None
    retention_limit: Optional[int] = None
    retention_days: Optional[int] = None

    command: Optional[str] = None
    entrypoint: Optional[List[str]] = None
    healthcheck: Optional[Dict[str, Any]] = None
    restart: Optional[str] = None
    labels: Optional[Dict[str, str]] = None
    build_args: Optional[Dict[str, str]] = None


class CredentialCreate(BaseModel):
    name: str
    type: str # "SSH" or "PAT"
    value: str # Raw private key or PAT token


class CredentialResponse(BaseModel):
    id: UUID
    name: str
    type: str
    created_at: datetime

    class Config:
        from_attributes = True


class AppAccessBase(BaseModel):
    user_id: UUID
    role: str


class ProfileCreate(BaseModel):
    username: str


class ProfileResponse(BaseModel):
    user_id: UUID
    username: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    cpu_limit: float = 0.5
    memory_limit_mb: int = 512
    pids_limit: int = 100

    class Config:
        from_attributes = True


class UserSettingsBase(BaseModel):
    notifications_enabled: Dict[str, bool]
    appearance_mode: str


class UserSettingsResponse(UserSettingsBase):
    class Config:
        from_attributes = True


class APIKeyCreate(BaseModel):
    name: str
    validity_days: Optional[int] = 7 # 1, 2, 3, 7


class APIKeyResponse(BaseModel):
    id: UUID
    name: str
    key_prefix: str
    secret_key: Optional[str] = None
    created_at: datetime
    expires_at: Optional[datetime] = None
    last_used_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class APIKeyFullResponse(APIKeyResponse):
    pass


class AppAccessCreate(AppAccessBase):
    pass


class AppAccessResponse(AppAccessBase):
    id: UUID
    created_at: datetime
    profile: Optional[ProfileResponse] = None

    class Config:
        from_attributes = True


class AppResponse(BaseModel):
    id: UUID
    owner_id: Optional[UUID] = None
    name: str
    repo_url: str
    branch: str
    stack: str
    internal_port: int
    volumes: List[str]
    root_dir: str
    pre_build_steps: List[str]
    post_build_steps: List[str]
    env_vars: Dict[str, str]
    created_at: datetime
    updated_at: datetime
    role: Optional[str] = "OWNER" # Computed field for the current user
    owner_profile: Optional[ProfileResponse] = None
    access_list: Optional[List[AppAccessResponse]] = []
    credential_id: Optional[UUID] = None
    
    retention_limit: int = 10
    retention_days: int = 30

    command: Optional[str] = None
    entrypoint: Optional[List[str]] = None
    healthcheck: Optional[Dict[str, Any]] = None
    restart: str = "unless-stopped"
    labels: Dict[str, str] = {}
    build_args: Dict[str, str] = {}

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
    owner_id: Optional[UUID] = None
    app_id: Optional[UUID] = None
    build_number: Optional[int] = None
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
    owner_id: Optional[UUID] = None
    message: str
    created_at: datetime

    class Config: 
        from_attributes = True


class JobLogsResponse(BaseModel):
    job_id: UUID
    logs: List[LogResponse]

    class Config:
        from_attributes = True
