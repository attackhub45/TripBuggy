import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { TopBar } from '../components/TopBar';
import { useTripStore } from '../state/tripStore';
import type { Slot } from '../state/types';

const SLOTS: Slot[] = ['morning', 'afternoon', 'evening'];
const TYPE_LABEL = { flight: 'Flight', stay: 'Stay', activity: 'Activity' };

export function ItineraryScreen() {
  const navigate = useNavigate();
  const {
    items, removeItem, setItemSlot, budgetCap, budgetTotal, isOverBudget, hasConflicts, tripDays,
  } = useTripStore(useShallow((s) => ({
    items: s.items, removeItem: s.removeItem, setItemSlot: s.setItemSlot,
    budgetCap: s.budgetCap, budgetTotal: s.budgetTotal, isOverBudget: s.isOverBudget, hasConflicts: s.hasConflicts,
    tripDays: s.days,
  })));
  const dayOptions = Array.from({ length: tripDays ?? 1 }, (_, i) => i + 1);

  const total = budgetTotal();
  const cap = budgetCap();
  const overBudget = isOverBudget();
  const conflicted = hasConflicts();

  const conflictKeys = new Set<string>();
  const seen = new Set<string>();
  for (const i of items) {
    const key = `${i.day}-${i.slot}`;
    if (seen.has(key)) conflictKeys.add(key);
    seen.add(key);
  }

  const days = Array.from(new Set(items.map((i) => i.day))).sort((a, b) => a - b);

  return (
    <div className="screen-enter" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <TopBar back="/discover" />
      <div>
        <p className="mono-label" style={{ marginBottom: 6 }}>Build itinerary</p>
        <h2 style={{ fontSize: 28 }}>Place items on days, flag conflicts</h2>
      </div>

      <div className={`banner ${overBudget ? 'warn' : 'good'}`} style={{ justifyContent: 'space-between' }}>
        <span>${total} of ${cap} budget</span>
        {overBudget && <span className="mono-label" style={{ color: 'var(--danger)' }}>over budget</span>}
      </div>

      {overBudget && (
        <div className="banner warn" style={{ justifyContent: 'space-between' }}>
          <span>This is over budget — swap or drop an item.</span>
          <button className="btn-secondary" onClick={() => navigate('/discover', { state: { fromBudgetLoop: true } })}>
            Back to Discover &amp; Add
          </button>
        </div>
      )}

      {conflicted && <div className="banner warn">Two items are scheduled at the same time — adjust the day or time slot below.</div>}

      {days.map((day) => (
        <div key={day} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p className="mono-label">Day {day}</p>
          {items.filter((i) => i.day === day).map((item) => {
            const isConflict = conflictKeys.has(`${item.day}-${item.slot}`);
            return (
              <div key={item.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, borderColor: isConflict ? 'var(--danger)' : undefined }}>
                <span className="tag">{TYPE_LABEL[item.type]}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600 }}>{item.title}</p>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>${item.cost}</p>
                </div>
                <select
                  value={item.day}
                  onChange={(e) => setItemSlot(item.id, Number(e.target.value), item.slot)}
                  style={{ borderRadius: 999, border: '1px solid var(--border)', padding: '6px 10px', background: 'var(--surface)', color: 'var(--text)' }}
                >
                  {dayOptions.map((d) => <option key={d} value={d}>Day {d}</option>)}
                </select>
                <select
                  value={item.slot}
                  onChange={(e) => setItemSlot(item.id, item.day, e.target.value as Slot)}
                  style={{ borderRadius: 999, border: '1px solid var(--border)', padding: '6px 10px', background: 'var(--surface)', color: 'var(--text)' }}
                >
                  {SLOTS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <button className="icon-btn" aria-label="Remove" onClick={() => removeItem(item.id)}>×</button>
              </div>
            );
          })}
        </div>
      ))}

      <button className="btn-primary" style={{ alignSelf: 'center' }} disabled={overBudget || conflicted || items.length === 0} onClick={() => navigate('/booking')}>
        Continue to booking
      </button>
    </div>
  );
}
