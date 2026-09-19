import { Link, useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore, isDeviceAccount } from '../state/authStore';
import { useTripStore } from '../state/tripStore';

export function AccountBar() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore(useShallow((s) => ({ user: s.user, logout: s.logout })));
  const resetTrip = useTripStore((s) => s.reset);

  const isRealAccount = user && !isDeviceAccount(user.email);

  function signOut() {
    logout();
    resetTrip();
    navigate('/');
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 14, padding: '4px 0 0', width: '100%' }}>
      {isRealAccount ? (
        <>
          <span className="mono-label" style={{ textTransform: 'none', letterSpacing: 0 }}>
            {user.display_name || user.email}
          </span>
          <Link to="/trips" className="mono-label" style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--accent)' }}>My trips</Link>
          <button className="btn-text" style={{ fontSize: 12 }} onClick={signOut}>Sign out</button>
        </>
      ) : (
        <Link to="/login" className="mono-label" style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--accent)' }}>Sign in</Link>
      )}
    </div>
  );
}
