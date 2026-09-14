import { create } from 'zustand';
import { matchDestination, type DestinationKey } from '../art/DestinationArt';
import { api, ensureAuthenticated, type ApiTrip } from '../api/client';
import type {
  IntakeAnswers, RouteStop, ItineraryItem, CrewMember, ChangeRequest,
  AutonomyLevel, ItemType, ItemStatus, Slot,
} from './types';

// ---------------------------------------------------------------------------
// This store used to simulate everything client-side (see git history before
// this file). It now calls the real backend — see frontend/src/api/client.ts
// and backend/app/routers/trips.py. The agent logic behind those endpoints
// is still simulated (backend/app/agent_service.py); wiring the real Claude
// API is the next step, per docs/TRD.md §5.
// ---------------------------------------------------------------------------

const BUDGET_CAPS: Record<string, number> = {
  'Budget-friendly': 1200,
  Balanced: 2800,
  'Treat yourself': 6000,
};

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

const QUESTION_ORDER: (keyof IntakeAnswers)[] = ['when', 'who', 'budget', 'pace'];

interface TripState {
  tripId: string | null;

  // intake
  destinationRaw: string;
  destKey: DestinationKey;
  answers: IntakeAnswers;
  answeredOrder: (keyof IntakeAnswers)[];
  crew: CrewMember[];
  isInternational: boolean;

  // route
  routeStops: RouteStop[];
  routeLoading: boolean;

  // discover / itinerary
  suggestions: ItineraryItem[];
  items: ItineraryItem[];
  discoverLoading: boolean;

  // booking
  autonomyLevel: AutonomyLevel;
  bookingRunning: boolean;

  // on the road
  activeChangeRequest: ChangeRequest | null;
  changeLog: ChangeRequest[];

  // actions
  startTrip: (raw: string) => Promise<void>;
  answerQuestion: (key: keyof IntakeAnswers, value: string) => Promise<void>;
  addCrew: (email: string, role: CrewMember['role']) => Promise<void>;
  setInternational: (v: boolean) => Promise<void>;

  draftRoute: () => Promise<void>;
  addRouteStop: (name: string) => Promise<void>;
  removeRouteStop: (id: string) => Promise<void>;
  moveRouteStop: (id: string, dir: -1 | 1) => Promise<void>;

  discoverOptions: () => Promise<void>;
  addSuggestionToItinerary: (suggestionId: string) => Promise<void>;
  addManualItem: (title: string, type: ItemType, cost: number) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  setItemSlot: (id: string, day: number, slot: Slot) => Promise<void>;

  budgetCap: () => number;
  budgetTotal: () => number;
  isOverBudget: () => boolean;
  hasConflicts: () => boolean;

  setAutonomy: (level: AutonomyLevel) => Promise<void>;
  runBooking: () => Promise<void>;
  approveItem: (id: string) => Promise<void>;

  submitChangeRequest: (text: string) => Promise<void>;
  resolveActiveChange: () => void;

  reset: () => void;
}

const initialState = {
  tripId: null as string | null,

  destinationRaw: '',
  destKey: 'fallback' as DestinationKey,
  answers: {} as IntakeAnswers,
  answeredOrder: [] as (keyof IntakeAnswers)[],
  crew: [] as CrewMember[],
  isInternational: false,

  routeStops: [] as RouteStop[],
  routeLoading: false,

  suggestions: [] as ItineraryItem[],
  items: [] as ItineraryItem[],
  discoverLoading: false,

  autonomyLevel: 'approve_each' as AutonomyLevel,
  bookingRunning: false,

  activeChangeRequest: null as ChangeRequest | null,
  changeLog: [] as ChangeRequest[],
};

/** Converts the backend's TripOut shape into this store's shape, in one place. */
function mapTrip(trip: ApiTrip) {
  const answers: IntakeAnswers = {};
  if (trip.when_answer) answers.when = trip.when_answer;
  if (trip.who_answer) answers.who = trip.who_answer;
  if (trip.budget_answer) answers.budget = trip.budget_answer;
  if (trip.pace_answer) answers.pace = trip.pace_answer;
  const answeredOrder = QUESTION_ORDER.filter((k) => answers[k] !== undefined);

  const changeLog: ChangeRequest[] = trip.change_requests.map((c) => ({
    id: c.id,
    text: c.prompt_text,
    affectedItemId: c.affected_item_id,
    createdAt: new Date(c.created_at).getTime(),
  }));
  const activeRaw = trip.change_requests.find((c) => !c.resolved) ?? null;

  return {
    tripId: trip.id,
    destinationRaw: trip.destination_raw,
    destKey: trip.destination_key as DestinationKey,
    answers,
    answeredOrder,
    crew: trip.crew.map((c) => ({ id: c.id, email: c.email, role: c.role as CrewMember['role'] })),
    isInternational: trip.is_international,
    routeStops: trip.route_stops.map((s) => ({ id: s.id, name: s.name, notes: s.notes ?? '' })),
    items: trip.items.map((i) => ({
      id: i.id,
      type: i.item_type as ItemType,
      title: i.title,
      cost: i.cost_estimate,
      day: i.day_index,
      slot: i.slot as Slot,
      status: i.status as ItemStatus,
      source: i.source as 'agent' | 'manual',
      autonomyAtBooking: (i.autonomy_at_booking ?? undefined) as AutonomyLevel | undefined,
    })),
    autonomyLevel: trip.autonomy_level as AutonomyLevel,
    activeChangeRequest: activeRaw
      ? {
          id: activeRaw.id,
          text: activeRaw.prompt_text,
          affectedItemId: activeRaw.affected_item_id,
          createdAt: new Date(activeRaw.created_at).getTime(),
        }
      : null,
    changeLog,
  };
}

export const useTripStore = create<TripState>((set, get) => ({
  ...initialState,

  startTrip: async (raw) => {
    set({ ...initialState, destinationRaw: raw });
    await ensureAuthenticated();
    const trip = await api.createTrip(raw);
    set(mapTrip(trip));
  },

  answerQuestion: async (key, value) => {
    const { tripId } = get();
    if (!tripId) return;
    const trip = await api.submitIntakeAnswer(tripId, key, value);
    set(mapTrip(trip));
  },

  addCrew: async (email, role) => {
    const { tripId } = get();
    if (!tripId || !email.trim()) return;
    const trip = await api.addCrew(tripId, email.trim(), role);
    set(mapTrip(trip));
  },

  setInternational: async (v) => {
    const { tripId } = get();
    if (!tripId) return;
    const trip = await api.setInternational(tripId, v);
    set(mapTrip(trip));
  },

  draftRoute: async () => {
    const { tripId } = get();
    if (!tripId) return;
    set({ routeLoading: true });
    try {
      const trip = await api.draftRoute(tripId);
      set({ ...mapTrip(trip), routeLoading: false });
    } catch (err) {
      set({ routeLoading: false });
      throw err;
    }
  },

  addRouteStop: async (name) => {
    const { tripId } = get();
    if (!tripId || !name.trim()) return;
    const trip = await api.addRouteStop(tripId, name.trim());
    set(mapTrip(trip));
  },

  removeRouteStop: async (id) => {
    const { tripId } = get();
    if (!tripId) return;
    const trip = await api.removeRouteStop(tripId, id);
    set(mapTrip(trip));
  },

  moveRouteStop: async (id, dir) => {
    const { tripId } = get();
    if (!tripId) return;
    const trip = await api.moveRouteStop(tripId, id, dir);
    set(mapTrip(trip));
  },

  discoverOptions: async () => {
    const { tripId } = get();
    if (!tripId) return;
    set({ discoverLoading: true });
    try {
      const raw = await api.discoverOptions(tripId);
      const suggestions: ItineraryItem[] = raw.map((s) => ({
        id: uid('sug'),
        type: s.item_type as ItemType,
        title: s.title,
        cost: s.cost_estimate,
        day: 1,
        slot: 'morning',
        status: 'proposed',
        source: 'agent',
      }));
      set({ suggestions, discoverLoading: false });
    } catch (err) {
      set({ discoverLoading: false });
      throw err;
    }
  },

  addSuggestionToItinerary: async (suggestionId) => {
    const { tripId, suggestions } = get();
    if (!tripId) return;
    const s = suggestions.find((x) => x.id === suggestionId);
    if (!s) return;
    const trip = await api.addItineraryItem(tripId, s.type, s.title, s.cost, 'agent');
    set(mapTrip(trip));
  },

  addManualItem: async (title, type, cost) => {
    const { tripId } = get();
    if (!tripId || !title.trim()) return;
    const trip = await api.addItineraryItem(tripId, type, title.trim(), cost, 'manual');
    set(mapTrip(trip));
  },

  removeItem: async (id) => {
    const { tripId } = get();
    if (!tripId) return;
    const trip = await api.removeItineraryItem(tripId, id);
    set(mapTrip(trip));
  },

  setItemSlot: async (id, day, slot) => {
    const { tripId } = get();
    if (!tripId) return;
    const trip = await api.updateItineraryItem(tripId, id, { day_index: day, slot });
    set(mapTrip(trip));
  },

  budgetCap: () => BUDGET_CAPS[get().answers.budget ?? ''] ?? 2800,
  budgetTotal: () => get().items.reduce((sum, i) => sum + i.cost, 0),
  isOverBudget: () => get().budgetTotal() > get().budgetCap(),
  hasConflicts: () => {
    const items = get().items;
    const seen = new Set<string>();
    for (const i of items) {
      const key = `${i.day}-${i.slot}`;
      if (seen.has(key)) return true;
      seen.add(key);
    }
    return false;
  },

  setAutonomy: async (level) => {
    const { tripId } = get();
    if (!tripId) return;
    const trip = await api.setAutonomy(tripId, level);
    set(mapTrip(trip));
  },

  runBooking: async () => {
    const { tripId, autonomyLevel } = get();
    if (!tripId || autonomyLevel === 'draft_only') return;
    set({ bookingRunning: true });
    try {
      const trip = await api.runBooking(tripId);
      set({ ...mapTrip(trip), bookingRunning: false });
    } catch (err) {
      set({ bookingRunning: false });
      throw err;
    }
  },

  approveItem: async (id) => {
    const { tripId } = get();
    if (!tripId) return;
    const trip = await api.approveItem(tripId, id);
    set(mapTrip(trip));
  },

  submitChangeRequest: async (text) => {
    const { tripId } = get();
    if (!tripId || !text.trim()) return;
    const trip = await api.submitChangeRequest(tripId, text.trim());
    set(mapTrip(trip));
  },

  resolveActiveChange: () => set({ activeChangeRequest: null }),

  reset: () => set({ ...initialState }),
}));
