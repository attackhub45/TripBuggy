export function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: i <= current ? 'var(--accent)' : 'var(--border)',
            transform: i === current ? 'scale(1.3)' : 'scale(1)',
            transition: 'background .2s ease, transform .2s ease',
          }}
        />
      ))}
    </div>
  );
}
