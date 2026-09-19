import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { PinIcon } from './icons';
import { ProgressDots } from './ProgressDots';
import { useTripStore } from '../state/tripStore';

export function TopBar({ back, progress }: { back?: string; progress?: { total: number; current: number } }) {
  const navigate = useNavigate();
  const { destinationRaw, myRole } = useTripStore(useShallow((s) => ({ destinationRaw: s.destinationRaw, myRole: s.myRole })));

  return (
    <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
      {back && (
        <button className="icon-btn" aria-label="Back" onClick={() => navigate(back)}>‹</button>
      )}
      <span className="dest-chip">
        <PinIcon />
        <span>{destinationRaw}</span>
      </span>
      {myRole === 'viewer' && <span className="tag" title="You can view this trip but not change it">viewing only</span>}
      {progress && <ProgressDots total={progress.total} current={progress.current} />}
    </div>
  );
}
