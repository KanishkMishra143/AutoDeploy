import json
import os
from pathlib import Path

CONFIG_DIR = Path.home() / ".autodeploy"
CONFIG_FILE = CONFIG_DIR / "config.json"

def ensure_config_dir():
    if not CONFIG_DIR.exists():
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        # Set directory permissions to 700 (owner only)
        os.chmod(CONFIG_DIR, 0o700)

def save_config(data: dict):
    ensure_config_dir()
    with open(CONFIG_FILE, "w") as f:
        json.dump(data, f)
    # Set file permissions to 600 (owner only)
    os.chmod(CONFIG_FILE, 0o600)

def load_config() -> dict:
    if not CONFIG_FILE.exists():
        return {}
    try:
        with open(CONFIG_FILE, "r") as f:
            return json.load(f)
    except Exception:
        return {}

def get_api_key() -> str:
    config = load_config()
    return config.get("api_key", "")

def get_api_base() -> str:
    config = load_config()
    return config.get("api_base", "http://127.0.0.1:8000")
