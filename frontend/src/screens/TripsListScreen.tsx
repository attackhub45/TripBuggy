import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getActiveTripId, setActiveTripId, type ApiTripSummary } from '../api/client';
import { useTripStore } from '../state/tripStore';
import { useToastStore } from '../state/toastStore';
import { friendlyMessage } from '../lib/errors';

const STATUS_LABEL: Record<string, string> = {
  intake: 'Just started',
  planning: 'Planning',
  booking: 'Booking',
  on_the_road: 'On the road',
  complete: 'Complete',
};

const STATUS_ROUTE: Record<string, string> = {
  intake: '/flow',
  planning: '/route',
  booking: '/booking',
  on_the_road: '/road',
  complete: '/recap',
};

export function TripsListScreen() {
  const navigate = useNavigate();
  const loadTrip = useTripStore((s) => s.loadTrip);
  const startFromTemplate = useTripStore((s) => s.startFromTemplate);
  const [trips, setTrips] = useState<ApiTripSummary[] | null>(null);
  const [templates, setTemplates] = useState<ApiTripSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const pushToast = useToastStore((s) => s.pushToast);

  const fetchedRef = useRef(false);
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    api.listTrips().then(setTrips).catch(() => setError('Could not load your trips.'));
    api.listTemplates().then(setTemplates).catch(() => {
      // non-critical — the page still works with just the trips list
    });
  }, []);

  async function open(trip: ApiTripSummary) {
    setOpeningId(trip.id);
    try {
      await loadTrip(trip.id);
      navigate(STATUS_ROUTE[trip.status] ?? '/route');
    } catch {
      setError('Could not open that trip.');
      setOpeningId(null);
    }
  }

  async function useTemplate(templateId: string) {
    setOpeningId(templateId);
    try {
      await startFromTemplate(templateId);
      navigate('/summary');
    } catch (err) {
      pushToast(friendlyMessage(err));
      setOpeningId(null);
    }
  }

  async function deleteTrip(tripId: string) {
    setDeletingId(tripId);
    try {
      await api.deleteTrip(tripId);
      setTrips((prev) => prev?.filter((t) => t.id !== tripId) ?? prev);
      setTemplates((prev) => prev?.filter((t) => t.id !== tripId) ?? prev);
      if (getActiveTripId() === tripId) setActiveTripId(null);
    } catch (err) {
      pushToast(friendlyMessage(err));
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  }

  return (
    <div className="screen-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <p className="mono-label" style={{ marginBottom: 6 }}>My trips</p>
        <h2 style={{ fontSize: 28 }}>Trips you own or were invited to</h2>
      </div>

      {error && <div className="banner warn">{error}</div>}

      {trips === null && !error && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[0, 1].map((i) => <div key={i} className="card" style={{ height: 60, opacity: 0.5 - i * 0.1 }} />)}
        </div>
      )}

      {trips && trips.length === 0 && (
        <div className="card" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ color: 'var(--text-muted)' }}>No trips yet.</p>
          <button className="btn-primary" style={{ alignSelf: 'center' }} onClick={() => navigate('/')}>Plan a trip</button>
        </div>
      )}

      {trips && trips.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {trips.map((trip) => (
            <div key={trip.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1px solid var(--border)' }}>
              <button
                onClick={() => void open(trip)}
                disabled={openingId !== null || confirmDeleteId === trip.id}
                style={{
                  all: 'unset', flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12,
                  textAlign: 'left', cursor: 'pointer',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600 }}>{trip.destination_raw}</p>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {STATUS_LABEL[trip.status] ?? trip.status}{trip.days ? ` · ${trip.days} day${trip.days === 1 ? '' : 's'}` : ''}
                  </p>
                </div>
                {trip.my_role !== 'owner' && <span className="tag">{trip.my_role}</span>}
                <span className="mono-label">{openingId === trip.id ? 'Opening…' : '→'}</span>
              </button>
              {trip.my_role === 'owner' && (
                confirmDeleteId === trip.id ? (
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button className="btn-secondary" style={{ padding: '6px 14px', fontSize: 13 }} disabled={deletingId === trip.id} onClick={() => void deleteTrip(trip.id)}>
                      {deletingId === trip.id ? 'Deleting…' : 'Delete'}
                    </button>
                    <button className="btn-text" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                  </div>
                ) : (
                  <button className="icon-btn" aria-label="Delete trip" style={{ flexShrink: 0 }} onClick={() => setConfirmDeleteId(trip.id)}>×</button>
                )
              )}
            </div>
          ))}
        </div>
      )}

      {templates && templates.length > 0 && (
        <>
          <div>
            <p className="mono-label" style={{ marginBottom: 6 }}>Templates</p>
            <h2 style={{ fontSize: 22 }}>Start a new trip from a saved plan</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {templates.map((template) => (
              <div key={template.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1px solid var(--border)' }}>
                <button
                  onClick={() => void useTemplate(template.id)}
                  disabled={openingId !== null || confirmDeleteId === template.id}
                  style={{
                    all: 'unset', flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12,
                    textAlign: 'left', cursor: 'pointer',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600 }}>{template.destination_raw}</p>
                    {template.days && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{template.days} day{template.days === 1 ? '' : 's'}</p>}
                  </div>
                  <span className="mono-label">{openingId === template.id ? 'Starting…' : 'Use →'}</span>
                </button>
                {confirmDeleteId === template.id ? (
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button className="btn-secondary" style={{ padding: '6px 14px', fontSize: 13 }} disabled={deletingId === template.id} onClick={() => void deleteTrip(template.id)}>
                      {deletingId === template.id ? 'Deleting…' : 'Delete'}
                    </button>
                    <button className="btn-text" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                  </div>
                ) : (
                  <button className="icon-btn" aria-label="Delete template" style={{ flexShrink: 0 }} onClick={() => setConfirmDeleteId(template.id)}>×</button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
