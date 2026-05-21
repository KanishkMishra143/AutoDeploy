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
    max_retries = 30
    retry_count = 0
    while retry_count < max_retries:
        try:
            res = requests.get(f"{VAULT_ADDR}/v1/sys/health", timeout=2)
            # 200: unsealed, 501: not initialized, 503: sealed
            if res.status_code in [200, 501, 503]:
                break
        except Exception:
            pass
        retry_count += 1
        time.sleep(2)

    if retry_count == max_retries:
        print("❌ Error: Vault did not become ready in time.")
        return

    # 5. Check if already unsealed (with retries to avoid boot race conditions)
    print("⏳ Verifying Seal Status...")
    is_sealed = True
    for i in range(5):
        try:
            status_res = requests.get(f"{VAULT_ADDR}/v1/sys/seal-status", timeout=2)
            if status_res.status_code == 200:
                status = status_res.json()
                is_sealed = status.get("sealed", True)
                initialized = status.get("initialized", False)
                
                print(f"   - Vault Status: sealed={is_sealed}, initialized={initialized}")
                
                if not initialized:
                    print("❌ Error: Vault is not initialized. Please initialize Vault first.")
                    return
                
                if not is_sealed:
                    print("✅ Vault is already unsealed. Bridge exiting.")
                    return
                
                # If we are here, it's sealed and initialized. Ready to unseal.
                break
            else:
                print(f"⚠️ Attempt {i+1}: Received status {status_res.status_code}. Retrying...")
        except Exception as e:
            print(f"⚠️ Attempt {i+1}: Could not check status ({e}). Retrying...")
        time.sleep(2)

    # 6. Execute Unseal
    print(f"🔓 Vault is sealed. Applying {len(unseal_keys)} keys (decrypted in memory)...")
    for key in unseal_keys:
        try:
            # Explicitly use JSON for the POST body
            res = requests.post(f"{VAULT_ADDR}/v1/sys/unseal", json={"key": key.strip()}, timeout=5)
            data = res.json()
            is_sealed = data.get("sealed", True)
            progress = data.get("progress", 0)
            t = data.get("t", 0)
            print(f"   - Key applied. Progress: {progress}/{t} (Sealed: {is_sealed})")
            
            if not is_sealed:
                print("✨ Vault unsealed during sequence!")
                break
        except Exception as e:
            print(f"⚠️ Failed to apply a key: {e}")
    
    # Final Verification
    time.sleep(2)
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
