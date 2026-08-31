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
