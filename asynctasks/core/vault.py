import os
import hvac
from typing import Dict, Optional
from uuid import UUID

class VaultClient:
    def __init__(self):
        # Use vault:8200 for internal docker communication
        self.addr = os.getenv("VAULT_ADDR", "http://vault:8200")
        self.token = os.getenv("VAULT_TOKEN", "root")
        self.client = None
        
        try:
            self.client = hvac.Client(url=self.addr, token=self.token)
            if not self.client.is_authenticated():
                print("⚠️ Vault: Not authenticated")
                self.client = None
        except Exception as e:
            print(f"⚠️ Vault: Connection failed: {e}")
            self.client = None

    def _get_app_path(self, app_id: UUID) -> str:
        # We store app secrets under a dedicated path
        return f"autodeploy/apps/{app_id}/env"

    def store_env_vars(self, app_id: UUID, env_vars: Dict[str, str]):
        """Stores environment variables in Vault KV v2."""
        if not self.client:
            return
        
        path = self._get_app_path(app_id)
        try:
            # We assume 'secret' is the mount point for KV v2
            self.client.secrets.kv.v2.create_or_update_secret(
                path=path,
                secret=env_vars,
                mount_point="secret"
            )
        except Exception as e:
            print(f"❌ Vault: Failed to store env for {app_id}: {e}")

    def get_env_vars(self, app_id: UUID) -> Dict[str, str]:
        """Retrieves environment variables from Vault."""
        if not self.client:
            return {}
        
        path = self._get_app_path(app_id)
        try:
            response = self.client.secrets.kv.v2.read_secret_version(
                path=path,
                mount_point="secret"
            )
            return response["data"]["data"]
        except hvac.exceptions.InvalidPath:
            return {}
        except Exception as e:
            print(f"❌ Vault: Failed to get env for {app_id}: {e}")
            return {}

    def delete_env_vars(self, app_id: UUID):
        """Deletes environment variables from Vault."""
        if not self.client:
            return
        
        path = self._get_app_path(app_id)
        try:
            self.client.secrets.kv.v2.delete_metadata_and_all_versions(
                path=path,
                mount_point="secret"
            )
        except Exception as e:
            print(f"❌ Vault: Failed to delete env for {app_id}: {e}")

# Singleton
vault = VaultClient()
