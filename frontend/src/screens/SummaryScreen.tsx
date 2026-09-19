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
  const [daysError, setDaysError] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const {
    destinationRaw, destKey, answers, crew, addCrew, isInternational, setInternational,
    days, specialRequests, setTripDetails, myRole,
  } = useTripStore(useShallow((s) => ({
    destinationRaw: s.destinationRaw, destKey: s.destKey, answers: s.answers,
    crew: s.crew, addCrew: s.addCrew, isInternational: s.isInternational, setInternational: s.setInternational,
    days: s.days, specialRequests: s.specialRequests, setTripDetails: s.setTripDetails, myRole: s.myRole,
  })));
  const isOwner = myRole === 'owner';
  const readOnly = myRole === 'viewer';
  const [daysInput, setDaysInput] = useState(days ? String(days) : '');
  const [requestsInput, setRequestsInput] = useState(specialRequests);

  const wantsCrew = answers.who && answers.who !== 'Just me';

  async function continueToRoute() {
    if (readOnly) {
      navigate('/route');
      return;
    }
    const parsedDays = parseInt(daysInput, 10);
    if (!Number.isFinite(parsedDays) || parsedDays < 1) {
      setDaysError(true);
      return;
    }
    setDaysError(false);
    setContinuing(true);
    try {
      await setTripDetails(parsedDays, requestsInput.trim());
      navigate('/route');
    } finally {
      setContinuing(false);
    }
  }

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
          {isOwner ? (
            <form
              style={{ display: 'flex', gap: 10 }}
              onSubmit={(e) => { e.preventDefault(); addCrew(email, 'editor'); setEmail(''); }}
            >
              <div className="pill-input" style={{ padding: '9px 16px' }}>
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="friend@email.com" type="email" />
              </div>
              <button type="submit" className="btn-secondary">Add</button>
            </form>
          ) : (
            <p className="mono-label" style={{ textTransform: 'none', letterSpacing: 0 }}>Only the trip owner can invite crew.</p>
          )}
          {crew.length > 0 && (
            <div className="chips">
              {crew.map((c) => <span key={c.id} className="tag">{c.email} · {c.role}</span>)}
            </div>
          )}
        </div>
      )}

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <p className="mono-label" style={{ marginBottom: 6 }}>How many days?</p>
          <div className="pill-input" style={{ padding: '9px 16px', maxWidth: 140, borderColor: daysError ? 'var(--danger)' : undefined }}>
            <input
              value={daysInput}
              onChange={(e) => { setDaysInput(e.target.value); setDaysError(false); }}
              placeholder="e.g. 5"
              inputMode="numeric"
              type="number"
              min={1}
              disabled={readOnly}
            />
          </div>
          {daysError && <p className="mono-label" style={{ color: 'var(--danger)', marginTop: 6 }}>Enter at least 1 day before we plan the route</p>}
        </div>
        <div>
          <p className="mono-label" style={{ marginBottom: 6 }}>Special requests <span style={{ textTransform: 'none', letterSpacing: 0 }}>— optional</span></p>
          <textarea
            value={requestsInput}
            onChange={(e) => setRequestsInput(e.target.value)}
            placeholder="e.g. traveling with a toddler, vegetarian meals, avoid long hikes"
            rows={3}
            disabled={readOnly}
            style={{ width: '100%', resize: 'vertical', border: '1px solid var(--border)', borderRadius: 12, padding: 12, background: 'var(--surface)', color: 'var(--text)', font: 'inherit', fontSize: 14 }}
          />
        </div>
      </div>

      <label className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: readOnly ? 'default' : 'pointer' }}>
        <input type="checkbox" checked={isInternational} onChange={(e) => setInternational(e.target.checked)} disabled={readOnly} />
        <span style={{ fontSize: 14 }}>This is an international trip <span style={{ color: 'var(--text-muted)' }}>— we'll remind you about documents before booking</span></span>
      </label>

      <button className="btn-primary" style={{ alignSelf: 'center' }} onClick={() => void continueToRoute()} disabled={continuing}>
        {continuing ? 'Saving…' : 'See my route'}
      </button>
    </div>
  );
}
