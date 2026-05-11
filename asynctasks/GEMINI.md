# AutoDeploy: The Next-Gen PaaS (AsyncTasks)

> **MANDATORY PRESERVATION RULE:** The "Persistent Progress Log" section below must NEVER be deleted or concatenated. Every daily log entry must remain present forever. Only the log for the current active day may be modified during a session.

> **MANDATORY NON-DESTRUCTIVE LOGGING RULE:** Never delete or simplify detailed project information or architectural notes in this file. Only add new information to maintain a complete history of the project's evolution.

## Persistent Progress Log

### 📅 Monday, May 11, 2026
- **Status:** Phase 9 In Progress.
- **Milestones:**
    - **Smart Templates & Stacks:** Implemented explicit "Stack Selection" (Python, Node.js, Static) during application creation.
    - **Template Injection:** Built a worker engine that injects standard `Dockerfile` templates if a native one is missing, supporting multiple frameworks.
    - **Branch Awareness:** Integrated dynamic branch discovery using `git ls-remote` and updated the worker to support targeted branch cloning.
    - **Dynamic Port Routing:** Resolved "Bad Gateway" issues by implementing dynamic internal port mapping (e.g., port 80 for Static Nginx, 8000 for APIs).
    - **GUI Management:** Added a "Delete Application" feature to the dashboard that cleans up both the database and the running Docker container.
    - **UX Enhancements:** Improved the Deployment History UI with a dedicated "Terminal" icon for instant log access.
- **Next Task:** 
    1. **Urgent Fix:** Repair the "Terminal" log button in the Deployment History tab (Deep-Dive Modal) which is currently non-functional.
    2. Phase 9 Day 3-4 — Customizable Deployment DAG (Directed Acyclic Graph).

## Mentor Memory (Architectural Notes)
- **Timezone Sync:** Always use `datetime.utcnow()` for heartbeats to ensure the API, Worker, and DB are synchronized regardless of local machine settings.
- **Vertical vs. Horizontal Scaling:** A single Celery worker node can handle multiple tasks (Vertical/Concurrency) via prefork processes, while multiple nodes (Horizontal) provide redundancy and cross-machine scale.
- **WSL Interop:** When working in WSL, ensure the Linux toolchain (node/npm) is used to avoid path and permission collisions with Windows binaries.
- **Traefik v2.11:** Use v2.11 for better WSL compatibility. Ensure labels use backticks (`` ` ``) for Host rules and the container is on the `autodeploy-net` network.
- **App Identity**: Containers are now named `autodeploy_{app_name}`, ensuring that new deployments replace old ones automatically while maintaining stable URLs.
- **Job Provenance**: Track the `trigger_reason` and `trigger_metadata` for every job to provide a clear audit trail for the developer.

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

## Strategic Roadmap (9 Phases)

1.  **Phase 1 (COMPLETED):** AsyncTasks Core & Basic Job Lifecycle.
2.  **Phase 2 (COMPLETED):** Reliability, Distributed Locking, and Orchestration.
3.  **Phase 3 (COMPLETED):** The "Canvas" Dashboard (Live logs and visual status).
4.  **Phase 4 (COMPLETED):** Build Engine: Native Docker integration and Subprocess logic.
5.  **Phase 5 (COMPLETED):** Networking: Dynamic Routing & Reverse Proxy (Traefik).
6.  **Phase 6 (COMPLETED):** Dev Experience: Webhooks (Deploy on Push) & Secrets.
7.  **Phase 7 (COMPLETED):** Production Hardening: Resource Quotas & Rollbacks.
8.  **Phase 8 (COMPLETED):** Full-Stack Control & Topology Map.
9.  **Phase 9:** Smart Templates & Custom Plans.

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
