import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogoMark } from '../components/icons';
import { useAuthStore } from '../state/authStore';
import { useTripStore } from '../state/tripStore';

export function LoginScreen() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const resetTrip = useTripStore((s) => s.reset);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!email.trim() || !password) return;
    setSubmitting(true);
    setError(null);
    try {
      await login(email.trim(), password);
      resetTrip(); // any trip loaded under a device/other account no longer applies
      navigate('/trips');
    } catch {
      setError('Wrong email or password.');
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
        <h2 style={{ fontSize: 24, textAlign: 'center' }}>Sign in</h2>
        <div className="pill-input">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" autoFocus />
        </div>
        <div className="pill-input">
          <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" />
        </div>
        {error && <p className="mono-label" style={{ color: 'var(--danger)', textTransform: 'none', letterSpacing: 0 }}>{error}</p>}
        <button type="submit" className="btn-primary" disabled={submitting} style={{ alignSelf: 'center' }}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
        <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-muted)' }}>
          New here? <Link to="/signup" style={{ color: 'var(--accent)' }}>Create an account</Link>
        </p>
      </form>
    </div>
  );
}
