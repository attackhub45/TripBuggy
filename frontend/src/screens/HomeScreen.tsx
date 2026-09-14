import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogoMark, PinIcon } from '../components/icons';
import { useTripStore } from '../state/tripStore';
import { DESTINATIONS } from '../art/DestinationArt';

export function HomeScreen() {
  const [value, setValue] = useState('');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startTrip = useTripStore((s) => s.startTrip);
  const navigate = useNavigate();

  async function go(raw: string) {
    if (!raw.trim() || starting) return;
    setStarting(true);
    setError(null);
    try {
      await startTrip(raw.trim());
      navigate('/flow');
    } catch (err) {
      setError('Could not reach the backend — is it running?');
      setStarting(false);
    }
  }

  function surpriseMe() {
    const keys = Object.keys(DESTINATIONS) as (keyof typeof DESTINATIONS)[];
    const pick = keys[Math.floor(Math.random() * keys.length)];
    setValue(DESTINATIONS[pick].name);
    void go(DESTINATIONS[pick].name);
  }

  return (
    <div className="screen-enter" style={{ minHeight: '55vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28 }}>
      <div className="mark">
        <LogoMark />
        <span>Trip<b>Buggy</b></span>
      </div>
      <form
        style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}
        onSubmit={(e) => { e.preventDefault(); void go(value); }}
      >
        <div className="pill-input">
          <PinIcon />
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Where do you want to go?"
            autoComplete="off"
            autoFocus
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <button type="submit" className="btn-primary" disabled={starting}>{starting ? 'Starting…' : 'Plan my trip'}</button>
          <button type="button" className="btn-text" onClick={surpriseMe} disabled={starting}>Surprise me</button>
        </div>
      </form>
      {error ? (
        <p className="mono-label" style={{ textAlign: 'center', color: 'var(--danger)', textTransform: 'none', letterSpacing: 0 }}>{error}</p>
      ) : (
        <p className="mono-label" style={{ textAlign: 'center', maxWidth: '38ch', textTransform: 'none', letterSpacing: 0 }}>
          Tell us where — we'll ask a couple quick questions and build the plan from there.
        </p>
      )}
    </div>
  );
}
