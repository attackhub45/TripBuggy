from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from .. import models, schemas, security
from ..deps import get_db, require_admin
from ..rate_limit import limiter

router = APIRouter(prefix="/api/v1/admin", tags=["admin"], dependencies=[Depends(require_admin)])


def _get_user_or_404(db: Session, user_id: UUID) -> models.User:
    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return user


def _with_trip_count(db: Session, user: models.User) -> models.User:
    user.trip_count = (  # transient — picked up by AdminUserOut.trip_count
        db.query(models.Trip).filter(models.Trip.user_id == user.id, models.Trip.is_template.is_(False)).count()
    )
    return user


@router.get("/users", response_model=list[schemas.AdminUserOut])
@limiter.limit("60/hour")
def list_users(request: Request, db: Session = Depends(get_db)):
    users = db.query(models.User).order_by(models.User.created_at.desc()).all()
    counts_by_user: dict = {}
    for (user_id,) in db.query(models.Trip.user_id).filter(models.Trip.is_template.is_(False)).all():
        counts_by_user[user_id] = counts_by_user.get(user_id, 0) + 1
    for user in users:
        user.trip_count = counts_by_user.get(user.id, 0)
    return users


@router.patch("/users/{user_id}", response_model=schemas.AdminUserOut)
@limiter.limit("60/hour")
def update_user(request: Request, user_id: UUID, payload: schemas.AdminUserUpdateRequest, db: Session = Depends(get_db)):
    user = _get_user_or_404(db, user_id)
    if payload.email is not None and payload.email != user.email:
        if db.query(models.User).filter(models.User.email == payload.email).first():
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Email already registered")
        user.email = payload.email
    if payload.display_name is not None:
        user.display_name = payload.display_name
    db.commit()
    db.refresh(user)
    return _with_trip_count(db, user)


@router.post("/users/{user_id}/reset-password", response_model=schemas.AdminUserOut)
@limiter.limit("60/hour")
def reset_password(request: Request, user_id: UUID, payload: schemas.AdminResetPasswordRequest, db: Session = Depends(get_db)):
    user = _get_user_or_404(db, user_id)
    user.hashed_password = security.hash_password(payload.new_password)
    db.commit()
    db.refresh(user)
    return _with_trip_count(db, user)


@router.post("/users/{user_id}/deactivate", response_model=schemas.AdminUserOut)
@limiter.limit("60/hour")
def deactivate_user(request: Request, user_id: UUID, db: Session = Depends(get_db)):
    """Blocks login and invalidates any existing token immediately (see deps.py's
    get_current_user) — the account and its trips are kept, just unusable."""
    user = _get_user_or_404(db, user_id)
    user.is_active = False
    db.commit()
    db.refresh(user)
    return _with_trip_count(db, user)


@router.post("/users/{user_id}/activate", response_model=schemas.AdminUserOut)
@limiter.limit("60/hour")
def activate_user(request: Request, user_id: UUID, db: Session = Depends(get_db)):
    user = _get_user_or_404(db, user_id)
    user.is_active = True
    db.commit()
    db.refresh(user)
    return _with_trip_count(db, user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("60/hour")
def delete_user(request: Request, user_id: UUID, db: Session = Depends(get_db)):
    """Deletes the user's own trips (cascading to their route stops/items/crew/change
    requests, same as a customer deleting their own trip) before deleting the account
    itself — trips.user_id has no DB-level cascade, so this has to happen explicitly."""
    user = _get_user_or_404(db, user_id)
    for trip in db.query(models.Trip).filter(models.Trip.user_id == user.id).all():
        db.delete(trip)
    db.delete(user)
    db.commit()


@router.get("/users/{user_id}/trips", response_model=list[schemas.AdminTripOut])
@limiter.limit("60/hour")
def list_user_trips(request: Request, user_id: UUID, db: Session = Depends(get_db)):
    _get_user_or_404(db, user_id)
    return db.query(models.Trip).filter(models.Trip.user_id == user_id).order_by(models.Trip.created_at.desc()).all()


@router.delete("/trips/{trip_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("60/hour")
def delete_trip(request: Request, trip_id: UUID, db: Session = Depends(get_db)):
    """Same as a customer deleting their own trip, but callable on anyone's — for cleaning
    up a specific bad/abusive trip without deleting the whole account."""
    trip = db.get(models.Trip, trip_id)
    if not trip:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Trip not found")
    db.delete(trip)
    db.commit()


@router.get("/settings", response_model=schemas.AdminSettingsOut)
@limiter.limit("60/hour")
def get_settings(request: Request, db: Session = Depends(get_db)):
    setting = db.get(models.AppSetting, "force_simulated_agent")
    return schemas.AdminSettingsOut(force_simulated_agent=bool(setting and setting.value == "true"))


@router.patch("/settings", response_model=schemas.AdminSettingsOut)
@limiter.limit("60/hour")
def update_settings(request: Request, payload: schemas.AdminSettingsUpdateRequest, db: Session = Depends(get_db)):
    """force_simulated_agent is a cost kill switch — when true, every agent call falls back
    to its deterministic simulated path (see agent_service._get_client), regardless of
    whether ANTHROPIC_API_KEY is set. Use it if costs spike unexpectedly and you need to
    stop live Claude calls without redeploying."""
    setting = db.get(models.AppSetting, "force_simulated_agent")
    value = "true" if payload.force_simulated_agent else "false"
    if setting:
        setting.value = value
    else:
        db.add(models.AppSetting(key="force_simulated_agent", value=value))
    db.commit()
    return schemas.AdminSettingsOut(force_simulated_agent=payload.force_simulated_agent)
