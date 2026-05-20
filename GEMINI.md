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
### 📅 Thursday, May 14, 2026
- **Status:** Phase 13 (Log Batching) & Path A (Redis Pub/Sub) IMPLEMENTED.
- **Milestones:**
    - **Real-Time Log Architecture (Path A):** Successfully implemented the "Dual-Path" logging engine.
        - **Live Path:** Worker now broadcasts log lines to Redis Pub/Sub channels (`logs:{job_id}`) for instantaneous dashboard updates.
        - **Persistence Path:** Implemented a hybrid buffering strategy in the worker. Logs are buffered in memory and persisted to PostgreSQL in bulk every 50 lines OR every 5 seconds (whichever comes first), significantly reducing database write latency.
    - **WebSocket Integration:** Refined the FastAPI WebSocket endpoint to bridge Redis Pub/Sub messages directly to the React `LogViewer` component.
    - **Performance Optimization:** Reduced database IOPS by moving from "write-per-line" to "batch-insert" while maintaining zero perceived latency for the end user.
    - **High-Performance Deletion:**
        - Refactored application deletion to use direct SQL batch deletes, bypassing SQLAlchemy's slow cascade mechanism.
        - Moved Docker container and image cleanup to a background Celery task, reducing API response time from ~60s to <1s.
    - **Log Engine Robustness:**
        - Added database indexes to `Log.job_id` and `Job.app_id` to accelerate history retrieval and cleanup.
        - Enhanced `LogViewer` UX to distinguish between "Connecting..." and "No logs found" based on job status.
- **Next Task:**
    1. **Phase 10 Day 3:** Role-Based Access Control (RBAC) - Admin vs. Viewer roles.
    2. **Ownership Logic:** Ensure users only see and manage their own applications.

### 📅 Tuesday, May 19, 2026
- **Status:** Private Repo Access & Scheduled Maintenance COMPLETE.
- **Milestones:**
    - **Private Repository Access (Task 5 Fix):** Enabled deployment from private GitHub/GitLab repositories.
        - **Credential Management Engine:** Implemented a new `Credential` model and secure API endpoints to store SSH Private Keys and Personal Access Tokens (PATs).
        - **End-to-End Security:** Secrets are encrypted using `Fernet` before storage and are only decrypted in the worker's memory during the clone phase. Raw secrets never leave the server.
        - **Hybrid Clone Logic:** The worker now supports both `PAT` injection (HTTPS) and `SSH` key mounting (GIT_SSH_COMMAND) with automatic cleanup of temporary key files.
    - **Scheduled Maintenance Engine (Task 4 Fix):** Resolved the "Zombie Image" leakage for long-running servers.
        - **Global Maintenance Task:** Implemented `maintenance_sweep` in the worker, scanning all applications to enforce retention policies.
        - **Proactive Pruning:** Configured Celery Beat to run a global sweep every 24 hours.
    - **Dashboard Branding Sync:** Updated versioning to `v0.5 ALPHA` across the entire UI.
### 📅 Wednesday, May 20, 2026
- **Status:** Core Hardening & Concurrency Protection COMPLETE.
- **Milestones:**
    - **Container Security (Task 7 Fix):** Implemented short-term "Defense in Depth" for user containers.
        - **Resource Quotas:** Applied strict CPU (0.5), Memory (512MB), and Process (100 pids) limits to prevent DoS and resource exhaustion.
        - **Privilege Lockdown:** Enforced `--security-opt no-new-privileges` and `--cap-drop ALL` to prevent container escapes and host takeover.
        - **Process Control:** Added ulimits for file handles and disabled swap to ensure predictable performance and security.
    - **Concurrency & Race Protection (Task 8 Fix):** Resolved the "Double-Click Panic" at both UI and API layers.
        - **Pessimistic Locking:** Implemented `with_for_update()` in SQLAlchemy for all state-changing endpoints (Create, Deploy, Delete).
        - **Frontend Interlocks:** Standardized a "Visual Interlock" pattern across the dashboard. Every button now disables immediately and shows a loading spinner to prevent rapid-fire requests.
        - **Idempotency Guards:** The API now detects overlapping deployments and returns `409 Conflict` instead of spawning duplicate builds.
    - **Refined Credential Management:**
        - Added an "Add Credential" form to the Integrations tab for proactive infrastructure setup.
        - Implemented SSH Key format validation to guide users toward providing Private Keys instead of Public Keys.
- **Next Task:**
    1. **Task 6:** SSL/TLS Termination via Cloudflare Tunnels.
    2. **Public Launch:** Transitioning from `.localhost` to `*.auto-deploy.tech`.

## Mentor Memory (Architectural Notes)
- **Data Ownership Architecture:** Ownership is enforced at the **API Layer**. Every protected route uses the `get_current_user` dependency. All SQLAlchemy queries MUST include `.filter(Model.owner_id == current_user["sub"])` OR check the `AppAccess` table for shared permissions.
- **Lazy State Initialization:** In the React dashboard, use lazy initialization or `useRef` guards for settings forms to prevent background polling from overwriting active user input.
- **Pluggable Secrets:** The `SecretResolver` in `core/secrets_engine.py` is designed to be pluggable. It currently supports local values and `vault://` references but can be extended to `aws://` or `azure://` without changing the worker logic.
- **Vault Dev Mode:** The local Vault container uses `VAULT_DEV_ROOT_TOKEN_ID: root`. For production, this must be replaced with AppRole or Kubernetes Auth.
- **Profile Auto-Provisioning:** Profiles are created on-the-fly during the first `/auth/profile` fetch. This ensures every authenticated user has a discoverable User ID without a separate registration step.
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
autodeploy/
├── asynctasks/          # The Orchestration Engine
│   ├── api/             # FastAPI routing layer
│   │   ├── main.py      # Entry point
│   │   └── routes/      # Endpoints
│   ├── core/            # Shared Logic (Models, DB, Crypto, Auth)
│   ├── worker/          # Celery worker layer
│   └── pyproject.toml   # Dependencies
├── dashboard/           # The "Canvas" (Next.js)
├── cli/                 # Future CLI
├── docker-compose.yml   # Root Orchestration
├── plan.md              # Roadmap
└── GEMINI.md            # Source of Truth
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
10. **Phase 10 (COMPLETED):** Enterprise Identity & Security.
11. **Phase 11 (IN PROGRESS):** The AutoDeploy CLI.
12. **Phase 12:** Enterprise-Grade Distribution.
13. **Phase 13:** Scaling & Monetization.

## Engineering Constraints & Decisions

- **No Autonomous Testing:** Gemini CLI MUST NEVER initiate autonomous testing, create test scripts, or execute validation sequences without explicit, per-task permission from the user within the current session. Instead, provide detailed instructions for the user to perform these actions themselves.
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
