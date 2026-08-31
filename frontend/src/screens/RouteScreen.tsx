import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { TopBar } from '../components/TopBar';
import { useTripStore } from '../state/tripStore';

export function RouteScreen() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState('');
  const {
    routeStops, routeLoading, draftRoute, addRouteStop, removeRouteStop, moveRouteStop,
  } = useTripStore(useShallow((s) => ({
    routeStops: s.routeStops, routeLoading: s.routeLoading, draftRoute: s.draftRoute,
    addRouteStop: s.addRouteStop, removeRouteStop: s.removeRouteStop, moveRouteStop: s.moveRouteStop,
  })));

  useEffect(() => {
    if (routeStops.length === 0 && !routeLoading) draftRoute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="screen-enter" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <TopBar back="/summary" />
      <div>
        <p className="mono-label" style={{ marginBottom: 6 }}>Plan the route</p>
        <h2 style={{ fontSize: 28 }}>Agent drafts stops from your answers</h2>
      </div>

      {routeLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="card" style={{ height: 52, opacity: 0.5 - i * 0.08 }} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {routeStops.map((stop, i) => (
            <div key={stop.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="tag">{i + 1}</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600 }}>{stop.name}</p>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{stop.notes}</p>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="icon-btn" style={{ fontSize: 14 }} aria-label="Move up" disabled={i === 0} onClick={() => moveRouteStop(stop.id, -1)}>↑</button>
                <button className="icon-btn" style={{ fontSize: 14 }} aria-label="Move down" disabled={i === routeStops.length - 1} onClick={() => moveRouteStop(stop.id, 1)}>↓</button>
                <button className="icon-btn" style={{ fontSize: 14 }} aria-label="Remove" onClick={() => removeRouteStop(stop.id)}>×</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <form
        style={{ display: 'flex', gap: 10 }}
        onSubmit={(e) => { e.preventDefault(); addRouteStop(draft); setDraft(''); }}
      >
        <div className="pill-input" style={{ padding: '9px 16px' }}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a stop of your own" />
        </div>
        <button type="submit" className="btn-secondary">Add</button>
      </form>

      <button className="btn-primary" style={{ alignSelf: 'center' }} disabled={routeLoading || routeStops.length === 0} onClick={() => navigate('/discover')}>
        Discover options
      </button>
    </div>
  );
}
