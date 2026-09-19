from typing import Generator
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from . import models, security
from .db import SessionLocal

bearer_scheme = HTTPBearer()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    user_id = security.decode_token(creds.credentials)
    if not user_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    user = db.get(models.User, UUID(user_id))
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return user


def get_trip_role(trip: models.Trip, user: models.User) -> "str | None":
    """Owner always has full access. Otherwise, match the user's email against crew
    invites — crew members aren't linked by a foreign key, just by email, so anyone who
    signs up or logs in with the invited address is recognized automatically."""
    if trip.user_id == user.id:
        return "owner"
    for member in trip.crew:
        if member.email.lower() == user.email.lower():
            return member.role
    return None


def require_viewer(
    trip_id: UUID,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
) -> models.Trip:
    """Any role (owner/editor/viewer) can read a trip. Non-members get 404, not 403 —
    don't reveal that a trip exists to people who aren't on it."""
    trip = db.get(models.Trip, trip_id)
    role = get_trip_role(trip, user) if trip else None
    if role is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Trip not found")
    trip.my_role = role  # transient attribute — picked up by TripOut.my_role on the way out
    return trip


def require_editor(
    trip_id: UUID,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
) -> models.Trip:
    trip = db.get(models.Trip, trip_id)
    role = get_trip_role(trip, user) if trip else None
    if role is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Trip not found")
    if role not in ("owner", "editor"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Viewers can't make changes to this trip")
    trip.my_role = role
    return trip


def require_owner(
    trip_id: UUID,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
) -> models.Trip:
    trip = db.get(models.Trip, trip_id)
    role = get_trip_role(trip, user) if trip else None
    if role is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Trip not found")
    if role != "owner":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the trip owner can do that")
    trip.my_role = role
    return trip
