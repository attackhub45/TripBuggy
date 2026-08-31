from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import agent_service, models, schemas
from ..deps import get_current_user, get_db, get_owned_trip

router = APIRouter(prefix="/api/v1/trips", tags=["trips"])

QUESTION_KEYS = {"when", "who", "budget", "pace"}
AUTONOMY_LEVELS = {"draft_only", "approve_each", "full_auto"}


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
def get_trip(trip: models.Trip = Depends(get_owned_trip)):
    return trip


@router.post("/{trip_id}/intake-answers", response_model=schemas.TripOut)
def submit_intake_answer(
    trip_id: UUID,
    payload: schemas.IntakeAnswerRequest,
    trip: models.Trip = Depends(get_owned_trip),
    db: Session = Depends(get_db),
):
    if payload.question_key not in QUESTION_KEYS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unknown question key '{payload.question_key}'")
    setattr(trip, f"{payload.question_key}_answer", payload.answer_value)
    db.commit()
    db.refresh(trip)
    return trip


@router.post("/{trip_id}/crew", response_model=schemas.TripOut)
def add_crew(
    trip_id: UUID,
    payload: schemas.CrewCreateRequest,
    trip: models.Trip = Depends(get_owned_trip),
    db: Session = Depends(get_db),
):
    db.add(models.CrewMember(trip_id=trip.id, email=payload.email, role=payload.role))
    db.commit()
    db.refresh(trip)
    return trip


@router.post("/{trip_id}/route", response_model=schemas.TripOut)
def draft_route(trip_id: UUID, trip: models.Trip = Depends(get_owned_trip), db: Session = Depends(get_db)):
    """Agent Intake -> Plan the Route. See agent_service.draft_route_stops for the simulation seam."""
    for stop in list(trip.route_stops):
        db.delete(stop)
    db.flush()
    for i, stop in enumerate(agent_service.draft_route_stops(trip.destination_key, trip.destination_raw)):
        db.add(models.RouteStop(trip_id=trip.id, order_index=i, name=stop["name"], notes=stop["notes"]))
    trip.status = "planning"
    db.commit()
    db.refresh(trip)
    return trip


@router.post("/{trip_id}/route/stops", response_model=schemas.TripOut)
def add_route_stop(
    trip_id: UUID,
    payload: schemas.RouteStopCreateRequest,
    trip: models.Trip = Depends(get_owned_trip),
    db: Session = Depends(get_db),
):
    db.add(models.RouteStop(trip_id=trip.id, order_index=len(trip.route_stops), name=payload.name, notes=payload.notes))
    db.commit()
    db.refresh(trip)
    return trip


@router.delete("/{trip_id}/route/stops/{stop_id}", response_model=schemas.TripOut)
def remove_route_stop(
    trip_id: UUID,
    stop_id: UUID,
    trip: models.Trip = Depends(get_owned_trip),
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
def discover_options(trip_id: UUID, trip: models.Trip = Depends(get_owned_trip)):
    """Discover & Add. See agent_service.discover_catalog for the real-search-API seam."""
    return agent_service.discover_catalog(trip.destination_key, trip.destination_raw)


@router.post("/{trip_id}/itinerary-items", response_model=schemas.TripOut)
def add_itinerary_item(
    trip_id: UUID,
    payload: schemas.ItineraryItemCreateRequest,
    trip: models.Trip = Depends(get_owned_trip),
    db: Session = Depends(get_db),
):
    day, slot = agent_service.next_day_slot(len(trip.items))
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
    trip: models.Trip = Depends(get_owned_trip),
    db: Session = Depends(get_db),
):
    item = db.get(models.ItineraryItem, item_id)
    if not item or item.trip_id != trip.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Itinerary item not found")
    if payload.day_index is not None:
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
    trip: models.Trip = Depends(get_owned_trip),
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
def get_budget(trip_id: UUID, trip: models.Trip = Depends(get_owned_trip)):
    total = sum(i.cost_estimate for i in trip.items)
    cap = agent_service.budget_cap_for(trip.budget_answer)
    return schemas.BudgetOut(total=total, cap=cap, over_budget=total > cap)


@router.patch("/{trip_id}/autonomy", response_model=schemas.TripOut)
def set_autonomy(
    trip_id: UUID,
    payload: schemas.AutonomyUpdateRequest,
    trip: models.Trip = Depends(get_owned_trip),
    db: Session = Depends(get_db),
):
    if payload.autonomy_level not in AUTONOMY_LEVELS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Invalid autonomy level '{payload.autonomy_level}'")
    trip.autonomy_level = payload.autonomy_level
    db.commit()
    db.refresh(trip)
    return trip


@router.post("/{trip_id}/book", response_model=schemas.TripOut)
def run_booking(trip_id: UUID, trip: models.Trip = Depends(get_owned_trip), db: Session = Depends(get_db)):
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
    db.commit()
    db.refresh(trip)
    return trip


@router.post("/{trip_id}/itinerary-items/{item_id}/approve", response_model=schemas.TripOut)
def approve_item(
    trip_id: UUID,
    item_id: UUID,
    trip: models.Trip = Depends(get_owned_trip),
    db: Session = Depends(get_db),
):
    item = db.get(models.ItineraryItem, item_id)
    if not item or item.trip_id != trip.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Itinerary item not found")
    item.status = "simulated_booked"
    item.autonomy_at_booking = "approve_each"
    db.commit()
    db.refresh(trip)
    return trip


@router.post("/{trip_id}/change-requests", response_model=schemas.TripOut)
def submit_change_request(
    trip_id: UUID,
    payload: schemas.ChangeRequestCreateRequest,
    trip: models.Trip = Depends(get_owned_trip),
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
def complete_trip(trip_id: UUID, trip: models.Trip = Depends(get_owned_trip), db: Session = Depends(get_db)):
    trip.status = "complete"
    db.commit()
    db.refresh(trip)
    return trip
