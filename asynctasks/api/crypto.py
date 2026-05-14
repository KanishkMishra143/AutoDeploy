import os
from cryptography.fernet import Fernet
from dotenv import load_dotenv

load_dotenv()

# This key is used to lock and unlock your environment variables.
# It MUST be kept secret and should be 32 bytes, base64-encoded.
FERNET_KEY = os.getenv("FERNET_KEY")

def get_fernet():
    if not FERNET_KEY:
        # In a real enterprise app, we'd halt here.
        raise ValueError("FERNET_KEY not found! Please check your .env file.")
    return Fernet(FERNET_KEY)

def encrypt_dict(data: dict) -> dict:
    """
    Takes a dictionary of secrets and encrypts every value.
    Example: {'DB_PASS': '123'} -> {'DB_PASS': 'gAAAAAB...'}
    """
    if not data:
        return {}
    f = get_fernet()
    return {k: f.encrypt(str(v).encode()).decode() for k, v in data.items()}

def decrypt_dict(data: dict) -> dict:
    """
    Reverses the encryption so the Worker can use the real values.
    """
    if not data:
        return {}
    f = get_fernet()
    # We wrap this in a try-block in case the key changed or data is corrupted
    try:
        return {k: f.decrypt(v.encode()).decode() for k, v in data.items()}
    except Exception:
        # If decryption fails, we return an empty dict to prevent crashes, 
        # but in production, you'd log a security alert.
        return {}
