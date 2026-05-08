# AsyncTasks (AutoDeploy Core)

> **MANDATORY PRESERVATION RULE:** The "Persistent Progress Log" section below must NEVER be deleted or concatenated. Every daily log entry must remain present forever. Only the log for the current active day may be modified during a session.

## Persistent Progress Log

### 📅 Friday, May 8, 2026
- **Status:** Phase 1, Day 5 Complete.
- **Milestones:**
    - Established core infrastructure: FastAPI, Redis, Celery, and PostgreSQL.
    - Successfully integrated API and Worker: `POST /jobs` now enqueues a `process_deployment` task in Redis.
    - Verified end-to-end flow: API -> Redis -> Worker execution (with simulated 5s delay).
    - Refactored `plan.txt` to `plan.md` and expanded Phase 4 to include a multi-step intelligent deployment pipeline (Discovery, Analysis, User Approval, Generation, Deployment).
- **Next Task:** Day 6 — Worker Updates DB (Teaching the worker to report progress back to PostgreSQL).

---

AsyncTasks is the "execution brain" and foundational backend infrastructure for **AutoDeploy**, an automated deployment platform. It manages asynchronous deployment tasks, background workers, and job tracking.

## Project Overview

- **Core Goal:** To provide a robust, scalable, and reliable asynchronous job processing system for deployment workflows.
- **Long-Term Vision (AutoDeploy):**
    - Analyze repository requirements.
    - Generate infrastructure/config automatically.
    - Deploy using Docker and cloud providers.
    - Manage complex deployment pipelines asynchronously.

## Architecture & Technology Stack

The system follows a decoupled architecture separating request handling from task execution.

| Component | Technology | Responsibility |
| :--- | :--- | :--- |
| **API Layer** | FastAPI | Receives requests, validates payloads, manages job records. |
| **Worker System** | Celery | Executes long-running tasks asynchronously. |
| **Message Broker** | Redis | Orchestrates communication between API and Workers. |
| **Database** | PostgreSQL | Persists job state, metadata, and execution history. |
| **ORM** | SQLAlchemy | Direct usage (Synchronous, no SQLModel, no Repository pattern yet). |
| **Package Mgmt** | `uv` | Dependency and environment management. |

## Project Structure

```text
asynctasks/
├── api/                # FastAPI application layer
│   ├── main.py         # Entry point & App configuration
│   ├── models.py       # SQLAlchemy ORM models (Job table)
│   ├── database.py     # Engine, SessionLocal, and Base setup
│   ├── schemas.py      # Pydantic models for validation
│   └── routes/         # API endpoint definitions (jobs.py)
├── worker/             # Celery worker layer
│   ├── celery_app.py   # Celery configuration & connection to Redis
│   └── tasks.py        # Asynchronous task definitions
├── docker-compose.yml  # Local infra (Postgres, Redis)
├── pyproject.toml      # Dependency management via uv
└── plan.txt            # Detailed development roadmap
```

## Current State & Roadmap

### Status: Phase 1 (Completed through Day 4)
- [x] **Day 1-2:** Infrastructure setup (FastAPI, Redis, Celery, Postgres) and DB/Job model creation.
- [x] **Day 3:** API implemented (`POST /jobs`) with DB persistence.
- [x] **Day 4:** Worker infrastructure confirmed with dummy tasks.

### IMPORTANT: Integration Gap
As of the current state, **Jobs are NOT yet connected to Celery execution.**
- `POST /jobs` saves a row to the DB and returns a response.
- It does **not** yet trigger a Celery task.

### Immediate Priority: Day 5 — Connect API → Queue
The next milestone is to bridge the gap:
1. `POST /jobs` creates DB record.
2. API calls `task.delay()` to enqueue the job in Redis.
3. Worker picks up the job and executes the deployment logic.

## Engineering Constraints & Decisions

- **Direct SQLAlchemy:** We are using SQLAlchemy directly, not SQLModel.
- **Simplicity over Abstraction:** No Repository or Service layers yet. Architecture simplicity is prioritized to deeply understand the execution flow.
- **Synchronous DB:** Database interactions are currently synchronous.
- **No Migrations:** Alembic is not yet integrated; `Base.metadata.create_all` is used for table generation.

## Development Workflows

### Setup & Running
1. **Sync Env:** `uv sync`
2. **Infra:** `docker-compose up -d`
3. **Run API:** `uv run fastapi dev api/main.py`
4. **Run Worker:** `uv run celery -A worker.celery_app worker --loglevel=info`

### Job Lifecycle (Target)
1. `queued`: Record created in DB.
2. `running`: Worker has picked up the task.
3. `success` / `failed`: Final execution state.

## Architectural Philosophy
This is not a simple CRUD API. It is being built as a scalable CI/CD orchestration engine. Every decision should align with high-availability, failure handling, and event-driven backend principles.
