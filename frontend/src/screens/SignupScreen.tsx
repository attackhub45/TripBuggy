import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogoMark } from '../components/icons';
import { useAuthStore } from '../state/authStore';
import { useTripStore } from '../state/tripStore';

export function SignupScreen() {
  const navigate = useNavigate();
  const signup = useAuthStore((s) => s.signup);
  const resetTrip = useTripStore((s) => s.reset);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!email.trim() || password.length < 6) {
      setError(password.length < 6 ? 'Password needs at least 6 characters.' : 'Enter an email.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await signup(email.trim(), password, displayName.trim() || undefined);
      resetTrip();
      navigate('/trips');
    } catch {
      setError('Could not create that account — the email may already be registered.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="screen-enter" style={{ minHeight: '55vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28 }}>
      <div className="mark">
        <LogoMark />
        <span>Trip<b>Buggy</b></span>
      </div>
      <form
        style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 14 }}
        onSubmit={(e) => { e.preventDefault(); void submit(); }}
      >
        <h2 style={{ fontSize: 24, textAlign: 'center' }}>Create an account</h2>
        <div className="pill-input">
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Name (optional)" autoFocus />
        </div>
        <div className="pill-input">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" />
        </div>
        <div className="pill-input">
          <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (6+ characters)" type="password" />
        </div>
        {error && <p className="mono-label" style={{ color: 'var(--danger)', textTransform: 'none', letterSpacing: 0 }}>{error}</p>}
        <button type="submit" className="btn-primary" disabled={submitting} style={{ alignSelf: 'center' }}>
          {submitting ? 'Creating…' : 'Create account'}
        </button>
        <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-muted)' }}>
          Already have one? <Link to="/login" style={{ color: 'var(--accent)' }}>Sign in</Link>
        </p>
      </form>
    </div>
  );
}
