import uuid
from sqlalchemy import Column, String, JSON, DateTime, ForeignKey, Text, Integer, Float
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from core.database import Base


class Application(Base):
    __tablename__ = "applications"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(UUID(as_uuid=True), nullable=True) # ID from Supabase Auth
    name = Column(String, nullable=False, unique=True)
    repo_url = Column(String, nullable=False)
    branch = Column(String, nullable=False, default="main")
    stack = Column(String, nullable=False, default="dockerfile")
    internal_port = Column(Integer, nullable=False, default=8000)
    volumes = Column(JSON, nullable=True, default=[]) # List of "host_path:container_path" or relative "path:container_path"
    root_dir = Column(String, nullable=False, default=".") # Relative path from git root
    retention_limit = Column(Integer, nullable=False, default=10) # Max builds to keep
    retention_days = Column(Integer, nullable=False, default=30) # Max age in days
    pre_build_steps = Column(JSON, nullable=True, default=[])
    post_build_steps = Column(JSON, nullable=True, default=[])
    env_vars = Column(JSON, nullable=True, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    jobs = relationship("Job", back_populates="application", order_by="desc(Job.created_at)", cascade="all, delete-orphan")
    access_list = relationship("AppAccess", back_populates="application", cascade="all, delete-orphan")
    owner_profile = relationship("Profile", foreign_keys=[owner_id], primaryjoin="Application.owner_id == Profile.user_id", viewonly=True)
    
    credential_id = Column(UUID(as_uuid=True), ForeignKey("credentials.id"), nullable=True)
    credential = relationship("Credential")


class AppAccess(Base):
    __tablename__ = "app_access"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    app_id = Column(UUID(as_uuid=True), ForeignKey("applications.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.user_id"), nullable=False, index=True)
    role = Column(String, nullable=False, default="VIEWER") # "ADMIN", "VIEWER"
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    application = relationship("Application", back_populates="access_list")
    profile = relationship("Profile", foreign_keys=[user_id], primaryjoin="AppAccess.user_id == Profile.user_id")


class Job(Base):
    __tablename__ = "jobs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(UUID(as_uuid=True), nullable=True, index=True) # ID from Supabase Auth
    app_id = Column(UUID(as_uuid=True), ForeignKey("applications.id"), nullable=True, index=True)
    type = Column(String, nullable=False, default="DEPLOY")
    status = Column(String, nullable=False, default="queued")
    trigger_reason = Column(String, nullable=True) # e.g. "Manual", "Webhook", "Rollback"
    trigger_metadata = Column(JSON, nullable=True) # e.g. {"commit_id": "...", "from_version": 4}
    payload = Column(JSON, nullable=False)
    result = Column(JSON, nullable=True)
    celery_task_id = Column(String, nullable=True) # ID of the root task for cancellation
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    application = relationship("Application", back_populates="jobs")
    logs = relationship("Log", back_populates="job", cascade="all, delete-orphan")


class Log(Base):
    __tablename__ = "logs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(UUID(as_uuid=True), nullable=True, index=True) # ID from Supabase Auth
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=False, index=True)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    job = relationship("Job", back_populates="logs")


class Worker(Base):
    __tablename__ = "workers"
    id = Column(String, primary_key=True)
    status = Column(String, default="online")
    last_heartbeat = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Profile(Base):
    __tablename__ = "profiles"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, unique=True, index=True) # Supabase Auth ID
    username = Column(String, nullable=False, unique=True, index=True)
    full_name = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # --- USER-LEVEL RESOURCE QUOTAS (Task 7) ---
    cpu_limit = Column(Float, nullable=False, default=0.5)
    memory_limit_mb = Column(Integer, nullable=False, default=512)
    pids_limit = Column(Integer, nullable=False, default=100)

    settings = relationship("UserSettings", back_populates="profile", uselist=False, cascade="all, delete-orphan")
    api_keys = relationship("APIKey", back_populates="profile", cascade="all, delete-orphan")


class UserSettings(Base):
    __tablename__ = "user_settings"
    user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.user_id"), primary_key=True)
    notifications_enabled = Column(JSON, nullable=False, default={
        "deploy_success": True,
        "deploy_failure": True,
        "system_health": False,
        "weekly_report": False
    })
    appearance_mode = Column(String, default="acrylic") # acrylic, minimal, high_contrast
    
    profile = relationship("Profile", back_populates="settings")


class APIKey(Base):
    __tablename__ = "api_keys"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.user_id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    key_prefix = Column(String(12), nullable=False) # First 12 chars for display: "ad_live_xxxx"
    key_hash = Column(String, nullable=False, unique=True) # Hashed secret for fast lookup
    secret_key = Column(String, nullable=True) # Raw key for 'visible always' access (Warning: Plaintext storage)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=True)
    last_used_at = Column(DateTime(timezone=True), nullable=True)

    profile = relationship("Profile", back_populates="api_keys")

class Credential(Base):
    __tablename__ = "credentials"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.user_id"), nullable=False, index=True)
    name = Column(String, nullable=False) # e.g. "Github Main PAT"
    type = Column(String, nullable=False) # "SSH" or "PAT"
    # encrypted_value: contains either the private SSH key or the PAT token.
    encrypted_value = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    profile = relationship("Profile")
