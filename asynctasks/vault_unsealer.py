import os
import time
import requests
from supabase import create_client
from cryptography.fernet import Fernet
from dotenv import load_dotenv

# Load local .env if present (for local testing/manual runs)
load_dotenv()

# Config from Environment (Injected via Docker or .env)
SUPABASE_URL = os.getenv("SUPABASE_URL")
# Handle different naming conventions in your .env
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY") or os.getenv("SUPABASE_KEY")
KMS_SECRET = os.getenv("VAULT_KMS_SECRET") # Our local "Split-Knowledge" key
VAULT_ADDR = os.getenv("VAULT_ADDR", "http://vault:8200")

def unseal_vault_loop():
    print("🚀 KMS Bridge: Starting Secure Auto-Unseal Watchdog...")
    
    if not SUPABASE_URL or not SUPABASE_KEY:
        print(f"❌ Error: SUPABASE_URL or SUPABASE_KEY missing!")
        return
    
    if not KMS_SECRET:
        print("❌ Error: VAULT_KMS_SECRET missing! Cannot decrypt cloud keys.")
        return

    # 1. Connect to Supabase
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"❌ Error connecting to Supabase: {e}")
        return
    
    # 2. Fetch ENCRYPTED keys once (keep in memory)
    print("☁️ KMS Bridge: Fetching encrypted keys from Supabase...")
    try:
        response = supabase.table("vault_inventory").select("secret_value").eq("key_name", "unseal_keys").single().execute()
        if not response.data:
            print("❌ Error: Could not find unseal keys in Supabase!")
            return
        encrypted_blob = response.data["secret_value"]
    except Exception as e:
        print(f"❌ Error querying Supabase: {e}")
        return
    
    # 3. Decrypt in Memory once
    print("🔐 KMS Bridge: Decrypting keys using local Cluster Secret...")
    try:
        f = Fernet(KMS_SECRET.encode())
        decrypted_keys = f.decrypt(encrypted_blob.encode()).decode()
        unseal_keys = decrypted_keys.split(",")
    except Exception as e:
        print(f"❌ Decryption Failed: {e}. Check your VAULT_KMS_SECRET.")
        return

    print("✅ Watchdog ready. Monitoring Vault status...")

    while True:
        try:
            # Check seal status
            status_res = requests.get(f"{VAULT_ADDR}/v1/sys/seal-status", timeout=5)
            if status_res.status_code == 200:
                status = status_res.json()
                is_sealed = status.get("sealed", True)
                initialized = status.get("initialized", False)

                if not initialized:
                    print("⚠️ Watchdog: Vault is not initialized. Waiting...")
                elif is_sealed:
                    print(f"🔓 Vault is SEALED. Applying {len(unseal_keys)} keys...")
                    for key in unseal_keys:
                        res = requests.post(f"{VAULT_ADDR}/v1/sys/unseal", json={"key": key.strip()}, timeout=5)
                        data = res.json()
                        if not data.get("sealed", True):
                            print("✨ Vault unsealed successfully!")
                            break
                        print(f"   - Key applied. Progress: {data.get('progress')}/{data.get('t')}")
                # If already unsealed, we just stay quiet
            else:
                print(f"⚠️ Watchdog: Vault returned status {status_res.status_code}. Is it booting?")
        except Exception as e:
            print(f"⚠️ Watchdog: Could not connect to Vault ({e}). Retrying in 10s...")
        
        time.sleep(15)

if __name__ == "__main__":
    unseal_vault_loop()
