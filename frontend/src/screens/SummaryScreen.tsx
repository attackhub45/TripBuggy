import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { TopBar } from '../components/TopBar';
import { Scene } from '../art/DestinationArt';
import { useTripStore } from '../state/tripStore';
import { QUESTIONS } from '../state/questions';

export function SummaryScreen() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const {
    destinationRaw, destKey, answers, crew, addCrew, isInternational, setInternational,
  } = useTripStore(useShallow((s) => ({
    destinationRaw: s.destinationRaw, destKey: s.destKey, answers: s.answers,
    crew: s.crew, addCrew: s.addCrew, isInternational: s.isInternational, setInternational: s.setInternational,
  })));

  const wantsCrew = answers.who && answers.who !== 'Just me';

  return (
    <div className="screen-enter" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <TopBar back="/flow" />
      <div style={{ width: '100%', maxWidth: 420, aspectRatio: '320/200', borderRadius: 18, overflow: 'hidden', border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)', margin: '0 auto' }}>
        <Scene destKey={destKey} width={420} height={263} />
      </div>
      <h2 style={{ textAlign: 'center', fontSize: 26 }}>
        Got it. Planning your trip to <span style={{ color: 'var(--accent)' }}>{destinationRaw}</span>.
      </h2>
      <div className="chips" style={{ justifyContent: 'center' }}>
        {QUESTIONS.map((q) => answers[q.key] && <span key={q.key} className="tag">{answers[q.key]}</span>)}
      </div>

      {wantsCrew && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p className="mono-label">Invite crew</p>
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Solo and group trips share the same planning engine — this just adds who else can see or edit the trip.</p>
          <form
            style={{ display: 'flex', gap: 10 }}
            onSubmit={(e) => { e.preventDefault(); addCrew(email, 'editor'); setEmail(''); }}
          >
            <div className="pill-input" style={{ padding: '9px 16px' }}>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="friend@email.com" type="email" />
            </div>
            <button type="submit" className="btn-secondary">Add</button>
          </form>
          {crew.length > 0 && (
            <div className="chips">
              {crew.map((c) => <span key={c.id} className="tag">{c.email} · {c.role}</span>)}
            </div>
          )}
        </div>
      )}

      <label className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
        <input type="checkbox" checked={isInternational} onChange={(e) => setInternational(e.target.checked)} />
        <span style={{ fontSize: 14 }}>This is an international trip <span style={{ color: 'var(--text-muted)' }}>— we'll remind you about documents before booking</span></span>
      </label>

      <button className="btn-primary" style={{ alignSelf: 'center' }} onClick={() => navigate('/route')}>
        See my route
      </button>
    </div>
  );
}
