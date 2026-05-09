# AutoDeploy Project Plan: The PaaS Vision

**Goal:** To build a robust, scalable, and developer-friendly Platform as a Service (PaaS) that automates the application lifecycle from Git push to live URL, inspired by the excellence of Railway and Render.

---

## ✅ PHASE 1 — AsyncTasks Core (COMPLETED)
**Goal:** Establish the foundational asynchronous job system.
- [x] Infrastructure setup (FastAPI, Redis, Celery, PostgreSQL).
- [x] Job API (`POST /jobs`) with database persistence.
- [x] Celery worker integration and Redis message brokering.
- [x] Full job lifecycle and database state transitions.

---

## ✅ PHASE 2 — Reliability & Orchestration (COMPLETED)
**Goal:** Make the "Brain" production-ready, fault-tolerant, and collision-proof.

### 📅 Day-by-Day Progress
- [x] **Day 1-2:** Enhanced Job model (`updated_at`, `result`) and Exponential Backoff retries.
- [x] **Day 3:** API Refinement: Dependency Injection and Full Traceback capture.
- [x] **Day 4:** Persistent Logging Engine with relational `Log` model.
- [x] **Day 5:** Multi-Task Router (Universal Worker) for specialized `DEPLOY`/`SCAN` logic.
- [x] **Day 6 — Idempotency & Distributed Locking:**
    - **Task:** Implement Redis-based locking to prevent duplicate job execution.
    - **Sub-task:** Handle worker crashes and lock timeouts (deadlocks).
    - *Deliverable: Guaranteed single execution per job ID.*
- [x] **Day 7 — System Polish & Heartbeats:**
    - **Task:** Implement worker health tracking (Heartbeats).
    - **Sub-task:** Refactor database session management for high-concurrency stability.
    - *Deliverable: Robust, self-monitoring orchestration layer.*

---

## 🚀 PHASE 3 — The "Canvas" Dashboard (V1) (CURRENT)
**Goal:** Visualize the system state early to maintain momentum. Inspired by Railway's service grid.

### 📅 Day-by-Day Progress
- [ ] **Day 1–2 — Frontend Foundation & Service Grid:**
    - **Task:** Setup React/Next.js with a modern PaaS aesthetic (Dark Mode).
    - **Sub-task:** Build the "Canvas" layout where jobs/services are displayed as interactive nodes.
    - *Deliverable: Visual grid showing all active and historical jobs.*
- [ ] **Day 3 — Live Streaming Logs (WebSocket):**
    - **Task:** Implement a real-time log viewer.
    - **Sub-task:** Connect FastAPI WebSockets to the `Log` model to stream worker output live.
    - *Deliverable: Terminal-style log window in the browser for every job.*
- [ ] **Day 4–5 — Action Controls:**
    - **Task:** Implement remote control buttons on the Canvas.
    - **Sub-task:** Add "Retry," "Cancel," and "Clear Logs" triggers to the job cards.
    - *Deliverable: Fully interactive management dashboard.*

---

## 🏗️ PHASE 4 — The Build Engine: Docker Integration
**Goal:** Teach the worker how to build and run code (The "Body").

### 📅 Day-by-Day Progress
- [ ] **Day 1–2 — Secure Workspace & Git logic:**
    - **Task:** Implement isolated workspace management for workers.
    - **Sub-task:** Securely clone remote Git repositories into temporary build folders.
    - *Deliverable: Worker can pull source code from any public/private repo.*
- [ ] **Day 3–4 — Subprocess Engine & Docker Build:**
    - **Task:** Create a safe wrapper for shell command execution.
    - **Sub-task:** Execute `docker build` and stream output directly to our Log Engine.
    - *Deliverable: Automated creation of Docker images from source code.*
- [ ] **Day 5 — Docker Run & Lifecycle:**
    - **Task:** Automate `docker run` with dynamic port mapping.
    - **Sub-task:** Implement container cleanup logic for failed builds.
    - *Deliverable: Applications running in isolated containers.*

---

## 🌐 PHASE 5 — Networking & Service Discovery
**Goal:** Automatically route internet traffic to your hosted containers with live URLs.

### 📅 Day-by-Day Progress
- [ ] **Day 1–2 — Reverse Proxy Integration:**
    - **Task:** Setup **Traefik** or **Nginx** as the entry point.
    - **Sub-task:** Configure dynamic routing based on Docker container labels.
    - *Deliverable: Automated routing from the internet to internal containers.*
- [ ] **Day 3–4 — Dynamic Subdomains:**
    - **Task:** Logic to assign internal URLs (e.g., `app-xyz.autodeploy.local`).
    - **Sub-task:** Update the Canvas UI to display the "Live Link" for every successful deploy.
    - *Deliverable: One-click access to deployed applications.*

---

## ⚡ PHASE 6 — Developer Experience: Webhooks & Secrets
**Goal:** Achieve the "Deploy on Push" experience of Render and Railway.

### 📅 Day-by-Day Progress
- [ ] **Day 1–2 — GitHub Webhook API:**
    - **Task:** Create an endpoint to receive and verify GitHub/GitLab webhooks.
    - **Sub-task:** Automatically trigger a `DEPLOY` job on every code push.
    - *Deliverable: Fully automated CI/CD pipeline.*
- [ ] **Day 3–4 — Environment & Secrets Management:**
    - **Task:** Build a secure system for Environment Variables.
    - **Sub-task:** Inject these secrets into Docker containers at runtime.
    - *Deliverable: Support for databases, API keys, and sensitive config.*

---

## 🛡️ PHASE 7 — Production Hardening
**Goal:** Security, Resource Limits, and High Availability.

### 📅 Day-by-Day Progress
- [ ] **Day 1–2 — Resource Quotas:**
    - **Task:** Implement CPU and RAM limits for hosted containers using Docker Cgroups.
- [ ] **Day 3–4 — Rollbacks & Versioning:**
    - **Task:** Implement "One-click Rollback" to a previous successful image.
- [ ] **Day 5 — Multi-Node Scaling:**
    - **Task:** Distribute workers across multiple physical servers.
    - *Deliverable: A professional, production-grade deployment platform.*
