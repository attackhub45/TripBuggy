from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import agent_service, models, schemas
from ..deps import get_current_user, get_db, get_trip_role

router = APIRouter(prefix="/api/v1/assistant", tags=["assistant"])


@router.post("/ask", response_model=schemas.AssistantAskResponse)
def ask(
    payload: schemas.AssistantAskRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Free-text Q&A for the floating assistant widget — works on any screen, with or
    without an active trip. If a trip_id is given but the caller isn't on that trip,
    the question still gets answered, just without trip-specific context."""
    trip_context = None
    if payload.trip_id:
        trip = db.get(models.Trip, payload.trip_id)
        if trip and get_trip_role(trip, user) is not None:
            trip_context = agent_service.summarize_trip_for_assistant(trip)
    answer = agent_service.answer_assistant_question(payload.question, payload.screen, trip_context)
    return schemas.AssistantAskResponse(answer=answer)
