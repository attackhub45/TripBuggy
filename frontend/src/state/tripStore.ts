import { create } from 'zustand';
import { matchDestination, DESTINATIONS, type DestinationKey } from '../art/DestinationArt';
import type {
  IntakeAnswers, RouteStop, ItineraryItem, CrewMember, ChangeRequest,
  AutonomyLevel, ItemType, Slot,
} from './types';

// ---------------------------------------------------------------------------
// This store simulates everything the TRD assigns to the backend agent
// (route drafting, catalog search, booking, change handling). Each action
// below is the exact seam the TRD marks for a real API/agent call later —
// see docs/TRD.md §5. Nothing here talks to a network.
// ---------------------------------------------------------------------------

const BUDGET_CAPS: Record<string, number> = {
  'Budget-friendly': 1200,
  Balanced: 2800,
  'Treat yourself': 6000,
};

const ACTIVITY_POOL: Record<DestinationKey, string[]> = {
  paris: ['Louvre skip-the-line tour', 'Seine river cruise at dusk', 'Pastry-making class in Le Marais'],
  tokyo: ['Tsukiji Outer Market food crawl', 'teamLab digital art museum', 'Evening in Shibuya'],
  newyork: ['Top of the Rock at sunset', 'Broadway show', 'High Line walk + Chelsea Market'],
  rome: ['Colosseum underground tour', 'Trastevere food crawl', 'Vatican Museums early entry'],
  santorini: ['Caldera sunset sail', 'Oia village wander', 'Volcanic wine tasting'],
  bali: ['Ubud rice terrace trek', 'Sunrise at Mount Batur', 'Uluwatu temple + kecak dance'],
  iceland: ['Golden Circle day trip', 'Blue Lagoon soak', 'Northern lights hunt'],
  dubai: ['Desert safari + BBQ dinner', 'Burj Khalifa observation deck', 'Old Dubai souk crawl'],
  fallback: ['Scenic overlook drive', 'Local food market crawl', 'Sunset lookout point'],
};

function destName(destKey: DestinationKey, raw: string): string {
  if (destKey === 'fallback') return raw || 'your destination';
  return DESTINATIONS[destKey].name;
}

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

const SLOTS: Slot[] = ['morning', 'afternoon', 'evening'];

interface TripState {
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
  startTrip: (raw: string) => void;
  answerQuestion: (key: keyof IntakeAnswers, value: string) => void;
  addCrew: (email: string, role: CrewMember['role']) => void;
  setInternational: (v: boolean) => void;

  draftRoute: () => Promise<void>;
  addRouteStop: (name: string) => void;
  removeRouteStop: (id: string) => void;
  moveRouteStop: (id: string, dir: -1 | 1) => void;

  discoverOptions: () => Promise<void>;
  addSuggestionToItinerary: (suggestionId: string) => void;
  addManualItem: (title: string, type: ItemType, cost: number) => void;
  removeItem: (id: string) => void;
  setItemSlot: (id: string, day: number, slot: Slot) => void;

  budgetCap: () => number;
  budgetTotal: () => number;
  isOverBudget: () => boolean;
  hasConflicts: () => boolean;

  setAutonomy: (level: AutonomyLevel) => void;
  runBooking: () => Promise<void>;
  approveItem: (id: string) => void;

  submitChangeRequest: (text: string) => void;
  resolveActiveChange: () => void;

  reset: () => void;
}

const initialState = {
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

export const useTripStore = create<TripState>((set, get) => ({
  ...initialState,

  startTrip: (raw) => {
    set({
      ...initialState,
      destinationRaw: raw,
      destKey: matchDestination(raw),
    });
  },

  answerQuestion: (key, value) => {
    set((s) => ({
      answers: { ...s.answers, [key]: value },
      answeredOrder: s.answeredOrder.includes(key) ? s.answeredOrder : [...s.answeredOrder, key],
    }));
  },

  addCrew: (email, role) => {
    if (!email.trim()) return;
    set((s) => ({ crew: [...s.crew, { id: uid('crew'), email: email.trim(), role }] }));
  },

  setInternational: (v) => set({ isInternational: v }),

  draftRoute: async () => {
    set({ routeLoading: true });
    await new Promise((r) => setTimeout(r, 900));
    const { destKey, destinationRaw } = get();
    const name = destName(destKey, destinationRaw);
    const stops: RouteStop[] = [
      { id: uid('stop'), name: `Arrive in ${name}`, notes: 'Settle in, get oriented' },
      { id: uid('stop'), name: `Explore ${name}'s center`, notes: 'Walkable highlights, no fixed plan' },
      { id: uid('stop'), name: `Day trip beyond ${name}`, notes: 'Something outside the city center' },
      { id: uid('stop'), name: `Depart from ${name}`, notes: 'Buffer time before departure' },
    ];
    set({ routeStops: stops, routeLoading: false });
  },

  addRouteStop: (name) => {
    if (!name.trim()) return;
    set((s) => ({ routeStops: [...s.routeStops, { id: uid('stop'), name: name.trim(), notes: 'Added manually' }] }));
  },
  removeRouteStop: (id) => set((s) => ({ routeStops: s.routeStops.filter((r) => r.id !== id) })),
  moveRouteStop: (id, dir) => {
    set((s) => {
      const stops = [...s.routeStops];
      const i = stops.findIndex((r) => r.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= stops.length) return s;
      [stops[i], stops[j]] = [stops[j], stops[i]];
      return { routeStops: stops };
    });
  },

  discoverOptions: async () => {
    set({ discoverLoading: true });
    await new Promise((r) => setTimeout(r, 900));
    const { destKey, destinationRaw } = get();
    const name = destName(destKey, destinationRaw);
    const activities = ACTIVITY_POOL[destKey];
    const suggestions: ItineraryItem[] = [
      { id: uid('sug'), type: 'flight', title: `Flight to ${name}`, cost: 420, day: 1, slot: 'morning', status: 'proposed', source: 'agent' },
      { id: uid('sug'), type: 'stay', title: `Boutique stay near the center of ${name}`, cost: 640, day: 1, slot: 'afternoon', status: 'proposed', source: 'agent' },
      { id: uid('sug'), type: 'activity', title: activities[0], cost: 85, day: 2, slot: 'morning', status: 'proposed', source: 'agent' },
      { id: uid('sug'), type: 'activity', title: activities[1], cost: 60, day: 2, slot: 'afternoon', status: 'proposed', source: 'agent' },
      { id: uid('sug'), type: 'activity', title: activities[2], cost: 110, day: 3, slot: 'morning', status: 'proposed', source: 'agent' },
      { id: uid('sug'), type: 'flight', title: `Flight home from ${name}`, cost: 390, day: 3, slot: 'evening', status: 'proposed', source: 'agent' },
    ];
    set({ suggestions, discoverLoading: false });
  },

  addSuggestionToItinerary: (suggestionId) => {
    const s = get().suggestions.find((x) => x.id === suggestionId);
    if (!s) return;
    const count = get().items.length;
    const day = Math.floor(count / 3) + 1;
    const slot = SLOTS[count % 3];
    set((state) => ({
      items: [...state.items, { ...s, id: uid('item'), day, slot }],
    }));
  },

  addManualItem: (title, type, cost) => {
    if (!title.trim()) return;
    const count = get().items.length;
    const day = Math.floor(count / 3) + 1;
    const slot = SLOTS[count % 3];
    set((s) => ({
      items: [...s.items, { id: uid('item'), type, title: title.trim(), cost, day, slot, status: 'proposed', source: 'manual' }],
    }));
  },

  removeItem: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),

  setItemSlot: (id, day, slot) => {
    set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, day, slot } : i)) }));
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

  setAutonomy: (level) => set({ autonomyLevel: level }),

  runBooking: async () => {
    const level = get().autonomyLevel;
    if (level === 'draft_only') return; // nothing to run — items stay proposed for the customer to book themselves
    set({ bookingRunning: true });
    await new Promise((r) => setTimeout(r, 900));
    if (level === 'full_auto') {
      set((s) => ({
        items: s.items.map((i) => (i.status !== 'simulated_booked' ? { ...i, status: 'simulated_booked', autonomyAtBooking: 'full_auto' } : i)),
        bookingRunning: false,
      }));
    } else {
      set((s) => ({
        items: s.items.map((i) => (i.status === 'proposed' ? { ...i, status: 'pending_approval' } : i)),
        bookingRunning: false,
      }));
    }
    if (get().activeChangeRequest) get().resolveActiveChange();
  },

  approveItem: (id) => {
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, status: 'simulated_booked', autonomyAtBooking: 'approve_each' } : i)),
    }));
    const stillPending = get().items.some((i) => i.status === 'pending_approval');
    if (!stillPending && get().activeChangeRequest) get().resolveActiveChange();
  },

  submitChangeRequest: (text) => {
    if (!text.trim()) return;
    const booked = get().items.filter((i) => i.status === 'simulated_booked');
    const target = booked[Math.floor(Math.random() * booked.length)] ?? null;
    const req: ChangeRequest = { id: uid('chg'), text: text.trim(), affectedItemId: target?.id ?? null, createdAt: Date.now() };
    set((s) => ({
      activeChangeRequest: req,
      changeLog: [...s.changeLog, req],
      items: target ? s.items.map((i) => (i.id === target.id ? { ...i, status: 'pending_approval' } : i)) : s.items,
    }));
  },

  resolveActiveChange: () => set({ activeChangeRequest: null }),

  reset: () => set({ ...initialState }),
}));
