import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { TopBar } from '../components/TopBar';
import { useTripStore } from '../state/tripStore';

const TYPE_LABEL = { flight: 'Flight', stay: 'Stay', activity: 'Activity' };

export function OnTheRoadScreen() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState('');
  const { items, submitChangeRequest, changeLog, completeTrip } = useTripStore(useShallow((s) => ({
    items: s.items, submitChangeRequest: s.submitChangeRequest, changeLog: s.changeLog, completeTrip: s.completeTrip,
  })));

  const days = Array.from(new Set(items.map((i) => i.day))).sort((a, b) => a - b);

  function submit() {
    if (!prompt.trim()) return;
    submitChangeRequest(prompt);
    setPrompt('');
    navigate('/booking');
  }

  return (
    <div className="screen-enter" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <TopBar back="/booking" />
      <div>
        <p className="mono-label" style={{ marginBottom: 6 }}>On the road</p>
        <h2 style={{ fontSize: 28 }}>Live view, check-ins, agent-assisted changes</h2>
      </div>

      {days.map((day) => (
        <div key={day} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p className="mono-label">Day {day}</p>
          {items.filter((i) => i.day === day).map((item) => (
            <div key={item.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="tag">{TYPE_LABEL[item.type]}</span>
              <p style={{ flex: 1, fontWeight: 600 }}>{item.title}</p>
              <span className="mono-label" style={{ textTransform: 'capitalize' }}>{item.slot}</span>
            </div>
          ))}
        </div>
      ))}

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p className="mono-label">Need something changed?</p>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. my flight got delayed 4 hours, I'll miss the evening activity"
          rows={3}
          style={{ resize: 'vertical', border: '1px solid var(--border)', borderRadius: 12, padding: 12, background: 'var(--surface)', color: 'var(--text)', font: 'inherit', fontSize: 14 }}
        />
        <button className="btn-secondary" style={{ alignSelf: 'flex-end' }} onClick={submit} disabled={!prompt.trim()}>
          Tell the agent
        </button>
        {changeLog.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
            <p className="mono-label">Past requests</p>
            {changeLog.map((c) => <p key={c.id} style={{ fontSize: 13, color: 'var(--text-muted)' }}>"{c.text}"</p>)}
          </div>
        )}
      </div>

      <button className="btn-primary" style={{ alignSelf: 'center' }} onClick={() => { void completeTrip().then(() => navigate('/recap')); }}>
        End trip
      </button>
    </div>
  );
}
