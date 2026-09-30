export type AutonomyLevel = 'draft_only' | 'approve_each' | 'full_auto';
export type ItemStatus = 'proposed' | 'pending_approval' | 'simulated_booked';
export type ItemType = 'flight' | 'stay' | 'activity';
export type Slot = 'morning' | 'afternoon' | 'evening';

export interface IntakeAnswers {
  when?: string;
  who?: string;
  budget?: string;
  pace?: string;
}

export interface RouteStop {
  id: string;
  name: string;
  notes: string;
}

export interface ItineraryItem {
  id: string;
  type: ItemType;
  title: string;
  cost: number;
  day: number;
  slot: Slot;
  status: ItemStatus;
  source: 'agent' | 'manual';
  autonomyAtBooking?: AutonomyLevel;
  /** A real, hand-verified search-results link (Google Flights, Airbnb, or TripAdvisor —
   * see backend's _default_platform_and_url) — carried over from the Discover suggestion
   * this item was added from, so it's still there once the item is booked, not just while
   * proposed. */
  platform?: string;
  bookingUrl?: string;
}

export interface CrewMember {
  id: string;
  email: string;
  role: 'owner' | 'editor' | 'viewer';
}

export interface ChangeRequest {
  id: string;
  text: string;
  affectedItemId: string | null;
  createdAt: number;
}
