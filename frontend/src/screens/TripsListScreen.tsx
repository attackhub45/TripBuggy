import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type ApiTripSummary } from '../api/client';
import { useTripStore } from '../state/tripStore';

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
  const [trips, setTrips] = useState<ApiTripSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const fetchedRef = useRef(false);
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    api.listTrips().then(setTrips).catch(() => setError('Could not load your trips.'));
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
            <button
              key={trip.id}
              className="card"
              onClick={() => void open(trip)}
              disabled={openingId !== null}
              style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', cursor: 'pointer', border: '1px solid var(--border)', width: '100%' }}
            >
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600 }}>{trip.destination_raw}</p>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {STATUS_LABEL[trip.status] ?? trip.status}{trip.days ? ` · ${trip.days} day${trip.days === 1 ? '' : 's'}` : ''}
                </p>
              </div>
              {trip.my_role !== 'owner' && <span className="tag">{trip.my_role}</span>}
              <span className="mono-label">{openingId === trip.id ? 'Opening…' : '→'}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
