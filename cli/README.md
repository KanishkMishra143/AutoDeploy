# 🚀 AutoDeploy CLI

The official command-line interface for **AutoDeploy**, the next-generation PaaS designed to bridge the gap between source code and live infrastructure.

## ✨ Features

- **Instant Deployment**: Deploy any repository with a single command.
- **Real-time Logs**: Stream live logs from your build and runtime containers.
- **Multi-Resource Quotas**: Built-in protection against CPU, Memory, and PID abuse.
- **Secure by Default**: Automatic secret injection and encrypted credential management.
- **Smart Topology**: Seamless integration with the AutoDeploy Canvas.

## 📦 Installation

Install the CLI via pip:

```bash
pip install autodeploy-cli
```

## 🚀 Quick Start

### 1. Authenticate
Get your API key from the AutoDeploy Dashboard and login:

```bash
ad login
```

### 2. Check Identity
Verify your session:

```bash
ad whoami
```

### 3. Manage Apps
List your active deployments:

```bash
ad apps list
```

### 4. Stream Logs
Watch your application's heartbeats in real-time:

```bash
ad logs <job_id>
```

## 🛠️ Configuration
By default, the CLI connects to `https://api.auto-deploy.tech`. You can override this for self-hosted instances:

```bash
ad login --base http://your-internal-ip:8000
```

---
Built with ❤️ by the AutoDeploy Team.
