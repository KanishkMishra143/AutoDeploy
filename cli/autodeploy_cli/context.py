import os
import subprocess
import yaml
from pathlib import Path
from typing import Optional, Dict, Any

def get_git_root() -> Optional[Path]:
    """Finds the root directory of the git repository."""
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            capture_output=True,
            text=True,
            check=True
        )
        return Path(result.stdout.strip())
    except subprocess.CalledProcessError:
        return None

def get_git_remote() -> Optional[str]:
    """Extracts the origin remote URL."""
    try:
        result = subprocess.run(
            ["git", "remote", "get-url", "origin"],
            capture_output=True,
            text=True,
            check=True
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError:
        return None

def get_git_branch() -> str:
    """Extracts the current active branch."""
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            capture_output=True,
            text=True,
            check=True
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError:
        return "main"

def load_autodeploy_yml(cwd: Path, root: Path) -> Dict[str, Any]:
    """Parses autodeploy.yml configuration, prioritizing CWD."""
    paths = [cwd / "autodeploy.yml", root / "autodeploy.yml"]
    for yml_path in paths:
        if yml_path.exists():
            try:
                with open(yml_path, "r") as f:
                    return yaml.safe_load(f) or {}
            except Exception:
                pass
    return {}

def load_env_vars(cwd: Path, root: Path) -> Dict[str, str]:
    """Loads environment variables from local .env files, prioritizing CWD."""
    paths = [cwd / ".env", root / ".env"]
    vars = {}
    # We load them in reverse so CWD (first in list) overwrites root if both exist
    for env_path in reversed(paths):
        if env_path.exists():
            try:
                with open(env_path, "r") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            key, val = line.split("=", 1)
                            vars[key.strip()] = val.strip().strip('"').strip("'")
            except Exception:
                pass
    return vars

def get_project_context() -> Dict[str, Any]:
    """Gathers all local project metadata for deployment."""
    cwd = Path.cwd()
    root = get_git_root()
    if not root:
        return {"error": "Not a git repository."}

    git_url = get_git_remote()
    if not git_url:
        return {"error": "No 'origin' remote found. Please run 'git remote add origin <url>'"}

    branch = get_git_branch()
    yml_config = load_autodeploy_yml(cwd, root)
    env_vars = load_env_vars(cwd, root)

    # Link file stores the app_id after the first deployment
    # Check CWD first for the link
    link_path = cwd / ".ad_project"
    if not link_path.exists():
        link_path = root / ".ad_project"

    app_id = None
    if link_path.exists():
        app_id = link_path.read_text().strip()

    return {
        "root": root,
        "cwd": cwd,
        "app_id": app_id,
        "name": yml_config.get("name", cwd.name if cwd != root else root.name),
        "repo_url": git_url,
        "branch": yml_config.get("branch", branch),
        "stack": yml_config.get("stack", "dockerfile"),
        "pre_build_steps": yml_config.get("build", {}).get("pre", []),
        "post_build_steps": yml_config.get("build", {}).get("post", []),
        "env_vars": env_vars
    }

def save_project_link(root: Path, app_id: str):
    """Saves the app_id to a local hidden file to link the project."""
    link_path = root / ".ad_project"
    link_path.write_text(app_id)
