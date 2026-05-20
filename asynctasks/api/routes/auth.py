from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List
from core.database import get_db
from core.models import Profile, UserSettings, APIKey, Credential
from core.schemas import ProfileCreate, ProfileResponse, UserSettingsResponse, UserSettingsBase, APIKeyCreate, APIKeyResponse, APIKeyFullResponse, CredentialCreate, CredentialResponse
from core.auth import get_current_user
from core.crypto import encrypt_string
import re
import secrets
import hashlib
from uuid import UUID

router = APIRouter(prefix="/auth", tags=["auth"], dependencies=[Depends(get_current_user)])

@router.get("/profile", response_model=ProfileResponse)
def get_profile(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Fetches the current user's profile, creating one from Supabase metadata if missing."""
    user_uuid = UUID(current_user["sub"])
    profile = db.query(Profile).filter(Profile.user_id == user_uuid).first()
    
    if not profile:
        # Auto-provision profile from Supabase metadata if available
        meta = current_user.get("user_metadata", {})
        # Fallback to email prefix if no username/name
        email = current_user.get("email") or ""
        raw_username = meta.get("user_name") or meta.get("full_name") or email.split("@")[0] or "user"
        # Sanitize: alphanumeric and underscores only
        clean_username = re.sub(r'[^a-zA-Z0-9_]', '', raw_username).lower()
        
        # Ensure uniqueness
        base_username = clean_username
        counter = 1
        while db.query(Profile).filter(Profile.username == clean_username).first():
            clean_username = f"{base_username}{counter}"
            counter += 1

        profile = Profile(
            user_id=user_uuid,
            username=clean_username,
            full_name=meta.get("full_name"),
            avatar_url=meta.get("avatar_url")
        )
        db.add(profile)
        
        # Also initialize default settings
        settings = UserSettings(user_id=user_uuid)
        db.add(settings)
        
        try:
            db.commit()
            db.refresh(profile)
        except Exception:
            db.rollback()
            # If commit fails, another request likely created the profile already
            profile = db.query(Profile).filter(Profile.user_id == user_uuid).first()
            if not profile:
                raise HTTPException(status_code=500, detail="Failed to provision profile")
    
    return profile

@router.patch("/profile", response_model=ProfileResponse)
def update_profile(data: ProfileCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Updates the custom username (User ID)."""
    # Validation: 3-20 chars, alphanumeric/underscores
    if not re.match(r'^[a-zA-Z0-9_]{3,20}$', data.username):
        raise HTTPException(status_code=400, detail="Username must be 3-20 chars (alphanumeric and underscores only)")

    user_uuid = UUID(current_user["sub"])
    profile = db.query(Profile).filter(Profile.user_id == user_uuid).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    # Check if new username is taken
    existing = db.query(Profile).filter(Profile.username == data.username).first()
    if existing and existing.user_id != user_uuid:
        raise HTTPException(status_code=400, detail="Username already taken")

    profile.username = data.username.lower()
    db.commit()
    db.refresh(profile)
    return profile

@router.get("/settings", response_model=UserSettingsResponse)
def get_settings(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Fetches user preferences."""
    user_uuid = UUID(current_user["sub"])
    settings = db.query(UserSettings).filter(UserSettings.user_id == user_uuid).first()
    if not settings:
        # Lazy initialization
        settings = UserSettings(user_id=user_uuid)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings

@router.patch("/settings", response_model=UserSettingsResponse)
def update_settings(data: UserSettingsBase, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Updates user preferences."""
    user_uuid = UUID(current_user["sub"])
    settings = db.query(UserSettings).filter(UserSettings.user_id == user_uuid).first()
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")

    settings.notifications_enabled = data.notifications_enabled
    settings.appearance_mode = data.appearance_mode
    db.commit()
    db.refresh(settings)
    return settings

@router.get("/keys", response_model=List[APIKeyResponse])
def list_api_keys(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Lists metadata for all API keys owned by the user."""
    user_uuid = UUID(current_user["sub"])
    return db.query(APIKey).filter(APIKey.user_id == user_uuid).all()

@router.post("/keys", response_model=APIKeyFullResponse)
def create_api_key(data: APIKeyCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Generates a new API key with a selectable expiration period."""
    from datetime import datetime, timedelta, timezone

    user_uuid = UUID(current_user["sub"])
    raw_key = f"ad_live_{secrets.token_urlsafe(32)}"
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()

    # Calculate expiration using timezone-aware UTC
    expires_at = datetime.now(timezone.utc) + timedelta(days=data.validity_days)

    new_key = APIKey(
        user_id=user_uuid,
        name=data.name,
        key_prefix=raw_key[:12], # ad_live_xxxx
        key_hash=key_hash,
        secret_key=raw_key, # Stored for 'visible always' access
        expires_at=expires_at
    )
    db.add(new_key)
    db.commit()
    db.refresh(new_key)

    return new_key

@router.delete("/keys/{key_id}")
def delete_api_key(key_id: UUID, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Revokes an API key."""
    user_uuid = UUID(current_user["sub"])
    key = db.query(APIKey).filter(APIKey.id == key_id, APIKey.user_id == user_uuid).first()
    if not key:
        raise HTTPException(status_code=404, detail="API Key not found")
    
    db.delete(key)
    db.commit()
    return {"message": "API key revoked"}

@router.get("/credentials", response_model=List[CredentialResponse])
def list_credentials(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Lists all stored credentials for the current user."""
    user_id = UUID(current_user["sub"])
    return db.query(Credential).filter(Credential.user_id == user_id).all()

@router.post("/credentials", response_model=CredentialResponse)
def create_credential(data: CredentialCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Securely stores a new private credential (SSH or PAT)."""
    user_id = UUID(current_user["sub"])
    
    # Encrypt the raw value before storage
    encrypted_val = encrypt_string(data.value)
    
    new_cred = Credential(
        user_id=user_id,
        name=data.name,
        type=data.type,
        encrypted_value=encrypted_val
    )
    db.add(new_cred)
    db.commit()
    db.refresh(new_cred)
    return new_cred

@router.delete("/credentials/{credential_id}")
def delete_credential(credential_id: UUID, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Removes a stored credential with row-level locking."""
    user_id = UUID(current_user["sub"])
    # Lock the row before deletion to prevent concurrent deletion errors
    cred = db.query(Credential).with_for_update().filter(Credential.id == credential_id, Credential.user_id == user_id).first()
    if not cred:
        raise HTTPException(status_code=404, detail="Credential not found")
    
    db.delete(cred)
    db.commit()
    return {"status": "deleted"}

@router.get("/lookup/{username}", response_model=ProfileResponse)
def lookup_user(username: str, db: Session = Depends(get_db)):
    """Looks up a user by their custom username."""
    profile = db.query(Profile).filter(Profile.username == username.lower()).first()
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")
    return profile

@router.get("/search", response_model=List[ProfileResponse])
def search_users(q: str, db: Session = Depends(get_db)):
    """Searches for users by partial username."""
    if len(q) < 2:
        return []
    return db.query(Profile).filter(Profile.username.ilike(f"%{q}%")).limit(5).all()
