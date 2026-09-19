import { create } from 'zustand';
import { matchDestination, type DestinationKey } from '../art/DestinationArt';
import { api, ensureAuthenticated, setActiveTripId, AuthError, type ApiTrip } from '../api/client';
import { useToastStore } from './toastStore';
import { friendlyMessage } from '../lib/errors';
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
  myRole: 'owner' | 'editor' | 'viewer';
  loadingTrip: boolean;

  // intake
  destinationRaw: string;
  destKey: DestinationKey;
  answers: IntakeAnswers;
  answeredOrder: (keyof IntakeAnswers)[];
  crew: CrewMember[];
  isInternational: boolean;
  days: number | null;
  specialRequests: string;

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
  loadTrip: (tripId: string) => Promise<void>;
  startTrip: (raw: string) => Promise<void>;
  answerQuestion: (key: keyof IntakeAnswers, value: string) => Promise<void>;
  addCrew: (email: string, role: CrewMember['role']) => Promise<void>;
  setInternational: (v: boolean) => Promise<void>;
  setTripDetails: (days: number, specialRequests: string) => Promise<void>;

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
  completeTrip: () => Promise<void>;

  reset: () => void;
}

const initialState = {
  tripId: null as string | null,
  myRole: 'owner' as 'owner' | 'editor' | 'viewer',
  loadingTrip: false,

  destinationRaw: '',
  destKey: 'fallback' as DestinationKey,
  answers: {} as IntakeAnswers,
  answeredOrder: [] as (keyof IntakeAnswers)[],
  crew: [] as CrewMember[],
  isInternational: false,
  days: null as number | null,
  specialRequests: '',

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
    myRole: trip.my_role as 'owner' | 'editor' | 'viewer',
    destinationRaw: trip.destination_raw,
    destKey: trip.destination_key as DestinationKey,
    answers,
    answeredOrder,
    crew: trip.crew.map((c) => ({ id: c.id, email: c.email, role: c.role as CrewMember['role'] })),
    isInternational: trip.is_international,
    days: trip.days,
    specialRequests: trip.special_requests ?? '',
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

/** mapTrip, plus persisting which trip is "active" so a refresh can reload it — see loadTrip below. */
function applyTrip(trip: ApiTrip) {
  setActiveTripId(trip.id);
  return mapTrip(trip);
}

/**
 * Runs an API call and, on failure, surfaces a toast with a readable message before
 * rethrowing (so any loading-state cleanup a caller still does keeps working). startTrip
 * and loadTrip skip this — they already have dedicated error UI in HomeScreen/App.tsx.
 */
async function withToast<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    useToastStore.getState().pushToast(friendlyMessage(err));
    throw err;
  }
}

export const useTripStore = create<TripState>((set, get) => ({
  ...initialState,

  loadTrip: async (tripId) => {
    set({ loadingTrip: true });
    try {
      const trip = await api.getTrip(tripId);
      set({ ...applyTrip(trip), loadingTrip: false });
    } catch (err) {
      setActiveTripId(null);
      set({ loadingTrip: false });
      throw err;
    }
  },

  startTrip: async (raw) => {
    set({ ...initialState, destinationRaw: raw });
    await ensureAuthenticated();
    let trip: ApiTrip;
    try {
      trip = await api.createTrip(raw);
    } catch (err) {
      // A stale token from a previous session (e.g. its account no longer exists) was
      // already cleared by the 401 handler in api/client.ts — re-provision once and retry.
      if (!(err instanceof AuthError)) throw err;
      await ensureAuthenticated();
      trip = await api.createTrip(raw);
    }
    set(applyTrip(trip));
  },

  answerQuestion: async (key, value) => {
    const { tripId } = get();
    if (!tripId) return;
    const trip = await withToast(() => api.submitIntakeAnswer(tripId, key, value));
    set(applyTrip(trip));
  },

  addCrew: async (email, role) => {
    const { tripId } = get();
    if (!tripId || !email.trim()) return;
    const trip = await withToast(() => api.addCrew(tripId, email.trim(), role));
    set(applyTrip(trip));
  },

  setInternational: async (v) => {
    const { tripId } = get();
    if (!tripId) return;
    const trip = await withToast(() => api.setInternational(tripId, v));
    set(applyTrip(trip));
  },

  setTripDetails: async (days, specialRequests) => {
    const { tripId } = get();
    if (!tripId || days < 1) return;
    const trip = await withToast(() => api.setTripDetails(tripId, days, specialRequests));
    set(applyTrip(trip));
  },

  draftRoute: async () => {
    const { tripId } = get();
    if (!tripId) return;
    set({ routeLoading: true });
    try {
      const trip = await withToast(() => api.draftRoute(tripId));
      set({ ...applyTrip(trip), routeLoading: false });
    } catch (err) {
      set({ routeLoading: false });
      throw err;
    }
  },

  addRouteStop: async (name) => {
    const { tripId } = get();
    if (!tripId || !name.trim()) return;
    const trip = await withToast(() => api.addRouteStop(tripId, name.trim()));
    set(applyTrip(trip));
  },

  removeRouteStop: async (id) => {
    const { tripId } = get();
    if (!tripId) return;
    const trip = await withToast(() => api.removeRouteStop(tripId, id));
    set(applyTrip(trip));
  },

  moveRouteStop: async (id, dir) => {
    const { tripId } = get();
    if (!tripId) return;
    const trip = await withToast(() => api.moveRouteStop(tripId, id, dir));
    set(applyTrip(trip));
  },

  discoverOptions: async () => {
    const { tripId } = get();
    if (!tripId) return;
    set({ discoverLoading: true });
    try {
      const raw = await withToast(() => api.discoverOptions(tripId));
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
    const trip = await withToast(() => api.addItineraryItem(tripId, s.type, s.title, s.cost, 'agent'));
    set(applyTrip(trip));
  },

  addManualItem: async (title, type, cost) => {
    const { tripId } = get();
    if (!tripId || !title.trim()) return;
    const trip = await withToast(() => api.addItineraryItem(tripId, type, title.trim(), cost, 'manual'));
    set(applyTrip(trip));
  },

  removeItem: async (id) => {
    const { tripId } = get();
    if (!tripId) return;
    const trip = await withToast(() => api.removeItineraryItem(tripId, id));
    set(applyTrip(trip));
  },

  setItemSlot: async (id, day, slot) => {
    const { tripId } = get();
    if (!tripId) return;
    const trip = await withToast(() => api.updateItineraryItem(tripId, id, { day_index: day, slot }));
    set(applyTrip(trip));
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
    const trip = await withToast(() => api.setAutonomy(tripId, level));
    set(applyTrip(trip));
  },

  runBooking: async () => {
    const { tripId, autonomyLevel } = get();
    if (!tripId || autonomyLevel === 'draft_only') return;
    set({ bookingRunning: true });
    try {
      const trip = await withToast(() => api.runBooking(tripId));
      set({ ...applyTrip(trip), bookingRunning: false });
    } catch (err) {
      set({ bookingRunning: false });
      throw err;
    }
  },

  approveItem: async (id) => {
    const { tripId } = get();
    if (!tripId) return;
    const trip = await withToast(() => api.approveItem(tripId, id));
    set(applyTrip(trip));
  },

  submitChangeRequest: async (text) => {
    const { tripId } = get();
    if (!tripId || !text.trim()) return;
    const trip = await withToast(() => api.submitChangeRequest(tripId, text.trim()));
    set(applyTrip(trip));
  },

  resolveActiveChange: () => set({ activeChangeRequest: null }),

  completeTrip: async () => {
    const { tripId } = get();
    if (!tripId) return;
    const trip = await withToast(() => api.completeTrip(tripId));
    set(applyTrip(trip));
  },

  reset: () => {
    setActiveTripId(null);
    set({ ...initialState });
  },
}));
