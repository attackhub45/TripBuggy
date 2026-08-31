import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { Scene } from '../art/DestinationArt';
import { useTripStore } from '../state/tripStore';

const TYPE_LABEL = { flight: 'Flight', stay: 'Stay', activity: 'Activity' };

export function RecapScreen() {
  const navigate = useNavigate();
  const [savedAsTemplate, setSavedAsTemplate] = useState(false);
  const { destinationRaw, destKey, items, reset } = useTripStore(useShallow((s) => ({
    destinationRaw: s.destinationRaw, destKey: s.destKey, items: s.items, reset: s.reset,
  })));

  function startOver() {
    reset();
    navigate('/');
  }

  return (
    <div className="screen-enter" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, textAlign: 'center' }}>
      <div style={{ width: '100%', maxWidth: 420, aspectRatio: '320/200', borderRadius: 18, overflow: 'hidden', border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)' }}>
        <Scene destKey={destKey} width={420} height={263} />
      </div>
      <h2 style={{ fontSize: 26 }}>That's a wrap on <span style={{ color: 'var(--accent)' }}>{destinationRaw}</span>.</h2>
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left' }}>
        {items.map((item) => (
          <div key={item.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="tag">{TYPE_LABEL[item.type]}</span>
            <p style={{ flex: 1, fontWeight: 600 }}>{item.title}</p>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', gap: 16 }}>
          <button className="btn-secondary" disabled={savedAsTemplate} onClick={() => setSavedAsTemplate(true)}>
            {savedAsTemplate ? 'Saved as template' : 'Save as template'}
          </button>
          <button className="btn-text" onClick={startOver}>Plan another trip</button>
        </div>
        {savedAsTemplate && <p className="mono-label">You can start a new trip from this one next time.</p>}
      </div>
    </div>
  );
}
