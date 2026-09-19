import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from .db import Base


def gen_uuid() -> uuid.UUID:
    return uuid.uuid4()


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    display_name = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Trip(Base):
    """Mirrors the frontend's tripStore shape — see frontend/src/state/types.ts."""

    __tablename__ = "trips"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    destination_raw = Column(String, nullable=False)
    destination_key = Column(String, nullable=False, default="fallback")
    status = Column(String, nullable=False, default="intake")  # intake|planning|booking|on_the_road|complete

    when_answer = Column(String, nullable=True)
    who_answer = Column(String, nullable=True)
    budget_answer = Column(String, nullable=True)
    pace_answer = Column(String, nullable=True)

    is_international = Column(Boolean, nullable=False, default=False)
    autonomy_level = Column(String, nullable=False, default="approve_each")

    days = Column(Integer, nullable=True)  # required before route drafting — see routers/trips.py draft_route
    special_requests = Column(Text, nullable=True)

    # A saved starting point (destination, answers, route) rather than a trip in progress —
    # see routers/trips.py save_as_template / create_trip_from_template. Excluded from the
    # normal "my trips" listing.
    is_template = Column(Boolean, nullable=False, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    crew = relationship("CrewMember", cascade="all, delete-orphan", backref="trip")
    route_stops = relationship(
        "RouteStop", cascade="all, delete-orphan", backref="trip", order_by="RouteStop.order_index"
    )
    items = relationship("ItineraryItem", cascade="all, delete-orphan", backref="trip")
    change_requests = relationship("ChangeRequest", cascade="all, delete-orphan", backref="trip")


class CrewMember(Base):
    __tablename__ = "crew_members"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    trip_id = Column(UUID(as_uuid=True), ForeignKey("trips.id"), nullable=False)
    email = Column(String, nullable=False)
    role = Column(String, nullable=False, default="editor")  # owner|editor|viewer


class RouteStop(Base):
    __tablename__ = "route_stops"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    trip_id = Column(UUID(as_uuid=True), ForeignKey("trips.id"), nullable=False)
    order_index = Column(Integer, nullable=False, default=0)
    name = Column(String, nullable=False)
    notes = Column(String, nullable=True)


class ItineraryItem(Base):
    __tablename__ = "itinerary_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    trip_id = Column(UUID(as_uuid=True), ForeignKey("trips.id"), nullable=False)
    item_type = Column(String, nullable=False)  # flight|stay|activity
    title = Column(String, nullable=False)
    cost_estimate = Column(Float, nullable=False, default=0)
    day_index = Column(Integer, nullable=False, default=1)
    slot = Column(String, nullable=False, default="morning")  # morning|afternoon|evening
    status = Column(String, nullable=False, default="proposed")  # proposed|pending_approval|simulated_booked
    source = Column(String, nullable=False, default="agent")  # agent|manual
    autonomy_at_booking = Column(String, nullable=True)


class ChangeRequest(Base):
    __tablename__ = "change_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    trip_id = Column(UUID(as_uuid=True), ForeignKey("trips.id"), nullable=False)
    prompt_text = Column(Text, nullable=False)
    affected_item_id = Column(UUID(as_uuid=True), ForeignKey("itinerary_items.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved = Column(Boolean, nullable=False, default=False)
