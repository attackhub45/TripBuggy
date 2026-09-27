from fastapi import APIRouter, Depends, Request

from .. import agent_service, models, schemas
from ..deps import get_current_user
from ..rate_limit import limiter

router = APIRouter(prefix="/api/v1/destinations", tags=["destinations"])


@router.post("/verify", response_model=schemas.DestinationVerifyResponse)
@limiter.limit("30/hour")
def verify(
    request: Request,
    payload: schemas.DestinationVerifyRequest,
    user: models.User = Depends(get_current_user),
):
    """Home screen, before a trip is created — checks the customer's free-text destination
    is a real place and fixes casing/spelling, or offers close alternatives if it isn't."""
    result = agent_service.verify_destination(payload.raw)
    return schemas.DestinationVerifyResponse(**result)
