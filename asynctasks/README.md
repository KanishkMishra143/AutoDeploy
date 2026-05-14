# AutoDeploy (AsyncTasks)

A modern, developer-friendly Platform as a Service (PaaS) orchestration engine.

## 🚀 Hybrid Architecture (Phase 10+)
AutoDeploy now operates on a **Hybrid Cloud Model**:
- **Database & Auth**: Hosted on **Supabase** (PostgreSQL 15+).
- **Control Plane (API)**: FastAPI running locally.
- **Execution Plane (Worker)**: Celery worker running locally for native Docker access.

## 🛠 Manual Schema Migrations
When updating the database schema in SQLAlchemy (`models.py`), you must manually apply the changes to Supabase:
1. Identify the change (e.g., a new column `owner_id`).
2. Open the **Supabase SQL Editor**.
3. Execute the migration: `ALTER TABLE table_name ADD COLUMN column_name TYPE;`.

## 📦 Getting Started
1. Install dependencies: `uv sync`
2. Setup environment: Create a `.env` file with `SUPABASE_DB_URL`.
3. Start Infrastructure: `docker compose up -d redis traefik`
4. Start API: `uvicorn api.main:app --reload`
5. Start Worker: `celery -A worker.celery_app worker --loglevel=info`

## 📜 Roadmap
See [plan.md](asynctasks/plan.md) for the full 13-Phase roadmap.
