import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogoMark, PinIcon } from '../components/icons';
import { useTripStore } from '../state/tripStore';
import { DESTINATIONS } from '../art/DestinationArt';
import { api, ensureAuthenticated } from '../api/client';

export function HomeScreen() {
  const [value, setValue] = useState('');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingRaw, setPendingRaw] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const startTrip = useTripStore((s) => s.startTrip);
  const navigate = useNavigate();

  async function go(raw: string, opts: { skipVerification?: boolean } = {}) {
    if (!raw.trim() || starting) return;
    setStarting(true);
    setError(null);
    setSuggestions([]);
    let finalName = raw.trim();

    if (!opts.skipVerification) {
      try {
        await ensureAuthenticated();
        const verification = await api.verifyDestination(finalName);
        if (!verification.is_real_place && verification.suggestions.length > 0) {
          setPendingRaw(finalName);
          setSuggestions(verification.suggestions);
          setStarting(false);
          return;
        }
        finalName = verification.corrected_name || finalName;
      } catch {
        // Verification is a nice-to-have — if it's unreachable, just proceed with what they typed.
      }
    }

    try {
      await startTrip(finalName);
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
    // Already a known-real place — skip the round trip to verify it.
    void go(DESTINATIONS[pick].name, { skipVerification: true });
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
            onChange={(e) => { setValue(e.target.value); setSuggestions([]); }}
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
      {suggestions.length > 0 && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 420 }}>
          <p style={{ fontSize: 14 }}>We couldn't recognize "{pendingRaw}" as a place — did you mean:</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {suggestions.map((s) => (
              <button key={s} type="button" className="btn-secondary" onClick={() => void go(s)}>{s}</button>
            ))}
          </div>
          <button type="button" className="btn-text" style={{ alignSelf: 'flex-start' }} onClick={() => void go(pendingRaw, { skipVerification: true })}>
            Use "{pendingRaw}" as typed
          </button>
        </div>
      )}
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
