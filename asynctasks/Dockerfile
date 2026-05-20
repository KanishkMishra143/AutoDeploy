# Start from a lightweight Python image
FROM python:3.11-slim

# Set our working directory inside the container
WORKDIR /app

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