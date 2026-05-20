# Start from a lightweight Python image
FROM python:3.11-slim

# Set our working directory inside the container
WORKDIR /app

# Crucial step: Install the Docker CLI and Git inside the container. 
# We don't install the Docker Daemon (Engine), just the CLI tools. It will talk to the host's Daemon.
RUN apt-get update && apt-get install -y docker.io git && rm -rf /var/lib/apt/lists/*

# Copy the Astral 'uv' binary directly from their official image. This is a brilliant 
# optimization for lightning-fast dependency installation.
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copy only dependency files first. This leverages Docker's layer caching, meaning 
# we don't rebuild dependencies if we just change our Python code.
COPY pyproject.toml uv.lock ./

# Install dependencies into a virtual environment
RUN uv sync --frozen --no-cache

# Copy the rest of the application code
COPY . .

# Prepend the virtual environment's bin folder to our PATH so Python uses our installed packages
ENV PATH="/app/.venv/bin:$PATH"