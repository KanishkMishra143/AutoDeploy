import uuid
from sqlalchemy import Column, String, JSON, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from api.database import Base


class Application(Base):
    __tablename__ = "applications"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False, unique=True)
    repo_url = Column(String, nullable=False)
    branch = Column(String, nullable=False, default="main")
    stack = Column(String, nullable=False, default="dockerfile")
    env_vars = Column(JSON, nullable=True, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    jobs = relationship("Job", back_populates="application", order_by="desc(Job.created_at)", cascade="all, delete-orphan")


class Job(Base):
    __tablename__ = "jobs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    app_id = Column(UUID(as_uuid=True), ForeignKey("applications.id"), nullable=True)
    type = Column(String, nullable=False, default="DEPLOY")
    status = Column(String, nullable=False, default="queued")
    trigger_reason = Column(String, nullable=True) # e.g. "Manual", "Webhook", "Rollback"
    trigger_metadata = Column(JSON, nullable=True) # e.g. {"commit_id": "...", "from_version": 4}
    payload = Column(JSON, nullable=False)
    result = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    application = relationship("Application", back_populates="jobs")
    logs = relationship("Log", back_populates="job", cascade="all, delete-orphan")


class Log(Base):
    __tablename__ = "logs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=False)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    job = relationship("Job", back_populates="logs")


class Worker(Base):
    __tablename__ = "workers"
    id = Column(String, primary_key=True)
    status = Column(String, default="online")
    last_heartbeat = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
