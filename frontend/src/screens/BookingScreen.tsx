import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { TopBar } from '../components/TopBar';
import { AutonomyDial } from '../components/AutonomyDial';
import { useTripStore } from '../state/tripStore';

const TYPE_LABEL = { flight: 'Flight', stay: 'Stay', activity: 'Activity' };
const STATUS_LABEL = { proposed: 'Proposed', pending_approval: 'Awaiting approval', simulated_booked: 'Booked' };

export function BookingScreen() {
  const navigate = useNavigate();
  const {
    items, autonomyLevel, setAutonomy, runBooking, approveItem, bookingRunning,
    isInternational, activeChangeRequest, resolveActiveChange,
  } = useTripStore(useShallow((s) => ({
    items: s.items, autonomyLevel: s.autonomyLevel, setAutonomy: s.setAutonomy,
    runBooking: s.runBooking, approveItem: s.approveItem, bookingRunning: s.bookingRunning,
    isInternational: s.isInternational, activeChangeRequest: s.activeChangeRequest, resolveActiveChange: s.resolveActiveChange,
  })));

  const allBooked = items.length > 0 && items.every((i) => i.status === 'simulated_booked');
  const canProceed = autonomyLevel === 'draft_only' ? items.length > 0 : allBooked;
  const needsRun = autonomyLevel !== 'draft_only' && items.some((i) => i.status !== 'simulated_booked');
  const runLabel = autonomyLevel === 'full_auto' ? 'Book everything' : 'Send for approval';

  function hitTheRoad() {
    if (activeChangeRequest) resolveActiveChange();
    navigate('/road');
  }

  return (
    <div className="screen-enter" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <TopBar back="/itinerary" />
      <div>
        <p className="mono-label" style={{ marginBottom: 6 }}>Agentic booking</p>
        <h2 style={{ fontSize: 28 }}>Tell the agent what to book</h2>
      </div>

      {activeChangeRequest && (
        <div className="banner info">Resolving an on-the-road change: "{activeChangeRequest.text}"</div>
      )}
      {isInternational && (
        <div className="banner info">Documents check — confirm passports/visas are valid before booking.</div>
      )}

      <AutonomyDial value={autonomyLevel} onChange={setAutonomy} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((item) => (
          <div key={item.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="tag">{TYPE_LABEL[item.type]}</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 600 }}>{item.title}</p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>${item.cost}</p>
            </div>
            <span className="mono-label" style={{ color: item.status === 'simulated_booked' ? 'var(--accent-2)' : 'var(--text-muted)' }}>
              {STATUS_LABEL[item.status]}
            </span>
            {item.status === 'pending_approval' && (
              <button className="btn-secondary" onClick={() => approveItem(item.id)}>Approve</button>
            )}
          </div>
        ))}
      </div>

      {needsRun && (
        <button className="btn-secondary" style={{ alignSelf: 'center' }} onClick={() => runBooking()} disabled={bookingRunning}>
          {bookingRunning ? 'Working…' : runLabel}
        </button>
      )}

      <button className="btn-primary" style={{ alignSelf: 'center' }} disabled={!canProceed} onClick={hitTheRoad}>
        Hit the road
      </button>
    </div>
  );
}
