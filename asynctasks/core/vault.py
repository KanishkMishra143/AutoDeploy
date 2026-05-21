import os
import hvac
from typing import Dict, Optional
from uuid import UUID

class VaultClient:
    def __init__(self):
        # Use vault:8200 for internal docker communication
        self.addr = os.getenv("VAULT_ADDR", "http://vault:8200")
        self.token = os.getenv("VAULT_TOKEN", "root")
        self._client = None
    
    @property
    def client(self) -> Optional[hvac.Client]:
        """Lazy-loaded Vault client with auto-reconnection logic."""
        if self._client is None:
            try:
                self._client = hvac.Client(url=self.addr, token=self.token)
                if not self._client.is_authenticated():
                    print("⚠️ Vault: Client created but not authenticated (Token might be invalid).")
                    # We don't set it to None yet, maybe it becomes valid? 
                    # Actually, if token is invalid, it's better to stay None and retry later.
                    self._client = None
                else:
                    print(f"🔒 Vault: Successfully connected and authenticated at {self.addr}")
            except Exception as e:
                # Do not spam logs every time, but ensure we know it's failing
                # print(f"⚠️ Vault: Connection failed: {e}")
                self._client = None
        
        # If we have a client, verify it's still good
        if self._client:
            try:
                # A simple lightweight call to check if we are still authenticated/connected
                self._client.is_authenticated()
            except Exception:
                print("⚠️ Vault: Connection lost. Re-initializing...")
                self._client = None
                
        return self._client

    def _get_app_path(self, app_id: UUID) -> str:
        # We store app secrets under a dedicated path
        return f"autodeploy/apps/{app_id}/env"

    def store_env_vars(self, app_id: UUID, env_vars: Dict[str, str]):
        """Stores environment variables in Vault KV v2."""
        client = self.client
        if not client:
            print(f"❌ Vault: Cannot store env for {app_id} - Client not available.")
            return
        
        path = self._get_app_path(app_id)
        try:
            # We assume 'secret' is the mount point for KV v2
            client.secrets.kv.v2.create_or_update_secret(
                path=path,
                secret=env_vars,
                mount_point="secret"
            )
        except Exception as e:
            print(f"❌ Vault: Failed to store env for {app_id}: {e}")

    def get_env_vars(self, app_id: UUID) -> Dict[str, str]:
        """Retrieves environment variables from Vault."""
        client = self.client
        if not client:
            # We raise here to let the worker know it should probably retry or fail the task
            raise RuntimeError("Vault client is not available (Connection failed or not authenticated)")
        
        # Check if Vault is sealed before attempting read
        try:
            if client.sys.is_sealed():
                print(f"🚨 Vault: Cannot read env for {app_id} because Vault is SEALED.")
                raise RuntimeError("Vault is sealed. Ensure the unsealer has run.")
        except Exception as e:
            # hvac raises internal errors when sealed too
            err_str = str(e)
            if "Vault is sealed" in err_str or isinstance(e, RuntimeError):
                raise RuntimeError("Vault is sealed. Ensure the unsealer has run.") from e
            print(f"⚠️ Vault: Status check failed: {e}")
        
        path = self._get_app_path(app_id)
        try:
            response = client.secrets.kv.v2.read_secret_version(
                path=path,
                mount_point="secret"
            )
            return response["data"]["data"]
        except hvac.exceptions.InvalidPath:
            return {}
        except Exception as e:
            if "Vault is sealed" in str(e):
                 raise RuntimeError("Vault is sealed. Ensure the unsealer has run.") from e
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
