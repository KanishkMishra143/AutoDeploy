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
- [ ] **Day 6 — Worker Updates DB**
    - Worker updates status to `running` and `success`.
    - *Deliverable: Full cycle works.*
- [ ] **Day 7 — Cleanup + Stability**
    - Fix bugs, clean structure, proper logging.
    - *Deliverable: Stable MVP.*

---

## 🚀 PHASE 2 — Reliability (Week 2)
**Goal:** Make the system "real" and production-ready.

- [ ] **Day 1:** Status lifecycle (queued / running / success / failed).
- [ ] **Day 2:** Retry system (max retries, retry delay).
- [ ] **Day 3:** Failure handling (catch exceptions, mark failed).
- [ ] **Day 4:** Logging system (store logs in DB or file).
- [ ] **Day 5:** Job types system (type field, handler per type).
- [ ] **Day 6:** Idempotency (prevent duplicate execution).
- [ ] **Day 7:** Polish (refactor + test).

---

## 🚀 PHASE 3 — Dashboard (Week 3)
**Goal:** Make it visible.

- [ ] **Day 1–2:** Simple frontend OR FastAPI templates (Show jobs list).
- [ ] **Day 3:** Status view.
- [ ] **Day 4:** Retry button.
- [ ] **Day 5:** Filters (failed jobs).
- [ ] **Day 6–7:** UI polish.

---

## 🚀 PHASE 4 — AutoDeploy Integration (Week 4+)
**Goal:** Transform the engine into an intelligent, multi-step deployment pipeline.

- [ ] **Phase 4A: Discovery & Analysis (Workers)**
    - Clone target repository into an isolated workspace.
    - Analyze repository structure (e.g., detect `package.json`, `requirements.txt`, `Dockerfile`).
    - Determine project category and infrastructure requirements.
- [ ] **Phase 4B: User Interaction / Approvals (API)**
    - Pause pipeline and store analysis results in DB.
    - Present deployment plan to user via API (e.g., "React App detected, requires AWS keys").
    - Accept user configuration, environment variables, and approvals.
- [ ] **Phase 4C: Generation & Configuration (Workers)**
    - Generate CI/CD configuration (e.g., GitHub Actions).
    - Generate or configure infrastructure manifests (`docker-compose.yml`, AWS/Azure specs).
- [ ] **Phase 4D: Execution & Deployment (Workers)**
    - Build Docker images.
    - Push images to a registry.
    - Execute deployment to target cloud provider.
