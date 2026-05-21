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

def get_project_context(
    name: Optional[str] = None,
    repo_url: Optional[str] = None,
    branch: Optional[str] = None,
    stack: Optional[str] = None,
    internal_port: Optional[int] = None,
    env_overrides: Optional[Dict[str, str]] = None,
    build_args: Optional[Dict[str, str]] = None,
    root_dir_override: Optional[str] = None
) -> Dict[str, Any]:
    """Gathers all local project metadata for deployment, with optional overrides."""
    cwd = Path.cwd()
    root = get_git_root()
    
    # If no git root but we have repo_url override, we can still proceed
    if not root and not repo_url:
        return {"error": "Not a git repository. Please run from within a repo or provide --repo."}

    git_url = repo_url or get_git_remote()
    if not git_url:
        return {"error": "No 'origin' remote found and no --repo provided."}

    local_branch = get_git_branch() if root else "main"
    yml_config = load_autodeploy_yml(cwd, root) if root else {}
    env_vars = load_env_vars(cwd, root) if root else {}
    
    # Apply CLI environment overrides
    if env_overrides:
        env_vars.update(env_overrides)

    # Calculate root_dir (relative path from git root to CWD)
    if root_dir_override:
        final_root_dir = root_dir_override
    else:
        try:
            if root:
                final_root_dir = str(cwd.relative_to(root))
                if final_root_dir == ".":
                    final_root_dir = "."
            else:
                final_root_dir = "."
        except ValueError:
            final_root_dir = "."

    # Link file stores the app_id after the first deployment
    app_id = None
    if root:
        link_path = cwd / ".ad_project"
        if not link_path.exists():
            link_path = root / ".ad_project"
        if link_path.exists():
            app_id = link_path.read_text().strip()

    return {
        "root": root,
        "cwd": cwd,
        "app_id": app_id,
        "name": name or yml_config.get("name", cwd.name if root else "app"),
        "repo_url": git_url,
        "branch": branch or yml_config.get("branch", local_branch),
        "stack": stack or yml_config.get("stack", "dockerfile"),
        "internal_port": internal_port or yml_config.get("internal_port", 8000),
        "volumes": yml_config.get("volumes", []),
        "root_dir": final_root_dir,
        "pre_build_steps": yml_config.get("build", {}).get("pre", []),
        "post_build_steps": yml_config.get("build", {}).get("post", []),
        "env_vars": env_vars,
        "build_args": build_args or yml_config.get("build", {}).get("args", {})
    }

def save_project_link(root: Path, app_id: str):
    """Saves the app_id to a local hidden file to link the project."""
    link_path = root / ".ad_project"
    link_path.write_text(app_id)
