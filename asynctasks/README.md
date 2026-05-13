# AutoDeploy Orchestrator

The "Orchestration Brain" of AutoDeploy, a modern Platform as a Service (PaaS).

## Development Environment Setup

To start the full AutoDeploy orchestrator locally, follow these steps:

### 1. Infrastructure (Database, Redis, Proxy)
Run this in your first terminal to ensure a clean slate:
```bash
docker-compose down -v && docker-compose up -d
```

### 2. Launch the Services (3 Terminals)

You will need three separate terminal windows running from the `asynctasks/` directory:

**Terminal 1: The Brain (API)**
```bash
source .venv/bin/activate
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2: The Hands (Worker)**
```bash
source .venv/bin/activate
celery -A worker.celery_app worker --loglevel=info
```

**Terminal 3: The Face (Dashboard)**
```bash
cd dashboard
npm run dev
```

### 3. Public Tunnels (Optional for Webhooks)
To test GitHub webhooks locally, use Pinggy (this will provide you with a public URL and a local debugger):
```bash
ssh -p 443 -R0:localhost:8000 -L4300:localhost:4300 free@a.pinggy.io
```
> **Tip:** Open `http://localhost:4300` in your browser once the tunnel is active to see a live debugger of all incoming webhook requests!

---

# 🚀 Core Features

## 🔔 Enabling Real GitHub Webhooks
AutoDeploy supports a full "Deploy on Push" experience.

1. **Start a Tunnel**: Use the Pinggy command above to get a public URL.
2. **GitHub Settings**: 
   - Go to your repository on GitHub.
   - Settings -> Webhooks -> Add Webhook.
   - **Payload URL**: `https://your-pinggy-url/webhooks/github`
   - **Content type**: `application/json`
   - **Events**: Just the `push` event.
3. **Push Code**: AutoDeploy will detect the push, match the branch to your application, and trigger the DAG sequence!

## ⛓️ Customizable Deployment DAG
Define manual steps (e.g., `npm install`, `python migrate.py`) that execute in a guaranteed sequence before or after your Docker build.

## 🔄 Versioning & Rollbacks
- **Stable Domains**: Every app has a stable URL based on its name.
- **Restore**: In the "History" tab, click **Restore** on any successful previous version.
- **Provenance**: Full audit trail for every job (Manual, Webhook, or Rollback).

---

## 🛠️ Troubleshooting

### Error: `Network autodeploy-net Resource is still in use`
When running `docker-compose down -v`, you might see this error if there are app containers (like `autodeploy_my-app`) still running or existing. Since these were started by the Celery Worker and not Docker Compose, Compose cannot remove the network while they are still attached.

**Solution:**
Force-remove all containers prefixed with `autodeploy_` before shutting down:
```bash
docker rm -f $(docker ps -a -q --filter name=autodeploy_)
```
Then run the down command again:
```bash
docker-compose down -v
```

### Error: `Failed to fetch` in Dashboard
If you see "API Offline" or "Failed to fetch" in the dashboard console:
1. **Check the API**: Ensure Terminal 1 is running and showing no errors.
2. **CORS Issues**: Ensure you are accessing the dashboard via `http://localhost:3000` or `http://127.0.0.1:3000`. If you use a different port, update `api/main.py`.
3. **Host Binding**: Ensure uvicorn is started with `--host 0.0.0.0` as shown in the setup instructions to allow connections from the host and other containers.
