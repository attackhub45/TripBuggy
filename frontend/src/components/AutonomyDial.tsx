import type { AutonomyLevel } from '../state/types';

const STOPS: { level: AutonomyLevel; label: string; blurb: string }[] = [
  { level: 'draft_only', label: 'Draft only', blurb: 'Agent shortlists — you book it yourself' },
  { level: 'approve_each', label: 'Approve each', blurb: 'Agent proposes, you confirm per item' },
  { level: 'full_auto', label: 'Full auto', blurb: 'Agent books without asking first' },
];

export function AutonomyDial({ value, onChange }: { value: AutonomyLevel; onChange: (v: AutonomyLevel) => void }) {
  const activeIndex = STOPS.findIndex((s) => s.level === value);
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <p className="mono-label" style={{ marginBottom: 4 }}>Booking autonomy</p>
        <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>{STOPS[activeIndex]?.blurb}</p>
      </div>
      <div style={{ position: 'relative', padding: '0 6px' }}>
        <div style={{ position: 'relative', height: 4, background: 'var(--border)', borderRadius: 999 }}>
          <div
            style={{
              position: 'absolute', left: 0, top: 0, bottom: 0,
              width: `${(activeIndex / (STOPS.length - 1)) * 100}%`,
              background: 'var(--accent)', borderRadius: 999, transition: 'width .2s ease',
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: -6 }}>
          {STOPS.map((s, i) => (
            <button
              key={s.level}
              type="button"
              onClick={() => onChange(s.level)}
              aria-pressed={value === s.level}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                background: 'none', border: 'none', cursor: 'pointer', padding: 4,
              }}
            >
              <span
                style={{
                  width: i === activeIndex ? 16 : 11,
                  height: i === activeIndex ? 16 : 11,
                  borderRadius: '50%',
                  background: i <= activeIndex ? 'var(--accent)' : 'var(--surface)',
                  border: i <= activeIndex ? 'none' : '1.5px solid var(--dust)',
                  transition: 'all .15s ease',
                }}
              />
              <span
                className="mono-label"
                style={{ color: i === activeIndex ? 'var(--accent)' : 'var(--text-muted)', fontWeight: i === activeIndex ? 600 : 400 }}
              >
                {s.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
