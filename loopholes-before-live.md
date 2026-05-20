# AutoDeploy: Loopholes & Edge Cases (The "Before-Live" Audit)

This document tracks critical architectural vulnerabilities and edge cases identified during the transition from a localhost development environment to a public PaaS at `auto-deploy.tech`.

---

- [x] 1. Multi-tenant Name Collisions
**Problem:** Currently, container names and hostnames are derived solely from the app name (e.g., `ad-api`). If two users create an app named "api", the second deployment will fail or overwrite the first.

### 🛠️ Solution
- Append a short hash of the `owner_id` or a unique slug to the `container_name` and `hostname`.
- **Target:** `ad-{app_name}-{short_user_id}` and `{app_name}-{short_user_id}.auto-deploy.tech`.

### 📦 Deliverables
- Modified `container_name` logic in `worker/tasks.py`.
- Updated hostname generation logic for Traefik labels.

### ✅ Validation
- Create two different users.
- Deploy an app named "test-app" from both accounts.
- Verify both containers run simultaneously and have distinct URLs.

---

- [x] 2. Hardcoded Port Assumption
**Problem:** The worker assumes all apps listen on port `8000` (API) or `80` (Static). Apps like Next.js (`3000`) or Vite (`5173`) will result in 504 Gateway Timeouts.

### 🛠️ Solution
- Add an `internal_port` field to the `Application` model.
- Update the CLI and GUI to allow users to override the default port.
- Update `worker/tasks.py` to use this dynamic port for Traefik load balancer labels.

### 📦 Deliverables
- Database migration for `applications` table.
- UI field for "Internal Port".
- Dynamic label logic in the worker.

### ✅ Validation
- Deploy a Node.js app configured to listen on port `3000`.
- Verify the app is accessible at the public URL without manual Traefik intervention.

---

- [x] 3. Persistent Data Loss (Volumes)
**Problem:** Containers are ephemeral. Every new deployment deletes the previous container and its local filesystem. Users lose SQLite databases, uploads, and logs stored inside the container.

### 🛠️ Solution
- Implement a `volumes` configuration in `autodeploy.yml`.
- Mapping: `host_path` (persistent storage) -> `container_path`.
- Update `docker run` flags in the worker to include `-v`.

### 📦 Deliverable
- Volume mapping support in `autodeploy.yml` parser.
- Docker volume mounting logic in `tasks.py`.

### ✅ Validation
- Deploy an app that writes to a `/data/db.sqlite` file.
- Redeploy the app.
- Verify the data in the database persists across the new container.

---

- [x] 4. Zombie Image Storage Leak
**Problem:** Every build creates a new Docker image. Without a cleanup policy, the production server will run out of disk space, crashing the entire platform.

### 🛠️ Solution
- Implement a post-deployment "Pruning" task.
- Rule: Keep only the current active image and the previous one (for rollbacks).
- Use `docker image rm` for older untagged or specific job-tagged images.

### 📦 Deliverables
- `cleanup_old_images` task in the Celery worker.
- Logic to identify "stale" images associated with an application.

### ✅ Validation
- Deploy an app 5 times.
- Check `docker images` on the host.
- Verify only the latest 2 images for that app remain.

---

- [x] 5. Private Repository Access
**Problem:** `git clone` fails for private repositories. Most professional users will not use public repos for their source code.

### 🛠️ Solution
- Add support for "Deployment Keys" (SSH) or PATs.
- Store credentials securely in HashiCorp Vault.
- Update `worker/tasks.py` to use these credentials during the `clone` step.

### 📦 Deliverables
- "Integrations" tab in User Settings.
- Credential injection logic in the worker.

### ✅ Validation
- Attempt to deploy a private repository.
- Verify the worker can clone and build it successfully.

---

- [ ] 6. SSL/TLS Termination
**Problem:** Traefik is currently configured for HTTP (`:80`). Public users expect HTTPS (`:443`).

### 🛠️ Solution (Cloudflare Strategy)
- Leverage **Cloudflare Tunnels** (`cloudflared`) to create a secure outbound connection from the home desktop.
- Cloudflare provides **Automatic SSL/TLS** at the edge for the `auto-deploy.tech` domain and all wildcard subdomains (`*.auto-deploy.tech`).
- Traefik remains behind the tunnel, handling internal HTTP routing without needing complex ACME/Let's Encrypt configuration.
- Force "Always Use HTTPS" in the Cloudflare Dashboard.

### 📦 Deliverables
- Setup `cloudflared` daemon on the host machine.
- Configure Wildcard CNAME in Cloudflare pointing to the tunnel.
- Update `docker-compose.yml` to ensure Traefik is reachable by the tunnel.

### ✅ Validation
- Access a deployed app via `https://{app}-{user}.auto-deploy.tech`.
- Verify the connection is secure and uses the Cloudflare Universal SSL certificate.

---


- [x] 7. Security: The Docker Socket Risk
**Problem:** Giving the worker access to `/var/run/docker.sock` allows a malicious user to potentially escape their container and take over the host.

### 🛠️ Solution
- **Short term:** Run containers as non-root users and use strict resource limits.
- **Long term:** Explore Docker "User Namespaces" or a proxy for the Docker Socket (like `docker-socket-proxy`) that restricts commands to `ls` and `start/stop`.

### 📦 Deliverables
- Hardened container security profiles.
- Restricted Docker socket access layer.

### ✅ Validation
- Attempt to run a privileged container from a user's `Dockerfile`.
- Verify the deployment is blocked or fails due to permission restrictions.

---

- [x] 8. API Race Conditions (The Double-Click Panics)
**Problem:** High-frequency repeated requests (double-clicks) on state-changing buttons cause database deadlocks, unique constraint violations, or 500 errors.

### 🛠️ Solution
- **Server Side:** Implement `with_for_update()` locking on critical resource fetches.
- **Server Side:** Wrap destructive commits in `try/except` blocks to handle concurrent deletions or unique constraint hits gracefully.
- **Client Side:** Implement global button debouncing and loading state locks to prevent secondary triggers while a request is "In Flight".

### 📦 Deliverables
- Idempotency logic for `delete_app`, `share_app`, and `get_profile`.
- Mutex-style locking for `trigger_deployment` to prevent multiple builds for the same app starting at the same time.

### ✅ Validation
- Double-click the "Delete" button rapidly. Verify one succeeds and the second returns a clean 404/409 instead of a crash.
- Trigger "Deploy" 5 times in 1 second. Verify only 1 build sequence is initiated.

---

- [x] 9. Sub-directory (Monorepo) Support
**Problem:** Auto-detection fails if `package.json` or the `Dockerfile` is not in the repository root.

### 🛠️ Solution
- Add a `root_dir` field to the application config.
- CLI: Auto-detect relative path from Git root to CWD.
- Worker: `cd` into the `root_dir` before running build commands.

### 📦 Deliverables
- `root_dir` support in API and Worker.
- Context-aware CLI detection.

### ✅ Validation
- Run `ad deploy` from a sub-folder of a large monorepo.
- Verify the worker builds only that sub-folder.
