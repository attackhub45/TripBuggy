import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr


class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    display_name: Optional[str] = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    email: str
    display_name: Optional[str]


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TripCreateRequest(BaseModel):
    destination: str


class DestinationVerifyRequest(BaseModel):
    raw: str


class DestinationVerifyResponse(BaseModel):
    is_real_place: bool
    corrected_name: str
    suggestions: List[str] = []


class IntakeAnswerRequest(BaseModel):
    question_key: str  # when|who|budget|pace
    answer_value: str


class CrewCreateRequest(BaseModel):
    email: EmailStr
    role: str = "editor"


class CrewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    email: str
    role: str


class RouteStopCreateRequest(BaseModel):
    name: str
    notes: Optional[str] = None


class RouteStopMoveRequest(BaseModel):
    direction: int  # -1 or 1


class RouteStopReorderRequest(BaseModel):
    stop_ids: List[uuid.UUID]  # the complete new order, must match the trip's current stops exactly


class RouteStopOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    order_index: int
    name: str
    notes: Optional[str]


class ItineraryItemCreateRequest(BaseModel):
    item_type: str
    title: str
    cost_estimate: float
    source: str = "manual"
    platform: Optional[str] = None
    booking_url: Optional[str] = None


class ItineraryItemUpdateRequest(BaseModel):
    day_index: Optional[int] = None
    slot: Optional[str] = None
    status: Optional[str] = None


class ItineraryItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    item_type: str
    title: str
    cost_estimate: float
    day_index: int
    slot: str
    status: str
    source: str
    autonomy_at_booking: Optional[str]
    platform: Optional[str] = None
    booking_url: Optional[str] = None


class BudgetOut(BaseModel):
    total: float
    cap: float
    over_budget: bool


class AutonomyUpdateRequest(BaseModel):
    autonomy_level: str


class InternationalUpdateRequest(BaseModel):
    is_international: bool


class TripDetailsUpdateRequest(BaseModel):
    days: int
    special_requests: Optional[str] = None


class ChangeRequestCreateRequest(BaseModel):
    prompt_text: str


class ChangeRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    prompt_text: str
    affected_item_id: Optional[uuid.UUID]
    resolved: bool
    created_at: datetime


class DiscoverySuggestion(BaseModel):
    item_type: str
    title: str
    cost_estimate: float
    platform: Optional[str] = None
    booking_url: Optional[str] = None


class TripOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    destination_raw: str
    destination_key: str
    status: str
    when_answer: Optional[str]
    who_answer: Optional[str]
    budget_answer: Optional[str]
    pace_answer: Optional[str]
    is_international: bool
    autonomy_level: str
    days: Optional[int]
    special_requests: Optional[str]
    my_role: str = "owner"
    crew: List[CrewOut] = []
    route_stops: List[RouteStopOut] = []
    items: List[ItineraryItemOut] = []
    change_requests: List[ChangeRequestOut] = []


class AssistantAskRequest(BaseModel):
    question: str
    screen: str
    trip_id: Optional[uuid.UUID] = None


class AssistantAskResponse(BaseModel):
    answer: str


class AdminUserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    email: str
    display_name: Optional[str]
    is_active: bool
    created_at: datetime
    trip_count: int


class AdminResetPasswordRequest(BaseModel):
    new_password: str


class AdminUserUpdateRequest(BaseModel):
    email: Optional[EmailStr] = None
    display_name: Optional[str] = None


class AdminTripOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    destination_raw: str
    status: str
    days: Optional[int]
    is_template: bool
    created_at: datetime


class AdminSettingsOut(BaseModel):
    force_simulated_agent: bool


class AdminSettingsUpdateRequest(BaseModel):
    force_simulated_agent: bool


class TripSummaryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    destination_raw: str
    destination_key: str
    status: str
    days: Optional[int]
    my_role: str
    created_at: datetime
