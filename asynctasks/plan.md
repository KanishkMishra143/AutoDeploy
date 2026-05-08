# AutoDeploy Project Plan: AsyncTasks Core

## 🚀 PHASE 1 — AsyncTasks Core (Week 1)
**Goal:** Basic job system working end-to-end.

### 📅 Day-by-Day Progress
- [x] **Day 1 — Setup + Skeleton**
    - Setup project structure.
    - Install: FastAPI, Redis, Celery, PostgreSQL.
    - Create basic FastAPI app.
    - *Deliverable: API runs.*
- [x] **Day 2 — DB + Job Model**
    - Create job table (id, status, payload).
    - Connect DB.
    - *Deliverable: Can create job in DB.*
- [x] **Day 3 — Job API**
    - `POST /jobs` implemented.
    - Store job in DB.
    - Return `job_id`.
    - *Deliverable: Job creation works.*
- [x] **Day 4 — Redis + Celery Setup**
    - Setup Celery app.
    - Connect Redis.
    - Create dummy task (`process_deployment`).
    - *Deliverable: Worker runs task.*
- [x] **Day 5 — Connect API → Queue**
    - When job created → push to queue using `.delay()`.
    - *Deliverable: API triggers worker.*
- [x] **Day 6 — Worker Updates DB**
    - Worker updates status to `running` and `success`.
    - *Deliverable: Full cycle works.*
- [x] **Day 7 — Cleanup + Stability**
    - Fix bugs, clean structure, proper logging.
    - *Deliverable: Stable MVP.*

---

## 🚀 PHASE 2 — Reliability (Week 2)
**Goal:** Make the system "real" and production-ready.

### 📅 Day-by-Day Progress
- [x] **Day 1 — Status Lifecycle**
    - Implement full status transitions (queued -> running -> success/failed).
    - Ensure status is atomic in the database.
    - *Deliverable: Job state transitions accurately.*
- [x] **Day 2 — Retry System**
    - Configure Celery task retries with exponential backoff.
    - Add `max_retries` and `retry_delay` configuration.
    - *Deliverable: Failed tasks auto-retry gracefully.*
- [x] **Day 3 — Failure Handling**
    - Implement global error catching in tasks.
    - Capture and store detailed stack traces/errors in the DB.
    - *Deliverable: Detailed error reporting for debugging.*
- [x] **Day 4 — Logging System**
    - Redirect worker stdout/stderr to a log capture system.
    - Associate execution logs with specific `job_id`.
    - *Deliverable: Execution logs viewable via API.*
- [x] **Day 5 — Job Types & Routing**
    - Refactor task logic to handle multiple job types (e.g., `DEPLOY`, `SCAN`).
    - Implement task routing for specialized workers if needed.
    - *Deliverable: Extensible multi-task system.*
- [ ] **Day 6 — Idempotency**
    - Implement locking (Redis) to prevent duplicate job execution.
    - Handle edge cases where two workers pick up the same job ID.
    - *Deliverable: Guaranteed single execution per job.*
- [ ] **Day 7 — Polish & Testing**
    - Write unit tests for core API and Worker logic.
    - Refactor database session management for stability.
    - *Deliverable: Production-ready codebase.*

---

## 🚀 PHASE 3 — Dashboard (Week 3)
**Goal:** Make it visible.

### 📅 Day-by-Day Progress
- [ ] **Day 1–2 — Frontend Setup & Jobs List**
    - Setup UI framework (e.g., FastAPI with Jinja2 or a simple SPA).
    - Create a paginated list view of all jobs in the system.
    - *Deliverable: Web UI showing job history.*
- [ ] **Day 3 — Status View & Details**
    - Build a detailed view for individual jobs.
    - Display job metadata, payload, and current status visually.
    - *Deliverable: Detailed job inspection via UI.*
- [ ] **Day 4 — Control Actions**
    - Add UI controls to manually trigger retries.
    - Implement "Cancel/Abort" button for running tasks.
    - *Deliverable: Remote control of jobs from dashboard.*
- [ ] **Day 5 — Filters & Search**
    - Add filtering by status (Failed, Running, etc.).
    - Implement search functionality by ID or payload content.
    - *Deliverable: High-speed job lookup.*
- [ ] **Day 6–7 — Real-time Updates & Polish**
    - Implement auto-refresh or WebSockets for live status changes.
    - Improve UI/UX with modern styling and responsive design.
    - *Deliverable: Live, responsive deployment dashboard.*

---

## 🚀 PHASE 4 — AutoDeploy Integration (Week 4+)
**Goal:** Transform the engine into a template-driven deployment pipeline.

### 📅 Day-by-Day Progress
- [ ] **Day 1 — Repository Discovery**
    - Implement task to clone remote Git repositories to isolated workspaces.
    - Ensure secure handling of temporary files and cleanup.
    - *Deliverable: Worker can access source code.*
- [ ] **Day 2 — Template-Based Validation**
    - Instead of auto-detecting, use user-selected categories (e.g., Python, Node).
    - Logic to verify category-specific files (e.g., `requirements.txt` for Python).
    - *Deliverable: Reliable "Ready to Deploy" check.*
- [ ] **Day 3 — Configuration Generation**
    - Auto-generate Dockerfiles and cloud-specific manifests based on the selected template.
    - Validate generated configurations before execution.
    - *Deliverable: Deployment artifacts generated.*
- [ ] **Day 4 — User Approval & Secrets**
    - Implement "Paused" state for jobs requiring manual input.
    - API to allow users to provide environment variables and secrets before build.
    - *Deliverable: Interactive, gated deployment pipeline.*
- [ ] **Day 5 — Build & Registry Integration**
    - Execute Docker builds within the worker environment.
    - Push images to local or remote registries (Docker Hub/GHCR).
    - *Deliverable: Built image ready for deployment.*
- [ ] **Day 6 — Orchestration & Deployment**
    - Trigger final deployment to target (Docker Compose, K8s, or Cloud).
    - Monitor initial health status post-deployment.
    - *Deliverable: Application is live and verified.*
- [ ] **Day 7 — End-to-End Validation**
    - Conduct full-cycle tests from Git URL + Category Selection to live application.
    - Finalize documentation and architecture diagrams.
    - *Deliverable: Fully automated CI/CD engine.*
