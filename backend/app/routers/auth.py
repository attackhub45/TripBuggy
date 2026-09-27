from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from .. import models, schemas, security
from ..deps import get_current_user, get_db
from ..rate_limit import limiter

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.get("/me", response_model=schemas.UserOut)
def me(user: models.User = Depends(get_current_user)):
    return user


@router.post("/signup", response_model=schemas.TokenResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/hour")
def signup(request: Request, payload: schemas.SignupRequest, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == payload.email).first()
    if existing:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Email already registered")
    user = models.User(
        email=payload.email,
        hashed_password=security.hash_password(payload.password),
        display_name=payload.display_name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return schemas.TokenResponse(access_token=security.create_access_token(str(user.id)))


@router.post("/login", response_model=schemas.TokenResponse)
@limiter.limit("20/hour")
def login(request: Request, payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user or not security.verify_password(payload.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has been disabled")
    return schemas.TokenResponse(access_token=security.create_access_token(str(user.id)))
