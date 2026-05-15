from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List
from core.database import get_db
from core.models import Profile
from core.schemas import ProfileCreate, ProfileResponse
from core.auth import get_current_user
import re

router = APIRouter(prefix="/auth", tags=["auth"], dependencies=[Depends(get_current_user)])

@router.get("/profile", response_model=ProfileResponse)
def get_profile(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Fetches the current user's profile, creating one from Supabase metadata if missing."""
    profile = db.query(Profile).filter(Profile.user_id == current_user["sub"]).first()
    
    if not profile:
        # Auto-provision profile from Supabase metadata if available
        meta = current_user.get("user_metadata", {})
        # Fallback to email prefix if no username/name
        raw_username = meta.get("user_name") or meta.get("full_name") or current_user.get("email", "").split("@")[0]
        # Sanitize: alphanumeric and underscores only
        clean_username = re.sub(r'[^a-zA-Z0-9_]', '', raw_username).lower()
        
        # Ensure uniqueness
        base_username = clean_username
        counter = 1
        while db.query(Profile).filter(Profile.username == clean_username).first():
            clean_username = f"{base_username}{counter}"
            counter += 1

        profile = Profile(
            user_id=current_user["sub"],
            username=clean_username,
            full_name=meta.get("full_name"),
            avatar_url=meta.get("avatar_url")
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
    
    return profile

@router.patch("/profile", response_model=ProfileResponse)
def update_profile(data: ProfileCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Updates the custom username (User ID)."""
    # Validation: 3-20 chars, alphanumeric/underscores
    if not re.match(r'^[a-zA-Z0-9_]{3,20}$', data.username):
        raise HTTPException(status_code=400, detail="Username must be 3-20 chars (alphanumeric and underscores only)")

    profile = db.query(Profile).filter(Profile.user_id == current_user["sub"]).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    # Check if new username is taken
    existing = db.query(Profile).filter(Profile.username == data.username).first()
    if existing and existing.user_id != profile.user_id:
        raise HTTPException(status_code=400, detail="Username already taken")

    profile.username = data.username.lower()
    db.commit()
    db.refresh(profile)
    return profile

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
