import os
import time
import requests
from supabase import create_client
from cryptography.fernet import Fernet

# Config from Environment (Injected via Docker)
SUPABASE_URL = os.getenv("SUPABASE_URL")
# Handle different naming conventions in your .env
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY") or os.getenv("SUPABASE_KEY")
KMS_SECRET = os.getenv("VAULT_KMS_SECRET") # Our local "Split-Knowledge" key
VAULT_ADDR = os.getenv("VAULT_ADDR", "http://vault:8200")

def unseal_vault():
    print("🚀 KMS Bridge: Starting Secure Auto-Unseal sequence...")
    
    if not SUPABASE_URL or not SUPABASE_KEY:
        print(f"❌ Error: SUPABASE_URL ({SUPABASE_URL}) or SUPABASE_KEY (found: {bool(SUPABASE_KEY)}) missing!")
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
    
    # 2. Fetch ENCRYPTED keys from the Cloud Root of Trust
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
    
    # 3. Decrypt in Memory using local Cluster Secret
    print("🔐 KMS Bridge: Decrypting keys using local Cluster Secret...")
    try:
        f = Fernet(KMS_SECRET.encode())
        decrypted_keys = f.decrypt(encrypted_blob.encode()).decode()
        unseal_keys = decrypted_keys.split(",")
    except Exception as e:
        print(f"❌ Decryption Failed: {e}. Check if your VAULT_KMS_SECRET is correct.")
        return
    
    # 4. Wait for Vault to be ready
    print(f"🔍 KMS Bridge: Waiting for Vault at {VAULT_ADDR}...")
    while True:
        try:
            res = requests.get(f"{VAULT_ADDR}/v1/sys/health", timeout=2)
            if res.status_code in [200, 501, 503]:
                break
        except Exception:
            pass
        time.sleep(2)

    # 5. Check if already unsealed
    try:
        status_res = requests.get(f"{VAULT_ADDR}/v1/sys/seal-status")
        status = status_res.json()
        if not status.get("sealed", True):
            print("✅ Vault is already unsealed. Bridge exiting.")
            return
    except Exception as e:
        print(f"❌ Error checking seal status: {e}")
        return

    # 6. Execute Unseal
    print(f"🔓 Vault is sealed. Applying {len(unseal_keys)} keys (decrypted in memory)...")
    for key in unseal_keys:
        try:
            # Explicitly use JSON for the POST body
            res = requests.post(f"{VAULT_ADDR}/v1/sys/unseal", json={"key": key.strip()}, timeout=5)
            # Log progress if threshold not met yet
            progress = res.json().get("progress", 0)
            print(f"   - Key applied. Progress: {progress}/3")
        except Exception as e:
            print(f"⚠️ Failed to apply a key: {e}")
    
    # Final Verification
    time.sleep(1)
    try:
        final_status = requests.get(f"{VAULT_ADDR}/v1/sys/seal-status").json()
        if not final_status.get("sealed", True):
            print("✨ KMS Bridge: Vault successfully unsealed and ready!")
        else:
            print("❌ Error: Unseal sequence finished but Vault is still sealed. Double check your unseal keys.")
    except:
        print("⚠️ Unseal finished, but could not verify final status.")

if __name__ == "__main__":
    unseal_vault()
