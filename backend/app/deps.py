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


def get_owned_trip(
    trip_id: UUID,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
) -> models.Trip:
    trip = db.get(models.Trip, trip_id)
    if not trip or trip.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Trip not found")
    return trip
