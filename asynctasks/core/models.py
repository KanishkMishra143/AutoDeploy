import uuid
from sqlalchemy import Column, String, JSON, DateTime, ForeignKey, Text
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
    pre_build_steps = Column(JSON, nullable=True, default=[])
    post_build_steps = Column(JSON, nullable=True, default=[])
    env_vars = Column(JSON, nullable=True, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    jobs = relationship("Job", back_populates="application", order_by="desc(Job.created_at)", cascade="all, delete-orphan")
    access_list = relationship("AppAccess", back_populates="application", cascade="all, delete-orphan")
    owner_profile = relationship("Profile", foreign_keys=[owner_id], primaryjoin="Application.owner_id == Profile.user_id", viewonly=True)


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
