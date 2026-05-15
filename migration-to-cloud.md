# AutoDeploy: Cloud Migration Playbook & Architecture Choices

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
