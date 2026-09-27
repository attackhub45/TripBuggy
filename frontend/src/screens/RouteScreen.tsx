import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { TopBar } from '../components/TopBar';
import { AgentMessage } from '../components/AgentMessage';
import { GripIcon } from '../components/icons';
import { useTripStore } from '../state/tripStore';

export function RouteScreen() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState('');
  const {
    routeStops, routeLoading, draftRoute, addRouteStop, removeRouteStop, moveRouteStop, reorderRouteStops,
    destinationRaw, myRole, suggestions, discoverLoading, discoverOptions,
  } = useTripStore(useShallow((s) => ({
    routeStops: s.routeStops, routeLoading: s.routeLoading, draftRoute: s.draftRoute,
    addRouteStop: s.addRouteStop, removeRouteStop: s.removeRouteStop, moveRouteStop: s.moveRouteStop,
    reorderRouteStops: s.reorderRouteStops, destinationRaw: s.destinationRaw, myRole: s.myRole,
    suggestions: s.suggestions, discoverLoading: s.discoverLoading, discoverOptions: s.discoverOptions,
  })));
  const readOnly = myRole === 'viewer';

  // Local drag order — mirrors routeStops but reorders live as you drag, before the
  // reorder is committed to the backend on release. Reset whenever the server's order
  // changes (a fresh draft, an add/remove, or the commit from a previous drag) so it never
  // drifts. Pointer Events rather than native HTML5 drag-and-drop, deliberately — the
  // native `draggable` attribute has no touch support at all, which would make this
  // unusable on a phone.
  const [order, setOrder] = useState<string[]>([]);
  useEffect(() => {
    setOrder(routeStops.map((s) => s.id));
  }, [routeStops]);
  const draggingIndexRef = useRef<number | null>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const orderedStops = order
    .map((id) => routeStops.find((s) => s.id === id))
    .filter((s): s is (typeof routeStops)[number] => !!s);

  function handlePointerDown(e: React.PointerEvent, index: number) {
    (e.target as Element).setPointerCapture(e.pointerId);
    draggingIndexRef.current = index;
  }

  function handlePointerMove(e: React.PointerEvent) {
    const from = draggingIndexRef.current;
    if (from === null) return;
    const y = e.clientY;
    const to = rowRefs.current.findIndex((el) => {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      return y >= rect.top && y <= rect.bottom;
    });
    if (to === -1 || to === from) return;
    setOrder((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    draggingIndexRef.current = to;
  }

  function handlePointerUp() {
    if (draggingIndexRef.current === null) return;
    draggingIndexRef.current = null;
    if (order.some((id, i) => id !== routeStops[i]?.id)) {
      reorderRouteStops(order);
    }
  }

  const draftedRef = useRef(false);
  useEffect(() => {
    // Guards against React 18 StrictMode's double effect-invocation in dev, which would
    // otherwise fire two concurrent draftRoute() calls and leave duplicate stops behind.
    // Viewers can't trigger a draft anyway (backend 403s), so don't even try — they just
    // see whatever an owner/editor has already drafted.
    if (draftedRef.current || readOnly) return;
    if (routeStops.length === 0 && !routeLoading) {
      draftedRef.current = true;
      draftRoute();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Discover's live web search takes ~90s — prefetching it here, while the customer is
  // still reading/editing their route, means it's often already done by the time they
  // click through. Waits a few seconds first as a soft "they're actually engaged, not
  // bouncing" signal — Discover is a real paid agent call, so an instant fire-on-mount
  // would burn one on every visitor who lands here and immediately leaves. Nothing to
  // clean up beyond the timer itself: if they navigate away first, this unmounts and the
  // timeout is cleared before it ever fires.
  const prefetchScheduledRef = useRef(false);
  useEffect(() => {
    if (prefetchScheduledRef.current || readOnly) return;
    if (routeStops.length === 0 || suggestions.length > 0 || discoverLoading) return;
    prefetchScheduledRef.current = true;
    const timer = setTimeout(() => discoverOptions(), 4000);
    return () => clearTimeout(timer);
  }, [routeStops.length, suggestions.length, discoverLoading, readOnly, discoverOptions]);

  return (
    <div className="screen-enter" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <TopBar back="/summary" />
      <div>
        <p className="mono-label" style={{ marginBottom: 6 }}>Plan the route</p>
        <h2 style={{ fontSize: 28 }}>Agent drafts stops from your answers</h2>
      </div>

      <AgentMessage thinking={routeLoading}>
        {routeLoading
          ? `Drafting a route through ${destinationRaw} from what you told me…`
          : `Here's the route I drafted for ${destinationRaw} — drag a stop to reorder it (or drop it in between two others), remove one, or add your own.`}
      </AgentMessage>

      {routeLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="card" style={{ height: 52, opacity: 0.5 - i * 0.08 }} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {orderedStops.map((stop, i) => (
            <div
              key={stop.id}
              ref={(el) => { rowRefs.current[i] = el; }}
              className="card"
              style={{ display: 'flex', alignItems: 'center', gap: 12 }}
            >
              {!readOnly && (
                <span
                  onPointerDown={(e) => handlePointerDown(e, i)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  className="icon-btn"
                  style={{ cursor: 'grab', touchAction: 'none' }}
                  aria-label={`Drag to reorder ${stop.name}`}
                >
                  <GripIcon width={16} height={16} />
                </span>
              )}
              <span className="tag">{i + 1}</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600 }}>{stop.name}</p>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{stop.notes}</p>
              </div>
              {!readOnly && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="icon-btn" style={{ fontSize: 14 }} aria-label="Move up" disabled={i === 0} onClick={() => moveRouteStop(stop.id, -1)}>↑</button>
                  <button className="icon-btn" style={{ fontSize: 14 }} aria-label="Move down" disabled={i === orderedStops.length - 1} onClick={() => moveRouteStop(stop.id, 1)}>↓</button>
                  <button className="icon-btn" style={{ fontSize: 14 }} aria-label="Remove" onClick={() => removeRouteStop(stop.id)}>×</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!readOnly && (
        <form
          style={{ display: 'flex', gap: 10 }}
          onSubmit={(e) => { e.preventDefault(); addRouteStop(draft); setDraft(''); }}
        >
          <div className="pill-input" style={{ padding: '9px 16px' }}>
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a stop of your own" />
          </div>
          <button type="submit" className="btn-secondary">Add</button>
        </form>
      )}

      <button className="btn-primary" style={{ alignSelf: 'center' }} disabled={routeLoading || routeStops.length === 0} onClick={() => navigate('/discover')}>
        Discover options
      </button>
    </div>
  );
}
