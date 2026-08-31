import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogoMark, PinIcon } from '../components/icons';
import { useTripStore } from '../state/tripStore';
import { DESTINATIONS } from '../art/DestinationArt';

export function HomeScreen() {
  const [value, setValue] = useState('');
  const startTrip = useTripStore((s) => s.startTrip);
  const navigate = useNavigate();

  function go(raw: string) {
    if (!raw.trim()) return;
    startTrip(raw.trim());
    navigate('/flow');
  }

  function surpriseMe() {
    const keys = Object.keys(DESTINATIONS) as (keyof typeof DESTINATIONS)[];
    const pick = keys[Math.floor(Math.random() * keys.length)];
    setValue(DESTINATIONS[pick].name);
    go(DESTINATIONS[pick].name);
  }

  return (
    <div className="screen-enter" style={{ minHeight: '55vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28 }}>
      <div className="mark">
        <LogoMark />
        <span>Trip<b>Buggy</b></span>
      </div>
      <form
        style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}
        onSubmit={(e) => { e.preventDefault(); go(value); }}
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
          <button type="submit" className="btn-primary">Plan my trip</button>
          <button type="button" className="btn-text" onClick={surpriseMe}>Surprise me</button>
        </div>
      </form>
      <p className="mono-label" style={{ textAlign: 'center', maxWidth: '38ch', textTransform: 'none', letterSpacing: 0 }}>
        Tell us where — we'll ask a couple quick questions and build the plan from there.
      </p>
    </div>
  );
}
