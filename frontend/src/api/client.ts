const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
const TOKEN_KEY = 'tripbuggy_token';
const ACTIVE_TRIP_KEY = 'tripbuggy_active_trip';

export function getActiveTripId(): string | null {
  return localStorage.getItem(ACTIVE_TRIP_KEY);
}

export function setActiveTripId(tripId: string | null): void {
  if (tripId) localStorage.setItem(ACTIVE_TRIP_KEY, tripId);
  else localStorage.removeItem(ACTIVE_TRIP_KEY);
}

let cachedToken: string | null = null;

function getToken(): string | null {
  if (cachedToken) return cachedToken;
  cachedToken = localStorage.getItem(TOKEN_KEY);
  return cachedToken;
}

function setToken(token: string) {
  cachedToken = token;
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  cachedToken = null;
  localStorage.removeItem(TOKEN_KEY);
}

export class AuthError extends Error {}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (res.status === 401) {
    // The stored token is stale (e.g. its user no longer exists) — drop it so the next
    // ensureAuthenticated() call re-provisions instead of retrying with the same bad token.
    clearToken();
    throw new AuthError(`${res.status} ${path}`);
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${path}: ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export function logout(): void {
  clearToken();
  localStorage.removeItem(ACTIVE_TRIP_KEY);
}

export interface ApiUser { id: string; email: string; display_name: string | null }

export const auth = {
  me: () => request<ApiUser>('/api/v1/auth/me'),

  async signup(email: string, password: string, displayName?: string): Promise<ApiUser> {
    const { access_token } = await request<{ access_token: string }>('/api/v1/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, display_name: displayName || null }),
    });
    setToken(access_token);
    return auth.me();
  },

  async login(email: string, password: string): Promise<ApiUser> {
    const { access_token } = await request<{ access_token: string }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setToken(access_token);
    return auth.me();
  },
};

/**
 * Until the customer chooses to sign in or create a real account, each browser gets a
 * silent, persistent device account, so trips still save across sessions without putting
 * a form in front of the one-input intake the BRD calls for. Calling auth.login/signup
 * later just replaces this token with a real one — see AuthContext.
 */
export async function ensureAuthenticated(): Promise<void> {
  if (getToken()) return;
  const deviceId = crypto.randomUUID();
  const email = `device-${deviceId}@tripbuggy-device.com`;
  const password = deviceId;
  try {
    await auth.signup(email, password);
  } catch (err) {
    throw new Error(`Could not create a session with the backend at ${BASE_URL}: ${(err as Error).message}`);
  }
}

// ---- Trip API — mirrors backend/app/routers/trips.py ----

export interface ApiCrewMember { id: string; email: string; role: string }
export interface ApiRouteStop { id: string; order_index: number; name: string; notes: string | null }
export interface ApiItineraryItem {
  id: string; item_type: string; title: string; cost_estimate: number;
  day_index: number; slot: string; status: string; source: string; autonomy_at_booking: string | null;
}
export interface ApiChangeRequest {
  id: string; prompt_text: string; affected_item_id: string | null; resolved: boolean; created_at: string;
}
export interface ApiTrip {
  id: string; destination_raw: string; destination_key: string; status: string;
  when_answer: string | null; who_answer: string | null; budget_answer: string | null; pace_answer: string | null;
  is_international: boolean; autonomy_level: string;
  days: number | null; special_requests: string | null;
  my_role: string;
  crew: ApiCrewMember[]; route_stops: ApiRouteStop[]; items: ApiItineraryItem[]; change_requests: ApiChangeRequest[];
}
export interface ApiTripSummary {
  id: string; destination_raw: string; destination_key: string; status: string;
  days: number | null; my_role: string; created_at: string;
}
export interface ApiDiscoverySuggestion { item_type: string; title: string; cost_estimate: number }
export interface ApiBudget { total: number; cap: number; over_budget: boolean }

export const api = {
  listTrips: () => request<ApiTripSummary[]>('/api/v1/trips'),

  createTrip: (destination: string) =>
    request<ApiTrip>('/api/v1/trips', { method: 'POST', body: JSON.stringify({ destination }) }),

  getTrip: (tripId: string) => request<ApiTrip>(`/api/v1/trips/${tripId}`),

  submitIntakeAnswer: (tripId: string, questionKey: string, answerValue: string) =>
    request<ApiTrip>(`/api/v1/trips/${tripId}/intake-answers`, {
      method: 'POST',
      body: JSON.stringify({ question_key: questionKey, answer_value: answerValue }),
    }),

  addCrew: (tripId: string, email: string, role: string) =>
    request<ApiTrip>(`/api/v1/trips/${tripId}/crew`, { method: 'POST', body: JSON.stringify({ email, role }) }),

  setTripDetails: (tripId: string, days: number, specialRequests: string) =>
    request<ApiTrip>(`/api/v1/trips/${tripId}/details`, {
      method: 'PATCH',
      body: JSON.stringify({ days, special_requests: specialRequests || null }),
    }),

  setInternational: (tripId: string, isInternational: boolean) =>
    request<ApiTrip>(`/api/v1/trips/${tripId}/international`, {
      method: 'PATCH',
      body: JSON.stringify({ is_international: isInternational }),
    }),

  draftRoute: (tripId: string) => request<ApiTrip>(`/api/v1/trips/${tripId}/route`, { method: 'POST' }),

  addRouteStop: (tripId: string, name: string, notes?: string) =>
    request<ApiTrip>(`/api/v1/trips/${tripId}/route/stops`, { method: 'POST', body: JSON.stringify({ name, notes }) }),

  removeRouteStop: (tripId: string, stopId: string) =>
    request<ApiTrip>(`/api/v1/trips/${tripId}/route/stops/${stopId}`, { method: 'DELETE' }),

  moveRouteStop: (tripId: string, stopId: string, direction: -1 | 1) =>
    request<ApiTrip>(`/api/v1/trips/${tripId}/route/stops/${stopId}/move`, {
      method: 'POST',
      body: JSON.stringify({ direction }),
    }),

  discoverOptions: (tripId: string) =>
    request<ApiDiscoverySuggestion[]>(`/api/v1/trips/${tripId}/discover`, { method: 'POST' }),

  addItineraryItem: (tripId: string, itemType: string, title: string, costEstimate: number, source: string) =>
    request<ApiTrip>(`/api/v1/trips/${tripId}/itinerary-items`, {
      method: 'POST',
      body: JSON.stringify({ item_type: itemType, title, cost_estimate: costEstimate, source }),
    }),

  updateItineraryItem: (tripId: string, itemId: string, patch: { day_index?: number; slot?: string; status?: string }) =>
    request<ApiTrip>(`/api/v1/trips/${tripId}/itinerary-items/${itemId}`, { method: 'PATCH', body: JSON.stringify(patch) }),

  removeItineraryItem: (tripId: string, itemId: string) =>
    request<ApiTrip>(`/api/v1/trips/${tripId}/itinerary-items/${itemId}`, { method: 'DELETE' }),

  getBudget: (tripId: string) => request<ApiBudget>(`/api/v1/trips/${tripId}/budget`),

  setAutonomy: (tripId: string, autonomyLevel: string) =>
    request<ApiTrip>(`/api/v1/trips/${tripId}/autonomy`, { method: 'PATCH', body: JSON.stringify({ autonomy_level: autonomyLevel }) }),

  runBooking: (tripId: string) => request<ApiTrip>(`/api/v1/trips/${tripId}/book`, { method: 'POST' }),

  approveItem: (tripId: string, itemId: string) =>
    request<ApiTrip>(`/api/v1/trips/${tripId}/itinerary-items/${itemId}/approve`, { method: 'POST' }),

  submitChangeRequest: (tripId: string, promptText: string) =>
    request<ApiTrip>(`/api/v1/trips/${tripId}/change-requests`, { method: 'POST', body: JSON.stringify({ prompt_text: promptText }) }),

  completeTrip: (tripId: string) => request<ApiTrip>(`/api/v1/trips/${tripId}/complete`, { method: 'POST' }),

  deleteTrip: (tripId: string) => request<void>(`/api/v1/trips/${tripId}`, { method: 'DELETE' }),

  listTemplates: () => request<ApiTripSummary[]>('/api/v1/trips/templates'),

  saveAsTemplate: (tripId: string) =>
    request<ApiTripSummary>(`/api/v1/trips/${tripId}/save-as-template`, { method: 'POST' }),

  createTripFromTemplate: (templateId: string) =>
    request<ApiTrip>(`/api/v1/trips/from-template/${templateId}`, { method: 'POST' }),
};

export const assistant = {
  ask: (question: string, screen: string, tripId: string | null) =>
    request<{ answer: string }>('/api/v1/assistant/ask', {
      method: 'POST',
      body: JSON.stringify({ question, screen, trip_id: tripId }),
    }),
};
