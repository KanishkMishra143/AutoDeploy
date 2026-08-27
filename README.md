<div align="center">

<img
  width="128"
  alt="AutoDeploy rocket logo"
  src="https://raw.githubusercontent.com/KanishkMishra143/AutoDeploy/master/dashboard/src/app/icon.svg"
/>

# AutoDeploy

### From Git push to production, without the infrastructure busywork.

AutoDeploy is a modern platform-as-a-service that builds, deploys, and
monitors applications from GitHub and GitLab repositories.

<p>
  <a href="https://auto-deploy.tech">
    <img src="https://img.shields.io/badge/Website-Visit%20AutoDeploy-3b82f6?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Website">
  </a>
  <a href="https://github.com/KanishkMishra143/AutoDeploy#readme">
    <img src="https://img.shields.io/badge/Documentation-Read%20the%20Docs-24292f?style=for-the-badge&logo=github&logoColor=white" alt="Documentation">
  </a>
  <a href="https://api.auto-deploy.tech/health">
    <img src="https://img.shields.io/website?url=https%3A%2F%2Fapi.auto-deploy.tech%2Fhealth&style=for-the-badge&label=API%20Status&logo=fastapi&logoColor=white" alt="API status">
  </a>
  <a href="https://github.com/KanishkMishra143/AutoDeploy">
    <img src="https://img.shields.io/badge/GitHub-View%20Source-181717?style=for-the-badge&logo=github&logoColor=white" alt="GitHub">
  </a>
</p>

<p>
  <img src="https://img.shields.io/website?url=https%3A%2F%2Fauto-deploy.tech&style=flat-square&label=dashboard" alt="Dashboard status">
  <img src="https://img.shields.io/github/last-commit/KanishkMishra143/AutoDeploy/master?style=flat-square&label=last%20updated" alt="Last updated">
</p>

</div>

## Deploy with confidence

AutoDeploy connects your source code to running infrastructure. Connect a
repository, configure your application, and let AutoDeploy manage the build,
deployment, networking, and service lifecycle.

## Features

| | Capability | Description |
| :---: | --- | --- |
| :rocket: | **Git-based deployments** | Deploy directly from GitHub or GitLab. |
| :gear: | **Automatic build detection** | Support for Node.js, Python, Next.js, static, and Docker applications. |
| :lock: | **Private repositories** | Use securely managed SSH keys and personal access tokens. |
| :satellite: | **Real-time logs** | Follow build and runtime output as it happens. |
| :repeat: | **Rollbacks** | Restore a service to a previous successful deployment. |
| :busts_in_silhouette: | **Team access** | Share applications with role-based permissions. |
| :world_map: | **Infrastructure map** | Understand how your services connect. |
| :shield: | **Secret protection** | Keep credentials and environment secrets out of plain text. |

## How it works

```text
Connect repository  ->  Configure application  ->  Deploy
                                                   |
                              Monitor logs  <-  Running service
```

1. Open the [AutoDeploy dashboard](https://auto-deploy.tech).
2. Create an application and connect its repository.
3. Select a branch and configure the application.
4. Start a deployment and monitor its progress.
5. Open the generated application URL when it is ready.

Repository webhooks can trigger new deployments automatically whenever changes
are pushed.

## Supported application types

- Node.js applications
- Python applications
- Next.js applications
- Static websites
- Custom Docker applications

## Security

AutoDeploy is designed with multi-tenant ownership and secure credential
handling. Applications, jobs, and logs are associated with their owners, while
private repository credentials and environment secrets are protected from
plain-text display.

## Technology

`FastAPI` `Celery` `Redis` `PostgreSQL` `SQLAlchemy` `Docker` `Traefik`
`HashiCorp Vault` `Next.js` `TypeScript`

## Project links

- **Dashboard:** [auto-deploy.tech](https://auto-deploy.tech)
- **API health:** [api.auto-deploy.tech/health](https://api.auto-deploy.tech/health)
- **Source code:** [GitHub](https://github.com/KanishkMishra143/AutoDeploy)
- **Issues and feature requests:** [GitHub Issues](https://github.com/KanishkMishra143/AutoDeploy/issues)
