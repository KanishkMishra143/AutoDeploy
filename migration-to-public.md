# AutoDeploy: Migration to Public Playbook & Architecture Choices

## Cloud computing solution

This document outlines the strategic roadmap for moving AutoDeploy from a local development environment to a production-ready cloud infrastructure. This architecture is designed to maximize performance and reliability while remaining cost-effective by leveraging AWS Student Credits and generous free tiers.

## 🏗️ Architecture Blueprint

### 1. Frontend: Vercel vs. AWS Amplify
*   **Recommendation:** **Vercel**
*   **Why:** Vercel created Next.js. Their free tier is extremely generous, deployment is zero-config, and it will cost you $0.
*   **AWS Amplify Pros/Cons:** Amplify is powerful and can utilize AWS credits, but setting up a Next.js 15+ App Router project can occasionally require complex build overrides. By using Vercel, we keep the frontend "lean" and save AWS credits for the compute-heavy backend.

### 2. DB & Auth & Identity: Supabase
*   **Recommendation:** **Keep exactly as is.** 
*   **Why:** Supabase is already handling our complex PostgreSQL relations, RBAC, and Profile auto-provisioning flawlessly. Moving to AWS RDS would add unnecessary management overhead and cost.

### 3. API Layer (Control Plane): AWS App Runner vs. Render
*   **Recommendation:** **AWS App Runner**
*   **Why:** App Runner provides true serverless containers. We point it at the `/asynctasks` directory in our GitHub repo, and it automatically handles SSL termination, load balancing, and auto-scaling. While it costs money, it is covered by AWS credits.
*   **Render Pros/Cons:** Render's free tier has "cold starts" (spins down after 15m of inactivity), which would make the CLI and Dashboard feel sluggish when first opened. App Runner stays ready.

### 4. Worker Node & Traffic Manager (Data Plane): AWS EC2
*   **Recommendation:** **1x EC2 Instance (Type: `t3.medium` or `t3.large`)**
*   **Why:** This is the "Engine Room." Because we are building a PaaS, we need raw access to a Docker Daemon (`/var/run/docker.sock`) to build and spawn user containers. Serverless options like Fargate make "Docker-in-Docker" extremely difficult. An EC2 instance provides the Linux flexibility required for the Celery Worker and Traefik.

### 5. Redis Cache: AWS ElastiCache vs. EC2 (Docker)
*   **Recommendation:** **Run Redis in Docker on your EC2 Instance.**
*   **ElastiCache Pros/Cons:** Fully managed and highly available, but expensive (~$15-$30/month).
*   **EC2 Pros/Cons:** Since we are already paying for the EC2 instance to run our Worker, running a lightweight Redis container on it costs $0 extra. This is the most efficient use of resources for this stage.

### 6. Secrets Management: AWS Secrets Manager vs. HashiCorp Vault
*   **Recommendation:** **Keep HashiCorp Vault on your EC2 Instance.**
*   **AWS Secrets Manager Pros/Cons:** Native AWS integration but carries a cost per secret ($0.40/secret/month). This can scale quickly and eat into credits.
*   **Vault Pros/Cons:** We have already implemented a robust `SecretResolver` for Vault. Running it on the EC2 instance alongside Redis and Traefik is free, powerful, and utilizes our existing code.

---

## 🚀 Execution Roadmap

When we are ready to pull the trigger, these are the steps we will follow:

1.  **Deploy Frontend:** Push the `/dashboard` directory to Vercel. Configure Supabase environment variables for production.
2.  **Deploy API:** Set up an AWS App Runner service pointing to `/asynctasks`. Link it to the Supabase production DB.
3.  **Setup EC2 (The Core):**
    *   Provision an Ubuntu EC2 instance.
    *   Install Docker and Docker Compose.
    *   Create a `docker-compose-prod.yml` to orchestrate: **Traefik**, **Redis**, **Vault**, and the **Celery Worker**.
4.  **Networking & Domains:**
    *   Purchase a domain (e.g., `autodeploy-app.com`).
    *   Configure a Wildcard DNS A-Record (`*.autodeploy-app.com`) pointing to the EC2 Public IP.
    *   Update `worker/tasks.py` to use the `BASE_DOMAIN` environment variable for Traefik routing.

---

## Self-Hosting Solution

✦ To get AutoDeploy running on your Fedora machine and accessible to the world without exposing your home network to hackers, we will use a Cloudflare Tunnel. 

Think of a Cloudflare Tunnel like a "secure pipe" that connects your PC to Cloudflare's servers. Instead of you opening a door (port forwarding) and letting the world in, your PC "calls out" to Cloudflare and says, "Send my traffic through this pipe."

Here is the step-by-step blueprint to make this happen.

---

Phase 1: The Foundation (Domain & DNS)

1. Get a Domain: You've secured **auto-deploy.tech** via the GitHub Student Pack.
2. Move to Cloudflare:
    * Create a free Cloudflare account.
    * Add `auto-deploy.tech`. Cloudflare will give you two "Nameservers" (e.g., mona.ns.cloudflare.com).
    * Go back to your domain registrar and replace their nameservers with Cloudflare’s.
    * Wait for the "Active" status.

Phase 2: Preparing Fedora (The Server)

Since you already have Docker and Docker Compose installed for this project, your Fedora machine is 90% ready.

1. Check Docker Status:
   ```bash
   sudo systemctl enable --now docker
   ```
2. Firewall Check: Fedora uses firewalld. Ensure it's not blocking internal Docker traffic.

Phase 3: Setting up the Tunnel (cloudflared)

This is the "magic" part. We will use the Cloudflare Dashboard to manage the tunnel.

1. Login to Cloudflare Zero Trust: Go to the "Zero Trust" section in your Cloudflare dashboard.
2. Create a Tunnel:
    * Go to Networks -> Tunnels -> Create a Tunnel.
    * Name it (e.g., `fedora-autodeploy`).
3. Install the Connector: Run these commands on your Fedora machine to install the `cloudflared` daemon and link it to your tunnel.

   ```bash
   # 1. Add the cloudflared repo to your system
   curl -fsSl https://pkg.cloudflare.com/cloudflared.repo | sudo tee /etc/yum.repos.d/cloudflared.repo

   # 2. Update your package list
   sudo yum update

   # 3. Install the cloudflared package
   sudo yum install cloudflared

   # 4. Install the service with your unique token
   sudo cloudflared service install eyJhIjoiOTkwZTdhNTUxNDc2ZDE1ODY4NDlkMWU3MjU5MTViMWUiLCJ0IjoiMjI2YTk4N2EtNDRiNS00ZjkyLWIzYzYtYWExMGFiMTU4N2M3IiwicyI6Ik9ESXpOVFUzT0RRdFl6STRaaTAwTlRJM0xUZ3hPVGN0WVRKa1l6RXdaVFpoTVdReCJ9
   ```

   This installs `cloudflared` as a background service that starts automatically whenever your PC boots.
4. Route Traffic:
    * In the Tunnel settings, go to Public Hostname.
    * **Main API:** Set `api.auto-deploy.tech` to point to `http://localhost:8000` (Your FastAPI port).
    * **The Wildcard:** Set `*.auto-deploy.tech` to point to `http://localhost:80` (Where Traefik is listening).

Phase 4: Integrating with AutoDeploy

Now we need to tell AutoDeploy that it's no longer running on localhost.

1. Update .env Files:
    * In asynctasks/, you'll change your `BASE_DOMAIN` from `localhost` to `auto-deploy.tech`.
    * Update your Supabase redirect URLs to point to your new domain.
2. Traefik Configuration:
    * Our docker-compose.yml already uses Traefik. Because Cloudflare handles the "Outer SSL", Traefik just needs to receive the traffic and route it to the right Docker container based on the hostname.

---

Why this is the "Pro" way to do it:

1. Bypass CGNAT: Most home internet providers use something called CGNAT, which makes traditional port forwarding impossible. Cloudflare Tunnels work even behind CGNAT.
2. Security: Your home IP address is never revealed. If someone tries to DDoS your site, Cloudflare’s massive network absorbs the hit, and your home internet stays perfectly fine.
3. Automatic SSL: You don't have to manage Let's Encrypt certificates on your PC; Cloudflare provides a valid SSL certificate for your domain automatically.
4. Zero Cost: Everything I just described (Cloudflare Tunnel, Zero Trust, Traefik, Docker) is free. You only pay for the $10/year domain.

Important Note on Dual-Booting & Multi-Machine Setup

Since you are dual-booting and using multiple machines (Desktop & Laptop):

*   **One Tunnel, Many Connectors:** You do NOT need a new tunnel for every machine. Use the **same token** on your Fedora Desktop, Windows Desktop, and Fedora Laptop. 
*   **Redundancy:** Cloudflare treats these as redundant paths. Whichever machine is currently running the `cloudflared` service with your token will automatically become the "Active" server for `auto-deploy.tech`.
*   **Consistency:** Ensure that on whichever machine you are using, you have run `docker compose up -d` so that Traefik (Port 80) and the API (Port 8000) are ready to receive the tunnel's traffic.

---

### 🛠️ Final Checklist for Laptop Testing:
1.  **Clone Repo:** Get the latest code on the laptop.
2.  **Install Connector:** Run the Cloudflare `rpm` install command (with your secret token).
3.  **Docker Up:** Start the AutoDeploy stack.
4.  **Verify:** Check the Cloudflare Dashboard to see the laptop appearing as a "Connected" connector.

Good luck with the wind-down! We've made massive progress today—you've moved from a local-only project to owning a professional `.tech` domain with a secure global tunnel.

