import os
import hvac

class SecretResolver:
    """
    A Pluggable Secrets Engine that resolves Advanced Secrets.
    If an environment variable starts with 'vault://', it fetches the real value from HashiCorp Vault.
    Otherwise, it treats it as a standard local secret.
    """
    def __init__(self):
        self.vault_addr = os.getenv("VAULT_ADDR", "http://localhost:8200")
        self.vault_token = os.getenv("VAULT_TOKEN", "root")
        self.client = None
        
        try:
            self.client = hvac.Client(url=self.vault_addr, token=self.vault_token)
            if self.client.is_authenticated():
                print(f"🔒 SecretResolver: Successfully connected to HashiCorp Vault at {self.vault_addr}")
            else:
                print("⚠️ SecretResolver: Connected to Vault, but not authenticated.")
                self.client = None
        except Exception as e:
            print(f"⚠️ SecretResolver: Could not connect to Vault: {e}")
            self.client = None

    def resolve_secrets(self, env_vars: dict) -> dict:
        """
        Takes a dictionary of raw environment variables (some of which may be references)
        and resolves them to their actual values.
        """
        if not env_vars:
            return {}

        resolved = {}
        for key, value in env_vars.items():
            if isinstance(value, str) and value.startswith("vault://"):
                # Format: vault://secret/data/production/stripe_key
                try:
                    if not self.client:
                        raise RuntimeError("Vault client is not available")

                    # Extract path and the specific key to look up inside the JSON payload
                    # e.g. "secret/data/production" and "stripe_key"
                    raw_path = value.replace("vault://", "")
                    parts = raw_path.split("/")
                    
                    secret_key = parts[-1]
                    secret_path = "/".join(parts[:-1])

                    # In Vault KV v2, the read method handles 'data' properly if we use the v2 API.
                    # We assume standard KV v2 mounted at 'secret' for dev mode.
                    # Using raw read for simplicity with different mount paths.
                    response = self.client.read(secret_path)
                    
                    if not response or 'data' not in response:
                        raise ValueError(f"Secret path {secret_path} not found")
                        
                    # Handle kv-v2 wrapper if present
                    data_dict = response['data'].get('data', response['data'])
                    
                    real_value = data_dict.get(secret_key)
                    if real_value is None:
                        raise ValueError(f"Key {secret_key} not found in {secret_path}")
                        
                    resolved[key] = real_value
                except Exception as e:
                    print(f"Failed to resolve {key} from Vault: {e}")
                    # If it fails to resolve, we don't want to crash the whole deploy, 
                    # but we also don't want to inject 'vault://...' literally.
                    resolved[key] = "" 
            else:
                # Local secret (already decrypted by the API before passing to the worker payload)
                resolved[key] = value
                
        return resolved

# Singleton instance
resolver = SecretResolver()
