import logging
import os
from typing import Dict, Optional
from uuid import UUID

import hvac

# Configure basic logging setup (assuming this is done globally, but setting up the client to use it)
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("VaultClient")


class VaultClient:
    def __init__(self):
        # Use vault:8200 for internal docker communication
        self.addr = os.getenv("VAULT_ADDR", "http://vault:8200")
        self.token = os.getenv(
            "VAULT_TOKEN"
        )  # Removed default value to enforce token presence
        self._client = None

        if not self.token:
            logger.error(
                "❌ VaultClient initialization failed: VAULT_TOKEN environment variable is not set."
            )
            # We raise an error here instead of defaulting to "root"
            raise ValueError(
                "VAULT_TOKEN must be provided for the VaultClient to operate securely."
            )

    @property
    def client(self) -> Optional[hvac.Client]:
        """Lazy-loaded Vault client with auto-reconnection logic."""
        if self._client is None:
            try:
                self._client = hvac.Client(url=self.addr, token=self.token)
                if not self._client.is_authenticated():
                    logger.warning(
                        "⚠️ Vault: Client created but not authenticated (Token might be invalid)."
                    )
                    # If authentication fails immediately, we reset the client to None for retry logic
                    self._client = None
                else:
                    logger.info(
                        f"🔒 Vault: Successfully connected and authenticated at {self.addr}"
                    )
            except Exception as e:
                # Log connection failure properly instead of printing
                logger.error(
                    f"⚠️ Vault: Connection failed during initialization: {e}",
                    exc_info=True,
                )
                self._client = None

        # If we have a client, verify it's still good
        if self._client:
            try:
                # A simple lightweight call to check if we are still authenticated/connected
                self._client.is_authenticated()
            except Exception:
                logger.warning(
                    "⚠️ Vault: Connection lost or authentication expired. Re-initializing..."
                )
                self._client = None

        return self._client

    def _get_app_path(self, app_id: UUID) -> str:
        # We store app secrets under a dedicated path
        return f"autodeploy/apps/{app_id}/env"

    def store_env_vars(self, app_id: UUID, env_vars: Dict[str, str]):
        """Stores environment variables in Vault KV v2."""
        client = self.client
        if not client:
            logger.error(
                f"❌ Vault: Cannot store env for {app_id} - Client not available."
            )
            return

        path = self._get_app_path(app_id)
        try:
            # We assume 'secret' is the mount point for KV v2
            client.secrets.kv.v2.create_or_update_secret(
                path=path, secret=env_vars, mount_point="secret"
            )
            logger.info(
                f"✅ Vault: Successfully stored environment variables for {app_id}."
            )
        except Exception as e:
            logger.error(
                f"❌ Vault: Failed to store env for {app_id}: {e}", exc_info=True
            )

    def get_env_vars(self, app_id: UUID) -> Dict[str, str]:
        """Retrieves environment variables from Vault."""
        client = self.client
        if not client:
            # We raise here to let the worker know it should probably retry or fail the task
            raise RuntimeError(
                "Vault client is not available (Connection failed or not authenticated)"
            )

        # Check if Vault is sealed before attempting read
        try:
            if client.sys.is_sealed():
                logger.critical(
                    f"🚨 Vault: Cannot read env for {app_id} because Vault is SEALED."
                )
                raise RuntimeError("Vault is sealed. Ensure the unsealer has run.")
        except Exception as e:
            # hvac raises internal errors when sealed too
            err_str = str(e)
            if "Vault is sealed" in err_str or isinstance(e, RuntimeError):
                logger.critical(
                    "🚨 Vault: Status check failed - Vault appears to be sealed."
                )
                raise RuntimeError(
                    "Vault is sealed. Ensure the unsealer has run."
                ) from e
            logger.warning(f"⚠️ Vault: Status check failed unexpectedly: {e}")

        path = self._get_app_path(app_id)
        try:
            response = client.secrets.kv.v2.read_secret_version(
                path=path, mount_point="secret"
            )
            logger.info(
                f"✅ Vault: Successfully retrieved environment variables for {app_id}."
            )
            return response["data"]["data"]
        except hvac.exceptions.InvalidPath:
            logger.warning(f"⚠️ Vault: No secret path found for {app_id} at {path}")
            return {}
        except Exception as e:
            if "Vault is sealed" in str(e):
                raise RuntimeError(
                    "Vault is sealed. Ensure the unsealer has run."
                ) from e
            logger.error(
                f"❌ Vault: Failed to get env for {app_id}: {e}", exc_info=True
            )
            return {}

    def delete_env_vars(self, app_id: UUID):
        """Deletes environment variables from Vault."""
        if not self.client:
            logger.error(
                f"❌ Vault: Cannot delete env for {app_id} - Client not available."
            )
            return

        path = self._get_app_path(app_id)
        try:
            self.client.secrets.kv.v2.delete_metadata_and_all_versions(
                path=path, mount_point="secret"
            )
            logger.info(
                f"✅ Vault: Successfully deleted environment variables for {app_id}."
            )
        except Exception as e:
            logger.error(
                f"❌ Vault: Failed to delete env for {app_id}: {e}", exc_info=True
            )


# Singleton
try:
    vault = VaultClient()
except ValueError as e:
    # Handle the critical failure during singleton initialization gracefully if possible,
    # or let the application crash immediately upon startup with a clear error.
    logger.critical(f"FATAL ERROR: Cannot initialize Vault client. {e}")
    vault = None  # Ensure vault is None if initialization failed critically
