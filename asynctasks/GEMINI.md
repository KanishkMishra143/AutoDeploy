# AutoDeploy: The Next-Gen PaaS (AsyncTasks)

> **MANDATORY PRESERVATION RULE:** The "Persistent Progress Log" section below must NEVER be deleted or concatenated. Every daily log entry must remain present forever. Only the log for the current active day may be modified during a session.

> **MANDATORY NON-DESTRUCTIVE LOGGING RULE:** Never delete or simplify detailed project information or architectural notes in this file. Only add new information to maintain a complete history of the project's evolution.

## Persistent Progress Log

### 📅 Wednesday, May 13, 2026
- **Status:** Phase 10 Day 1 & 2 COMPLETE.
- **Milestones:**
    - **Dynamic Notifications:** Implemented real-time notification dot logic in the header. The dot now only appears when there are unread system events (not in `localStorage`) and updates instantly when items are dismissed.
    - **UX Shortcut Polish:** Enforced the "No Back-Drop Spawning Rule" for the Command Palette (`Ctrl+K`).
    - **Shortcut Behavior:** Fixed `Ctrl+K` to always `preventDefault()` browser behavior, even when spawning is blocked by an active modal.
    - **UI Layout Fixes:** Adjusted the Settings page layout to increase header spacing, ensuring the "Back to Canvas" navigation is fully accessible and clickable.
    - **Visual Consistency:** Standardized the shortcut hints in the Command Palette to match the Header's badge style.
- **Next Task:** 
    1. **Phase 10 Day 3:** Role-Based Access Control (RBAC) - Admin vs. Viewer roles.
    2. **Ownership Logic:** Ensure users only see and manage their own applications.

## Mentor Memory (Architectural Notes)
- **Hybrid Architecture (Phase 10+):** The project now uses a Hybrid Cloud model.
    - **Database & Auth:** Hosted on Supabase (Cloud).
    - **API & Worker:** Run locally on the host machine/WSL for Docker access.
- **Manual Schema Migrations:** Because we use Supabase, SQLAlchemy's `create_all()` will NOT add new columns to existing tables. When updating `models.py`:
    1.  Update the Python model.
    2.  Go to the Supabase **SQL Editor**.
    3.  Run an `ALTER TABLE ... ADD COLUMN ...` command to match the new model.
- **Database Locality (DEPRECATED):** Previously used local Postgres. Now uses `SUPABASE_DB_URL` from `.env`.
- **Timezone Sync:** Always use `datetime.utcnow()` for heartbeats to ensure the API, Worker, and DB are synchronized.
- **Vertical vs. Horizontal Scaling:** A single Celery worker node can handle multiple tasks (Vertical/Concurrency) via prefork processes, while multiple nodes (Horizontal) provide redundancy and cross-machine scale.
- **WSL Interop:** When working in WSL, ensure the Linux toolchain (node/npm) is used to avoid path and permission collisions with Windows binaries.
- **Traefik v2.11:** Use v2.11 for better WSL compatibility. Ensure labels use backticks (`` ` ``) for Host rules and the container is on the `autodeploy-net` network.
- **App Identity**: Containers are now named `autodeploy_{app_name}`, ensuring that new deployments replace old ones automatically while maintaining stable URLs.
- **Job Provenance**: Track the `trigger_reason` and `trigger_metadata` for every job to provide a clear audit trail for the developer.
- **UI/UX Laws (The AutoDeploy Standard):**
    - **Modal Dismissal (The Top-Most Rule):** Every modal must handle the `Escape` key and "Click outside to close" (void clicking). The dismissal logic MUST be smart: only the top-most modal (highest z-index) should be dismissed by a single ESC press. Use the `z-index` check logic to verify if the current modal is the top one before closing.
    - **Interactive Feedback:** Actions that take time (deploys, saves) must show immediate visual feedback via `react-hot-toast` and loading states (e.g., `Loader2` spin).
    - **Status Color Palette:** Consistency in status representation is mandatory:
        - `Success`: Green (`bg-green-500`, `text-green-500`)
        - `Running`: Blue (`bg-blue-500`, `text-blue-500`) with pulse/spin animation.
        - `Failed`: Red (`bg-red-500`, `text-red-500`)
        - `Pending/Queued`: Yellow (`bg-yellow-500`, `text-yellow-500`)
        - `Stopped/Neutral`: Gray (`bg-gray-500`, `text-gray-500`)
    - **Interactive Badges:** Status indicators on the main dashboard should be "Smart Badges"—clickable shortcuts to logs or relevant details, highlighted by a terminal icon on hover.
    - Typography & Motion: Use high-contrast, uppercase tracking for labels and headers (`tracking-widest`, `font-black`). Modals must use `animate-in fade-in zoom-in-95` for entrance animations.
    - Modal Exclusivity (The No Back-Drop Spawning Rule): Global shortcuts like `Ctrl+K` (Command Palette) MUST be disabled if any other modal (Deploy, History, Settings, Logs, etc.) is currently open. This prevents UI "stacking" where a new utility spawns behind an active modal, creating a confusing and inaccessible experience.


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
└── plan.md             # The 13-Phase Strategic Roadmap
```

## Strategic Roadmap (13 Phases)

1.  **Phase 1 (COMPLETED):** AsyncTasks Core & Basic Job Lifecycle.
2.  **Phase 2 (COMPLETED):** Reliability, Distributed Locking, and Orchestration.
3.  **Phase 3 (COMPLETED):** The "Canvas" Dashboard (Live logs and visual status).
4.  **Phase 4 (COMPLETED):** Build Engine: Native Docker integration and Subprocess logic.
5.  **Phase 5 (COMPLETED):** Networking: Dynamic Routing & Reverse Proxy (Traefik).
6.  **Phase 6 (COMPLETED):** Dev Experience: Webhooks (Deploy on Push) & Secrets.
7.  **Phase 7 (COMPLETED):** Production Hardening: Resource Quotas & Rollbacks.
8.  **Phase 8 (COMPLETED):** Full-Stack Control & Topology Map.
9.  **Phase 9 (COMPLETED):** Smart Templates & Custom Plans.
10. **Phase 10 (CURRENT):** Enterprise Identity & Security.
11. **Phase 11:** The AutoDeploy CLI.
12. **Phase 12:** Enterprise-Grade Distribution.
13. **Phase 13:** Scaling & Monetization.

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
