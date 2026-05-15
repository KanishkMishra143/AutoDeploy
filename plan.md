# AutoDeploy Project Plan: The PaaS Vision

> **MANDATORY NON-DESTRUCTIVE LOGGING RULE:** Never delete or simplify detailed task lists or day-by-day progress in this file. Only add new information and tick off completed tasks. This file serves as the definitive audit trail for the project's evolution.

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

## ✅ PHASE 3 — The "Canvas" Dashboard (V1) (COMPLETED)
**Goal:** Visualize the system state early to maintain momentum. Inspired by Railway's service grid.

### 📅 Day-by-Day Progress
- [x] **Day 1–2 — Frontend Foundation & Service Grid:**
    - **Task:** Setup React/Next.js with a modern PaaS aesthetic (Dark Mode).
    - **Sub-task:** Build the "Canvas" layout where jobs/services are displayed as interactive nodes.
    - *Deliverable: Visual grid showing all active and historical jobs.*
- [x] **Day 3 — Live Streaming Logs (WebSocket):**
    - **Task:** Implement a real-time log viewer.
    - **Sub-task:** Connect FastAPI WebSockets to the `Log` model to stream worker output live.
    - *Deliverable: Terminal-style log window in the browser for every job.*
- [x] **Day 4–5 — Action Controls & Heartbeats:**
    - **Task:** Implement remote control buttons on the Canvas and dynamic health monitoring.
    - **Sub-task:** Connect API and Worker heartbeats to the dashboard badges.
    - *Deliverable: Fully interactive management dashboard with real-time health metrics.*

---

## ✅ PHASE 4 — The Build Engine: Docker Integration (COMPLETED)
**Goal:** Teach the worker how to build and run code (The "Body").

### 📅 Day-by-Day Progress
- [x] **Day 1–2 — Secure Workspace & Git logic:**
    - **Task:** Implement isolated workspace management for workers.
    - **Sub-task:** Securely clone remote Git repositories into temporary build folders.
    - *Deliverable: Worker can pull source code from any public/private repo.*
- [x] **Day 3–4 — Subprocess Engine & Docker Build:**
    - **Task:** Create a safe wrapper for shell command execution.
    - **Sub-task:** Execute `docker build` and stream output directly to our Log Engine.
    - *Deliverable: Automated creation of Docker images from source code.*
- [x] **Day 5 — Docker Run & Lifecycle:**
    - **Task:** Automate `docker run` with dynamic port mapping.
    - **Sub-task:** Implement container cleanup logic for failed builds.
    - *Deliverable: Applications running in isolated containers.*

---

## ✅ PHASE 5 — Networking & Service Discovery (COMPLETED)
**Goal:** Automatically route internet traffic to your hosted containers with live URLs.

### 📅 Day-by-Day Progress
- [x] **Day 1–2 — Reverse Proxy Integration:**
    - **Task:** Setup **Traefik** or **Nginx** as the entry point.
    - **Sub-task:** Configure dynamic routing based on Docker container labels.
    - *Deliverable: Automated routing from the internet to internal containers.*
- [x] **Day 3–4 — Dynamic Subdomains:**
    - **Task:** Logic to assign internal URLs (e.g., `app-xyz.autodeploy.local`).
    - **Sub-task:** Update the Canvas UI to display the "Live Link" for every successful deploy.
    - *Deliverable: One-click access to deployed applications.*

---

## ✅ PHASE 6 — Developer Experience: Webhooks & Secrets (COMPLETED)
**Goal:** Achieve the "Deploy on Push" experience of Render and Railway.

### 📅 Day-by-Day Progress
- [x] **Day 1–2 — GitHub Webhook API:**
    - **Task:** Create an endpoint to receive and verify GitHub/GitLab webhooks.
    - **Sub-task:** Automatically trigger a `DEPLOY` job on every code push.
    - *Deliverable: Fully automated CI/CD pipeline.*
- [x] **Day 3–4 — Environment & Secrets Management:**
    - **Task:** Build a secure system for Environment Variables.
    - **Sub-task:** Inject these secrets into Docker containers at runtime.
    - *Deliverable: Support for databases, API keys, and sensitive config.*

---

## ✅ PHASE 7 — Production Hardening (COMPLETED)
**Goal:** Security, Resource Limits, and High Availability.

### 📅 Day-by-Day Progress
- [x] **Day 1–2 — Resource Quotas:**
    - **Task:** Implement CPU and RAM limits for hosted containers using Docker Cgroups.
    - **Sub-task:** Enforced 512MB RAM and 0.5 CPU limits per container.
- [x] **Day 3–4 — Rollbacks & Versioning:**
    - **Task:** Implement "One-click Rollback" to a previous successful image.
    - **Sub-task:** Versioned History with one-click restoration logic and provenance tracking.
- [x] **Day 5 — Multi-Node Scaling & HA:**
    - **Task:** Distribute workers across multiple physical servers (Future/Infrastructure).
    - **Sub-task:** Enabled Docker auto-restart policies (`unless-stopped`) and Image Pruning on termination.
    - *Deliverable: A professional, production-grade deployment platform.*

---

## ✅ PHASE 8 — Full-Stack Control & Topology Map (COMPLETED)
**Goal:** Evolve the dashboard from a "Viewer" to a "Controller" with an interactive Visual Topology.

### 📅 Day-by-Day Progress
- [x] **Day 1–2 — GUI Project Creation & Forms:**
    - [x] Build interactive forms for new deployments (Application Name, Git URL, Env Vars).
    - [x] Implemented Application Identity model to provide stable names and permanent URLs.
    - [x] *Deliverable: Stable Application Identity model in the database.*
- [x] **Day 3–5 — Visual Topology Map:**
    - [x] Upgrade the Service Grid into a node-based network map (using React Flow).
    - [x] Visually draw connections between Applications and the Traefik Gateway with live animations.
    - [x] Built a tabbed Deep-Dive UI to separate map views from history.
    - [x] *Deliverable: A beautiful, interactive map of your infrastructure with human-readable provenance labels.*

---

## ✅ PHASE 9 — Smart Templates & Custom Plans (COMPLETED)
**Goal:** Introduce intelligent project detection, customizable deployment pipelines, and auto-healing.

### 📅 Day-by-Day Progress
- [x] **Day 1–2 — Explicit Stacks & Template Injection:**
    - [x] Allow users to choose their tech stack (Python/Node/Static) during creation.
    - [x] Worker injects standard Dockerfiles if native ones are missing.
    - [x] Implemented dynamic branch discovery and targeted branch cloning.
    - [x] Added "Delete Application" GUI feature with full container cleanup.
    - [x] Enhanced History UI with direct "Terminal" log access.
    - [x] *Deliverable: Frictionless onboarding for standard frameworks with branch support.*
- [x] **Day 3 — UI/UX Overhaul & Refinement (The "Acrylic" Sweep):**
    - [x] **Header Transformation:** Implemented a blurred acrylic header with a new branding logo, search bar, and system health monitors (API/Worker status).
    - [x] **User Identity:** Added user profile controls with a Settings page and logout placeholders.
    - [x] **Card Intelligence:** Enhanced Application cards with branch indicators and live "Task Progress" popups.
    - [x] **Notification Engine:** Integrated `react-hot-toast` for operational feedback and built a custom Confirmation Modal system.
    - [x] **UX Polish:** Fixed "Terminal" button in deployment history and added branch-aware deployment tracking.
- [x] **Day 4 — Advanced UI Polish & Notification Pane:**
    - [x] **Header Refinement:** Linked logo to canvas and added ESC key support for all menus.
    - [x] **Settings Evolution:** Decoupled Danger Zone into a dedicated tab and added placeholders for Security/Billing.
    - [x] **Task Visibility:** Restyled progress popups for better visual weight and alignment.
    - [x] **Notification Center:** Built a dedicated activity feed pane to track detailed system events.
    - [x] **Operational Feedback:** Implemented automated toasts for successful/failed deployment completions.
- [x] **Day 5 — Customizable Deployment DAG (Directed Acyclic Graph):**
    - [x] Allow users to insert manual steps (e.g., "Run DB Migration") before or after the standard build step.
    - [x] Refactor Celery tasks into 'Chains' to execute these custom steps sequentially.
    - [x] Verified Webhooks and History UI to support custom DAG steps.
    - [x] Robust container replacement logic to prevent naming conflicts.
    - [x] *Deliverable: Highly flexible deployment pipelines that adapt to complex user needs.*
- [x] **Day 6 — Error-Handling Sub-Templates:**
    - [x] **Task:** Create specific worker logic triggered by known log errors (e.g., 'Port in use', 'Missing dependency').
    - [x] **Sub-task:** Automatically scan logs for error patterns and provide actionable suggestions in the UI.
    - [x] *Deliverable: A self-diagnosing platform that actively helps developers fix failed builds.*

---

## 🔐 PHASE 10 — Enterprise Identity & Security (CURRENT)
**Goal:** Transition from a local tool to a multi-tenant platform using Supabase for DB & Auth.

### 📅 Day-by-Day Progress
- [x] **Day 1 — The Hybrid Migration (Supabase DB):**
    - **Task:** Migrate the local PostgreSQL schema to Supabase.
    - **Sub-task:** Update API and Worker to connect via the Supabase Connection String.
    - *Deliverable: A "Cloud Brain" that connects local workers to remote state.*
- [x] **Day 2 — OAuth & JWT Integration:**
    - **Task:** Implement GitHub Login using Supabase Auth.
    - **Sub-task:** Secure FastAPI endpoints using JWT verification from Supabase.
- [x] **Day 3 — Role-Based Access Control (RBAC):**
    - **Task:** Define Admin vs. Viewer roles and implement Ownership logic (Users only see their own apps).
    - **Implementation:** Added `owner_id` to Application, Job, and Log models with strict filtering in API routes.
- [ ] **Day 4 — Advanced Secrets:** Integration with HashiCorp Vault or AWS Secrets Manager.

---

## 💻 PHASE 11 — The AutoDeploy CLI
**Goal:** Provide professional developers with total terminal control, running parallel to the GUI.

### 📅 Day-by-Day Progress
- [ ] **Day 1–2 — CLI Foundation:**
    - **Task:** Build a CLI tool using Python (Click/Typer) or Go.
    - **Sub-task:** Implement authentication and secure session management.
    - *Deliverable: A lightweight command-line tool connected to the AutoDeploy API.*
- [ ] **Day 3–4 — CLI/GUI Parity:**
    - **Task:** Implement commands like `deploy login`, `deploy init`, `deploy up`, and `deploy logs`.
    - **Sub-task:** Ensure any action taken in the CLI instantly reflects on the live Canvas GUI.
    - *Deliverable: True parallel workflows—start in the terminal, monitor in the dashboard.*

---

## 📦 PHASE 12 — Enterprise-Grade Distribution
**Goal:** Deliver a "Big Tech" installation experience where the GUI, CLI, and Engine are seamlessly deployed as a single, professional product.

### 📅 Day-by-Day Progress
- [ ] **Day 1–2 — The Unified Service Bundle:**
    - **Task:** Bundle the FastAPI server, Celery Worker, Redis, and Postgres into a managed background service.
    - **Sub-task:** Ensure the desktop app can start/stop these services automatically upon launch.
    - *Deliverable: A self-contained "PaaS-in-a-Box" that requires no manual setup.*
- [ ] **Day 3–4 — System PATH & IDE Integration:**
    - **Task:** Automate the injection of the AutoDeploy CLI binary into the Windows System PATH.
    - **Sub-task:** Create a specific integration script to ensure the CLI is instantly recognized by VS Code terminals.
    - *Deliverable: Users can open any terminal and type `deploy` immediately after installation.*
- [ ] **Day 5–6 — The Universal Installer:**
    - **Task:** Create a professional `.msi` or `.exe` installer (using tools like WiX or NSIS).
    - **Sub-task:** Handle all prerequisites (including Docker Desktop detection).
    - *Deliverable: A premium installation wizard that feels like a finished, multi-billion dollar product.*
- [ ] **Day 7 — Branding & Quality Assurance:**
    - **Task:** Finalize custom app icons, splash screens, and digitally sign the installer.
    - **Sub-task:** Perform "Clean Install" tests on fresh Windows machines to guarantee consistent GUI/CLI results.
    - *Deliverable: A high-fidelity, production-ready release package.*
---

## 💸 PHASE 13 — Scaling & Monetization (The PaaS Business)
**Goal:** Infrastructure for team-based scaling and resource management.
- [x] **Log Batching & Performance:**
    - **Implementation:** Implemented Redis Pub/Sub for real-time streaming and hybrid DB batching (50 lines/5s) in the worker.
    - **Frontend:** Optimized LogViewer with $O(1)$ deduplication and historical log backfilling.
- [ ] **Audit Logging:**
    - **Task:** Track every user action (who deployed what and when) for enterprise compliance.
- [ ] **Audit Logging:**
    - **Task:** Track every user action (who deployed what and when) for enterprise compliance.
- [ ] **Team Workspaces:** Allow multiple developers to share a project/cluster.
- [ ] **Resource Quotas:** Limit CPU/RAM usage per team or project.
- [ ] **Usage-Based Billing:** Implement Stripe integration for "Pay as you go" container hosting.
- [ ] **Custom Domains & SSL:** Automated Let's Encrypt provisioning for production URLs.
