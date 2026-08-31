import { useNavigate } from 'react-router-dom';
import { PinIcon } from './icons';
import { ProgressDots } from './ProgressDots';
import { useTripStore } from '../state/tripStore';

export function TopBar({ back, progress }: { back?: string; progress?: { total: number; current: number } }) {
  const navigate = useNavigate();
  const destinationRaw = useTripStore((s) => s.destinationRaw);

  return (
    <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
      {back && (
        <button className="icon-btn" aria-label="Back" onClick={() => navigate(back)}>‹</button>
      )}
      <span className="dest-chip">
        <PinIcon />
        <span>{destinationRaw}</span>
      </span>
      {progress && <ProgressDots total={progress.total} current={progress.current} />}
    </div>
  );
}
