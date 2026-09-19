import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { TopBar } from '../components/TopBar';
import { AgentMessage } from '../components/AgentMessage';
import { useTripStore } from '../state/tripStore';
import type { ItemType } from '../state/types';

const TYPE_LABEL: Record<ItemType, string> = { flight: 'Flight', stay: 'Stay', activity: 'Activity' };

export function DiscoverScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const cameFromBudgetLoop = (location.state as { fromBudgetLoop?: boolean } | null)?.fromBudgetLoop;
  const [manualTitle, setManualTitle] = useState('');
  const [manualType, setManualType] = useState<ItemType>('activity');
  const [manualCost, setManualCost] = useState('');

  const {
    suggestions, discoverLoading, discoverOptions, items, addSuggestionToItinerary, addManualItem, destinationRaw,
  } = useTripStore(useShallow((s) => ({
    suggestions: s.suggestions, discoverLoading: s.discoverLoading, discoverOptions: s.discoverOptions,
    items: s.items, addSuggestionToItinerary: s.addSuggestionToItinerary, addManualItem: s.addManualItem,
    destinationRaw: s.destinationRaw,
  })));

  const discoveredRef = useRef(false);
  useEffect(() => {
    // Same StrictMode double-invocation guard as RouteScreen — see the comment there.
    if (discoveredRef.current) return;
    if (suggestions.length === 0 && !discoverLoading) {
      discoveredRef.current = true;
      discoverOptions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addedTitles = new Set(items.map((i) => i.title));

  return (
    <div className="screen-enter" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <TopBar back="/route" />
      <div>
        <p className="mono-label" style={{ marginBottom: 6 }}>Discover &amp; add</p>
      </div>

      <AgentMessage thinking={discoverLoading}>
        {discoverLoading
          ? `Looking for flights, stays, and activities in ${destinationRaw}…`
          : `Here's what I found for ${destinationRaw} — add anything you like.`}
      </AgentMessage>

      {cameFromBudgetLoop && (
        <div className="banner warn">Over budget — swap or remove an item, then head back to the itinerary.</div>
      )}

      {discoverLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[0, 1, 2].map((i) => <div key={i} className="card" style={{ height: 64, opacity: 0.5 - i * 0.1 }} />)}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {suggestions.map((s) => {
            const added = addedTitles.has(s.title);
            return (
              <div key={s.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="tag">{TYPE_LABEL[s.type]}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600 }}>{s.title}</p>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>${s.cost}</p>
                </div>
                <button className="btn-secondary" data-testid="add-suggestion" disabled={added} onClick={() => addSuggestionToItinerary(s.id)}>
                  {added ? 'Added' : 'Add'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p className="mono-label">Manual entry <span style={{ textTransform: 'none', letterSpacing: 0 }}>— optional, for when you're offline or the agent has nothing to suggest</span></p>
        <form
          style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}
          onSubmit={(e) => {
            e.preventDefault();
            addManualItem(manualTitle, manualType, Number(manualCost) || 0);
            setManualTitle(''); setManualCost('');
          }}
        >
          <div className="pill-input" style={{ padding: '8px 14px', flex: '1 1 200px' }}>
            <input value={manualTitle} onChange={(e) => setManualTitle(e.target.value)} placeholder="What is it?" />
          </div>
          <select value={manualType} onChange={(e) => setManualType(e.target.value as ItemType)} style={{ borderRadius: 999, border: '1px solid var(--border)', padding: '0 12px', background: 'var(--surface)', color: 'var(--text)' }}>
            <option value="flight">Flight</option>
            <option value="stay">Stay</option>
            <option value="activity">Activity</option>
          </select>
          <div className="pill-input" style={{ padding: '8px 14px', width: 100 }}>
            <input value={manualCost} onChange={(e) => setManualCost(e.target.value)} placeholder="$" inputMode="numeric" />
          </div>
          <button type="submit" className="btn-secondary" data-testid="add-manual-item">Add</button>
        </form>
      </div>

      <button className="btn-primary" style={{ alignSelf: 'center' }} disabled={items.length === 0} onClick={() => navigate('/itinerary')}>
        Build itinerary
      </button>
    </div>
  );
}
