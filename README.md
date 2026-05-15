# AutoDeploy 🚀

**The Next-Generation Open-Source PaaS Orchestrator**

AutoDeploy is a modern, developer-friendly Platform as a Service (PaaS) designed to bridge the gap between source code and live infrastructure. Inspired by the developer experience of **Render** and **Railway**, it transforms your repositories into live, production-grade applications with zero-config networking, real-time observability, and multi-tenant security.

---

## 🏗 High-Level Architecture

AutoDeploy follows a decoupled **Control Plane vs. Data Plane** architecture, allowing the "Brain" to live in the cloud while the "Hands" execute locally or on distributed edge nodes.

### 🧠 Control Plane (API)
- **Framework:** FastAPI (Python 3.11+)
- **Identity & Auth:** Supabase Auth (JWT-based multi-tenancy)
- **Database:** Supabase (Cloud PostgreSQL 15+)
- **State Management:** SQLAlchemy 2.0 (Synchronous with strict ownership filtering)

### ⚙️ Execution Plane (Worker)
- **Orchestrator:** Celery + Redis
- **Containerization:** Native Docker Engine integration
- **Networking:** Dynamic Service Discovery via Traefik v2.11
- **Log Engine:** Dual-path logging (Redis Pub/Sub for live stream + PostgreSQL for history)

### 🎨 The "Canvas" (Dashboard)
- **Framework:** Next.js 15 (App Router, TypeScript)
- **Visuals:** React Flow (Visual Topology Map)
- **Real-time:** WebSockets for live terminal logs
- **UX:** Tailwind CSS + Radix UI (Acrylic aesthetic)

---

## ✨ Key Features

- **🔒 Multi-Tenant Security:** Full data isolation where every Application, Job, and Log is strictly tied to a user account.
- **🗺 Visual Topology Map:** An interactive, node-based map of your infrastructure showing live connections between the Gateway and your Services.
- **📟 Real-Time Log Engine:** High-performance terminal streaming powered by Redis Pub/Sub with $O(1)$ deduplication and $O(N)$ historical backfilling.
- **⛓ Customizable DAG Pipelines:** Define custom pre-build (e.g., `npm install`) and post-build (e.g., `db migrate`) hooks to adapt to any deployment workflow.
- **🩺 Auto-Diagnosis:** The orchestrator analyzes build logs in real-time to provide actionable suggestions when deployments fail.
- **🔄 One-Click Rollbacks:** Instantly restore any service to a previous successful version with full provenance tracking.

---

## 🛠 Tech Stack

| Tier | Technologies |
| :--- | :--- |
| **Backend** | Python, FastAPI, Celery, SQLAlchemy |
| **Frontend** | Next.js, React Flow, Lucide Icons, Tailwind |
| **Cloud** | Supabase (Auth/DB) |
| **Infrastructure** | Docker, Traefik, Redis |

---

## 📦 Getting Started

### 1. Prerequisites
- **Docker & Docker Compose** installed and running.
- **Python 3.11+** (preferably with `uv`).
- **Node.js 18+**.
- A **Supabase** project for Auth and Database.

### 2. Infrastructure Setup
Spin up the core infrastructure (Redis, PostgreSQL, Traefik, and HashiCorp Vault):
```bash
docker compose up -d
```

### 3. Backend (AsyncTasks)
Configure your `.env` in `asynctasks/` (refer to `asynctasks/.env.example` if available):
```env
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
SUPABASE_DB_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=your_encryption_key
VAULT_ADDR=http://localhost:8200
VAULT_TOKEN=root
```

Install dependencies and start the services:
```bash
cd asynctasks
uv sync

# Terminal 1: API Server
uvicorn api.main:app --reload --port 8000

# Terminal 2: Celery Worker
celery -A worker.celery_app worker --loglevel=info
```

### 4. Webhook Connectivity (Optional - for Git triggers)
To receive webhooks from GitHub/GitLab on your local machine, use **ngrok** to expose the API:
```bash
# Terminal 3: ngrok Tunnel
ngrok http 8000
```
*Note: Update your Repository Webhook URL to the ngrok address (e.g., `https://xyz.ngrok-free.app/webhooks/github`).*

### 5. Frontend (Dashboard)
Configure your `.env.local` in `dashboard/`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Install and start:
```bash
# Terminal 4: Frontend
cd dashboard
npm install
npm run dev
```

---

## 📜 Manual Schema Migrations (Supabase)
Because we use a hybrid cloud model, SQLAlchemy's `create_all()` will NOT automatically update existing tables in Supabase. When updating `models.py`:
1. Update the Python model.
2. Go to the **Supabase SQL Editor**.
3. Run the corresponding `ALTER TABLE` command (e.g., `ALTER TABLE applications ADD COLUMN owner_id UUID;`).

---

## 🗺 Roadmap
For a detailed look at the 13-Phase vision (including CLI development and Enterprise scaling), check out [plan.md](./plan.md).

## 🤝 Contributing
We follow the **AutoDeploy Standard** for UI/UX and architectural integrity. Please refer to [GEMINI.md](./GEMINI.md) for deep technical constraints and design philosophy before submitting PRs.
