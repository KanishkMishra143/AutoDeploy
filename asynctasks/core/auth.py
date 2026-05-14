import os
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from dotenv import load_dotenv
import base64

load_dotenv()

# We need both for maximum compatibility
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")
SUPABASE_URL = os.getenv("SUPABASE_URL")

security = HTTPBearer()

# For Asymmetric tokens (ES256), we fetch the public keys from Supabase
# This client handles caching automatically
jwks_client = None
if SUPABASE_URL:
    jwks_url = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"
    try:
        from jwt import PyJWKClient
        jwks_client = PyJWKClient(jwks_url)
    except Exception as e:
        print(f"DEBUG: Failed to initialize JWKS client: {e}")

def verify_token(token: str):
    """Verifies a JWT token and returns the payload. Supports ES256, RS256, and HS256."""
    # 🔍 Identify what algorithm we are dealing with
    try:
        header = jwt.get_unverified_header(token)
        alg = header.get("alg", "HS256")
    except Exception as e:
        print(f"DEBUG: Could not read token header: {e}")
        return None

    # --- CASE 1: Asymmetric (ES256, RS256) ---
    if alg.startswith("ES") or alg.startswith("RS"):
        if jwks_client:
            try:
                signing_key = jwks_client.get_signing_key_from_jwt(token)
                payload = jwt.decode(
                    token, 
                    signing_key.key, 
                    algorithms=[alg], 
                    options={"verify_aud": False}
                )
                return payload
            except Exception as e:
                print(f"DEBUG: Asymmetric verification failed: {e}")

    # --- CASE 2: Symmetric (HS256) ---
    if not SUPABASE_JWT_SECRET:
        return None

    # Try both raw and base64-decoded secret
    secrets_to_try = [SUPABASE_JWT_SECRET]
    try:
        decoded = base64.b64decode(SUPABASE_JWT_SECRET)
        secrets_to_try.append(decoded)
    except Exception:
        pass

    for secret in secrets_to_try:
        try:
            payload = jwt.decode(
                token, 
                secret, 
                algorithms=["HS256", "HS384", "HS512"], 
                options={"verify_aud": False}
            )
            return payload
        except Exception:
            continue

    return None

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = verify_token(token)
    
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Invalid or expired token"
        )
    return payload
