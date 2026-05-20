import os
import jwt
import base64
import hashlib
from datetime import datetime, timezone
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from dotenv import load_dotenv
from core.database import get_db
from core.models import APIKey

load_dotenv()

# We need both for maximum compatibility
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")
SUPABASE_URL = os.getenv("SUPABASE_URL")

security = HTTPBearer()

# For Asymmetric tokens (ES256), we fetch the public keys from Supabase
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
    try:
        header = jwt.get_unverified_header(token)
        alg = header.get("alg", "HS256")
    except Exception:
        return None

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
            except Exception:
                pass

    if not SUPABASE_JWT_SECRET:
        return None

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

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    """
    Unified dependency to fetch the current user from either a JWT (Dashboard) 
    or an API Key (CLI/Automated Access).
    """
    token = credentials.credentials
    if not token:
        raise HTTPException(status_code=401, detail="Missing credentials")
    
    # --- Check for API Key (CLI/Automated Access) ---
    if token.startswith("ad_live_"):
        clean_token = token.strip()
        key_hash = hashlib.sha256(clean_token.encode()).hexdigest()
        
        try:
            # We query the DB for the key
            api_key = db.query(APIKey).filter(APIKey.key_hash == key_hash).first()
            
            if api_key:
                if api_key.expires_at and api_key.expires_at < datetime.now(timezone.utc):
                    raise HTTPException(status_code=401, detail="API Key has expired")
                
                return {"sub": str(api_key.user_id), "role": "api_key"}
        except HTTPException:
            # Re-raise FastAPIs own HTTP exceptions (like expired key)
            raise
        except Exception as e:
            import traceback
            print(f"DEBUG: CRITICAL AUTH ERROR")
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Internal database error: {str(e)}")
        
        raise HTTPException(status_code=401, detail="Invalid API Key")

    # --- Standard JWT flow (Dashboard Access) ---
    try:
        payload = verify_token(token)
    except Exception as e:
        print(f"DEBUG: Token verification crashed: {e}")
        payload = None

    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return payload
