# AutoDeploy

AutoDeploy is a modern platform for deploying applications directly from your
Git repositories. It handles builds, deployments, networking, logs, and
service lifecycle management so you can focus on your application.

## Try AutoDeploy

Use the hosted dashboard at **[auto-deploy.tech](https://auto-deploy.tech)**.

## What you can do

- Connect a GitHub or GitLab repository.
- Deploy applications with automatic build detection.
- Deploy Node.js, Python, static, Next.js, and Docker-based applications.
- Configure custom commands, ports, environment variables, and build arguments.
- Deploy from private repositories using securely managed credentials.
- Monitor deployment progress with real-time logs.
- Inspect application history and roll back to previous builds.
- Share applications with other users using role-based access.
- View your services and their relationships through the infrastructure map.

## Deployment workflow

1. Sign in to the AutoDeploy dashboard.
2. Create an application and connect its repository.
3. Select the branch and configure the application settings.
4. Start a deployment.
5. Monitor the build and runtime logs.
6. Open the generated application URL when deployment completes.

After the initial deployment, repository webhooks can be used to trigger
deployments automatically whenever new changes are pushed.

## Security

AutoDeploy isolates applications and deployment data by user ownership.
Credentials and environment secrets are protected and are not displayed as
plain text in the dashboard.

## Project

AutoDeploy is open source and built with FastAPI, Celery, Redis, PostgreSQL,
Docker, Traefik, HashiCorp Vault, and Next.js.

For development and contribution instructions, see
[`docs/development.md`](docs/development.md).
