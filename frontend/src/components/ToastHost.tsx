import { useEffect } from 'react';
import { useToastStore } from '../state/toastStore';

const AUTO_DISMISS_MS = 5000;

/** Fixed-position toast stack for errors the store surfaces from failed API calls. Mounted
 * once in App.tsx so it persists across screen navigation. */
export function ToastHost() {
  const { toasts, dismissToast } = useToastStore();

  return (
    <div
      style={{
        position: 'fixed', bottom: 20, left: 0, right: 0, zIndex: 1000,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        pointerEvents: 'none', padding: '0 16px',
      }}
    >
      {toasts.map((t) => <ToastItem key={t.id} id={t.id} kind={t.kind} message={t.message} onDismiss={dismissToast} />)}
    </div>
  );
}

function ToastItem({ id, kind, message, onDismiss }: { id: string; kind: string; message: string; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [id, onDismiss]);

  return (
    <div
      className={`banner ${kind === 'error' ? 'warn' : kind === 'success' ? 'good' : 'info'}`}
      style={{
        pointerEvents: 'auto', maxWidth: 440, width: '100%', boxShadow: 'var(--shadow-lg)',
        animation: 'rise .3s cubic-bezier(.2,.7,.3,1)',
      }}
      role="alert"
    >
      <span style={{ flex: 1 }}>{message}</span>
      <button
        className="icon-btn"
        style={{ width: 24, height: 24, fontSize: 13, flexShrink: 0 }}
        aria-label="Dismiss"
        onClick={() => onDismiss(id)}
      >
        ×
      </button>
    </div>
  );
}
