from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import agent_service, models, schemas
from ..deps import get_current_user, get_db, get_trip_role, require_editor, require_owner, require_viewer

router = APIRouter(prefix="/api/v1/trips", tags=["trips"])

QUESTION_KEYS = {"when", "who", "budget", "pace"}
AUTONOMY_LEVELS = {"draft_only", "approve_each", "full_auto"}


def _resolve_change_requests_if_clear(trip: models.Trip) -> None:
    """If nothing is left pending approval, the most recent on-the-road change (if any) is resolved."""
    if any(i.status == "pending_approval" for i in trip.items):
        return
    for cr in trip.change_requests:
        if not cr.resolved:
            cr.resolved = True


@router.get("", response_model=list[schemas.TripSummaryOut])
def list_trips(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """Trips you own, plus trips you're a crew member on (matched by email)."""
    owned = db.query(models.Trip).filter(models.Trip.user_id == user.id).all()
    crew_trip_ids = {
        c.trip_id for c in db.query(models.CrewMember).filter(models.CrewMember.email.ilike(user.email)).all()
    }
    crew_trip_ids -= {t.id for t in owned}
    crewed = db.query(models.Trip).filter(models.Trip.id.in_(crew_trip_ids)).all() if crew_trip_ids else []

    results = []
    for trip in owned + crewed:
        trip.my_role = get_trip_role(trip, user)
        results.append(trip)
    results.sort(key=lambda t: t.created_at, reverse=True)
    return results


@router.post("", response_model=schemas.TripOut, status_code=status.HTTP_201_CREATED)
def create_trip(
    payload: schemas.TripCreateRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    trip = models.Trip(
        user_id=user.id,
        destination_raw=payload.destination,
        destination_key=agent_service.match_destination(payload.destination),
    )
    db.add(trip)
    db.commit()
    db.refresh(trip)
    return trip


@router.get("/{trip_id}", response_model=schemas.TripOut)
def get_trip(trip: models.Trip = Depends(require_viewer)):
    return trip


@router.post("/{trip_id}/intake-answers", response_model=schemas.TripOut)
def submit_intake_answer(
    trip_id: UUID,
    payload: schemas.IntakeAnswerRequest,
    trip: models.Trip = Depends(require_editor),
    db: Session = Depends(get_db),
):
    if payload.question_key not in QUESTION_KEYS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unknown question key '{payload.question_key}'")
    setattr(trip, f"{payload.question_key}_answer", payload.answer_value)
    db.commit()
    db.refresh(trip)
    return trip


@router.patch("/{trip_id}/international", response_model=schemas.TripOut)
def set_international(
    trip_id: UUID,
    payload: schemas.InternationalUpdateRequest,
    trip: models.Trip = Depends(require_editor),
    db: Session = Depends(get_db),
):
    trip.is_international = payload.is_international
    db.commit()
    db.refresh(trip)
    return trip


@router.patch("/{trip_id}/details", response_model=schemas.TripOut)
def set_trip_details(
    trip_id: UUID,
    payload: schemas.TripDetailsUpdateRequest,
    trip: models.Trip = Depends(require_editor),
    db: Session = Depends(get_db),
):
    if payload.days < 1:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Trip must be at least 1 day")
    trip.days = payload.days
    trip.special_requests = payload.special_requests
    db.commit()
    db.refresh(trip)
    return trip


@router.post("/{trip_id}/crew", response_model=schemas.TripOut)
def add_crew(
    trip_id: UUID,
    payload: schemas.CrewCreateRequest,
    trip: models.Trip = Depends(require_owner),
    db: Session = Depends(get_db),
):
    db.add(models.CrewMember(trip_id=trip.id, email=payload.email, role=payload.role))
    db.commit()
    db.refresh(trip)
    return trip


@router.post("/{trip_id}/route", response_model=schemas.TripOut)
def draft_route(trip_id: UUID, trip: models.Trip = Depends(require_editor), db: Session = Depends(get_db)):
    """Agent Intake -> Plan the Route. See agent_service.draft_route_stops for the simulation seam."""
    if trip.days is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Set the trip length (days) before drafting a route")
    for stop in list(trip.route_stops):
        db.delete(stop)
    db.flush()
    stops = agent_service.draft_route_stops(trip.destination_key, trip.destination_raw, trip.days, trip.special_requests)
    for i, stop in enumerate(stops):
        db.add(models.RouteStop(trip_id=trip.id, order_index=i, name=stop["name"], notes=stop["notes"]))
    trip.status = "planning"
    db.commit()
    db.refresh(trip)
    return trip


@router.post("/{trip_id}/route/stops", response_model=schemas.TripOut)
def add_route_stop(
    trip_id: UUID,
    payload: schemas.RouteStopCreateRequest,
    trip: models.Trip = Depends(require_editor),
    db: Session = Depends(get_db),
):
    db.add(models.RouteStop(trip_id=trip.id, order_index=len(trip.route_stops), name=payload.name, notes=payload.notes))
    db.commit()
    db.refresh(trip)
    return trip


@router.post("/{trip_id}/route/stops/{stop_id}/move", response_model=schemas.TripOut)
def move_route_stop(
    trip_id: UUID,
    stop_id: UUID,
    payload: schemas.RouteStopMoveRequest,
    trip: models.Trip = Depends(require_editor),
    db: Session = Depends(get_db),
):
    stops = sorted(trip.route_stops, key=lambda s: s.order_index)
    i = next((idx for idx, s in enumerate(stops) if s.id == stop_id), None)
    j = None if i is None else i + payload.direction
    if i is not None and j is not None and 0 <= j < len(stops):
        stops[i].order_index, stops[j].order_index = stops[j].order_index, stops[i].order_index
        db.commit()
        db.refresh(trip)
    return trip


@router.delete("/{trip_id}/route/stops/{stop_id}", response_model=schemas.TripOut)
def remove_route_stop(
    trip_id: UUID,
    stop_id: UUID,
    trip: models.Trip = Depends(require_editor),
    db: Session = Depends(get_db),
):
    stop = db.get(models.RouteStop, stop_id)
    if not stop or stop.trip_id != trip.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Route stop not found")
    db.delete(stop)
    db.commit()
    db.refresh(trip)
    return trip


@router.post("/{trip_id}/discover", response_model=list[schemas.DiscoverySuggestion])
def discover_options(trip_id: UUID, trip: models.Trip = Depends(require_editor)):
    """Discover & Add. See agent_service.discover_catalog for the real-search-API seam."""
    return agent_service.discover_catalog(trip.destination_key, trip.destination_raw)


@router.post("/{trip_id}/itinerary-items", response_model=schemas.TripOut)
def add_itinerary_item(
    trip_id: UUID,
    payload: schemas.ItineraryItemCreateRequest,
    trip: models.Trip = Depends(require_editor),
    db: Session = Depends(get_db),
):
    day, slot = agent_service.next_day_slot(len(trip.items), trip.days or 3)
    db.add(models.ItineraryItem(
        trip_id=trip.id,
        item_type=payload.item_type,
        title=payload.title,
        cost_estimate=payload.cost_estimate,
        day_index=day,
        slot=slot,
        source=payload.source,
    ))
    db.commit()
    db.refresh(trip)
    return trip


@router.patch("/{trip_id}/itinerary-items/{item_id}", response_model=schemas.TripOut)
def update_itinerary_item(
    trip_id: UUID,
    item_id: UUID,
    payload: schemas.ItineraryItemUpdateRequest,
    trip: models.Trip = Depends(require_editor),
    db: Session = Depends(get_db),
):
    item = db.get(models.ItineraryItem, item_id)
    if not item or item.trip_id != trip.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Itinerary item not found")
    if payload.day_index is not None:
        if trip.days and not (1 <= payload.day_index <= trip.days):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Day must be between 1 and {trip.days}")
        item.day_index = payload.day_index
    if payload.slot is not None:
        item.slot = payload.slot
    if payload.status is not None:
        item.status = payload.status
    db.commit()
    db.refresh(trip)
    return trip


@router.delete("/{trip_id}/itinerary-items/{item_id}", response_model=schemas.TripOut)
def remove_itinerary_item(
    trip_id: UUID,
    item_id: UUID,
    trip: models.Trip = Depends(require_editor),
    db: Session = Depends(get_db),
):
    item = db.get(models.ItineraryItem, item_id)
    if not item or item.trip_id != trip.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Itinerary item not found")
    db.delete(item)
    db.commit()
    db.refresh(trip)
    return trip


@router.get("/{trip_id}/budget", response_model=schemas.BudgetOut)
def get_budget(trip_id: UUID, trip: models.Trip = Depends(require_editor)):
    total = sum(i.cost_estimate for i in trip.items)
    cap = agent_service.budget_cap_for(trip.budget_answer)
    return schemas.BudgetOut(total=total, cap=cap, over_budget=total > cap)


@router.patch("/{trip_id}/autonomy", response_model=schemas.TripOut)
def set_autonomy(
    trip_id: UUID,
    payload: schemas.AutonomyUpdateRequest,
    trip: models.Trip = Depends(require_editor),
    db: Session = Depends(get_db),
):
    if payload.autonomy_level not in AUTONOMY_LEVELS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Invalid autonomy level '{payload.autonomy_level}'")
    trip.autonomy_level = payload.autonomy_level
    db.commit()
    db.refresh(trip)
    return trip


@router.post("/{trip_id}/book", response_model=schemas.TripOut)
def run_booking(trip_id: UUID, trip: models.Trip = Depends(require_editor), db: Session = Depends(get_db)):
    """Agentic Booking — the autonomy dial. See agent_service module docstring for the real-vendor seam."""
    trip.status = "booking"
    if trip.autonomy_level == "full_auto":
        for item in trip.items:
            if item.status != "simulated_booked":
                item.status = "simulated_booked"
                item.autonomy_at_booking = "full_auto"
    elif trip.autonomy_level == "approve_each":
        for item in trip.items:
            if item.status == "proposed":
                item.status = "pending_approval"
    # draft_only: nothing to run — items stay proposed for the customer to book themselves
    _resolve_change_requests_if_clear(trip)
    db.commit()
    db.refresh(trip)
    return trip


@router.post("/{trip_id}/itinerary-items/{item_id}/approve", response_model=schemas.TripOut)
def approve_item(
    trip_id: UUID,
    item_id: UUID,
    trip: models.Trip = Depends(require_editor),
    db: Session = Depends(get_db),
):
    item = db.get(models.ItineraryItem, item_id)
    if not item or item.trip_id != trip.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Itinerary item not found")
    item.status = "simulated_booked"
    item.autonomy_at_booking = "approve_each"
    _resolve_change_requests_if_clear(trip)
    db.commit()
    db.refresh(trip)
    return trip


@router.post("/{trip_id}/change-requests", response_model=schemas.TripOut)
def submit_change_request(
    trip_id: UUID,
    payload: schemas.ChangeRequestCreateRequest,
    trip: models.Trip = Depends(require_editor),
    db: Session = Depends(get_db),
):
    """On the Road -> loops back into Agentic Booking. See BRD.md 'On the Road' stage."""
    booked = [i for i in trip.items if i.status == "simulated_booked"]
    target = agent_service.pick_random(booked)
    db.add(models.ChangeRequest(
        trip_id=trip.id,
        prompt_text=payload.prompt_text,
        affected_item_id=target.id if target else None,
    ))
    if target:
        target.status = "pending_approval"
    trip.status = "on_the_road"
    db.commit()
    db.refresh(trip)
    return trip


@router.post("/{trip_id}/complete", response_model=schemas.TripOut)
def complete_trip(trip_id: UUID, trip: models.Trip = Depends(require_editor), db: Session = Depends(get_db)):
    trip.status = "complete"
    db.commit()
    db.refresh(trip)
    return trip
