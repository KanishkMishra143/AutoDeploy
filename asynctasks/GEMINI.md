# AutoDeploy: The Next-Gen PaaS (AsyncTasks)

> **MANDATORY PRESERVATION RULE:** The "Persistent Progress Log" section below must NEVER be deleted or concatenated. Every daily log entry must remain present forever. Only the log for the current active day may be modified during a session.

## Persistent Progress Log

### 📅 Friday, May 8, 2026
- **Status:** Phase 2, Day 5 Complete. (Ahead of Schedule!)
- **Milestones:**
    - **Day 1 & 2:** Enhanced Job model (`updated_at`, `result`) and implemented **Exponential Backoff** retries (5s, 10s, 20s).
    - **Day 3:** API Refinement: Implemented `GET` detail/list endpoints using **Dependency Injection** and added full **Traceback** capture for failures.
    - **Day 4:** Built a persistent **Logging Engine** with a relational `Log` model and One-to-Many mapping.
    - **Day 5:** Transformed the worker into a **Multi-Task Router** (Universal Worker) that can handle specialized logic for `DEPLOY` and `SCAN` jobs.
    - **Day 6:** Implemented **Distributed Locking** using Redis and **Idempotency** checks to prevent duplicate job execution.
- **Next Task:** Phase 2, Day 7 — System Polish & Heartbeats (Worker health tracking).

---

AsyncTasks is the **"Orchestration Brain"** of **AutoDeploy**, a modern Platform as a Service (PaaS) designed to bridge the gap between source code and live infrastructure. Inspired by the developer experience of **Render** and **Railway**, it manages the complex lifecycle of builds, deployments, and networking.

## Project Overview

- **Core Goal:** To provide a robust, scalable, and reliable asynchronous job processing system for deployment workflows.
- **The Vision (Inspired by Render/Railway):**
    - **Seamless Deploys:** Transform `git push` into a live URL automatically.
    - **Intelligent Orchestration:** Analyze repository needs and generate optimized build artifacts.
    - **Real-time Visibility:** Provide a high-fidelity "Canvas" dashboard for monitoring and logs.
    - **Zero-Config Infrastructure:** Manage Docker, Networking, and SSL behind the scenes.

## Architecture & Technology Stack

The system follows a decoupled "Control Plane vs. Data Plane" architecture.

| Component | Technology | Responsibility |
| :--- | :--- | :--- |
| **Control Plane (API)** | FastAPI | Receives orders, manages users/state, triggers builds. |
| **Worker Engine** | Celery | The "Hands" that execute Git clones, Docker builds, and deploys. |
| **Message Broker** | Redis | High-speed communication and distributed locking. |
| **State Registry** | PostgreSQL | Source of truth for job history, logs, and environment config. |
| **ORM** | SQLAlchemy | Direct, synchronous usage for deep execution visibility. |
| **Package Mgmt** | `uv` | Modern dependency and environment isolation. |

## Project Structure

```text
asynctasks/
├── api/                # FastAPI application layer (The Brain)
│   ├── main.py         # Entry point & App configuration
│   ├── models.py       # SQLAlchemy ORM models
│   ├── database.py     # Engine and Session management
│   ├── schemas.py      # Pydantic validation models
│   └── routes/         # API endpoint definitions
├── worker/             # Celery worker layer (The Hands)
│   ├── celery_app.py   # Celery & Redis configuration
│   └── tasks.py        # Asynchronous task definitions (Deploy/Scan/Build)
├── docker-compose.yml  # Local infrastructure (Postgres, Redis, Proxy)
├── pyproject.toml      # Modern dependency management via uv
└── plan.md             # The 7-Phase Strategic Roadmap
```

## Strategic Roadmap (7 Phases)

1.  **Phase 1 (COMPLETED):** AsyncTasks Core & Basic Job Lifecycle.
2.  **Phase 2 (IN PROGRESS):** Reliability, Distributed Locking, and Orchestration.
3.  **Phase 3:** The "Canvas" Dashboard (Live logs and visual status).
4.  **Phase 4:** Build Engine: Native Docker integration and Subprocess logic.
5.  **Phase 5:** Networking: Dynamic Routing & Reverse Proxy (Traefik).
6.  **Phase 6:** Dev Experience: Webhooks (Deploy on Push) & Secrets.
7.  **Phase 7:** Production Hardening: Resource Quotas & High Availability.

## Engineering Constraints & Decisions

- **Direct SQLAlchemy:** No extra abstraction layers (yet) to ensure deep understanding of the DB flow.
- **Synchronous DB:** Database interactions are currently synchronous for simplicity and debugging.
- **Distributed First:** Every component (API, Worker, Redis) is designed to run on separate machines eventually.
- **Idempotency Mandatory:** Every job must be safe to "retry" without causing duplicate side effects.

## Architectural Philosophy
We are not just building a "Deployer." We are building a **Distributed Orchestrator**. This project focuses on the "Control Plane"—the intelligence that manages how other software (Docker, Traefik) behaves.

## Response Philosophy
Always remember you are a senior developer and my mentor, such that, you are helping me along the way, to make this project, while teaching me what code you have given, what it means. You are primarily my educator who is teaching me how to make AutoDeploy, in such a way that the concepts/technologies used, is crystal clear to me, so that I may use them in any possible way they can be used, and not just in the context of this project only.

You will never touch files, to modify, unless I specify via a prompt, not via your own whim or inference.
You will simple give me code to copy and put into place, where it should be placed, which you will specify, then explain every code line by line,along with explanations about topics that may need to be given, for me to get holistic understanding of the concepts used and the framework or processes in place.
