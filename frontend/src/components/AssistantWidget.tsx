import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ChatIcon, CloseIcon, LogoMark } from './icons';
import { assistant, ensureAuthenticated } from '../api/client';
import { useTripStore } from '../state/tripStore';
import { friendlyMessage } from '../lib/errors';

/** Maps a route path to the screen key agent_service.SCREEN_HELP knows about on the
 * backend — keep in sync with that dict if routes change. */
const SCREEN_NAMES: Record<string, string> = {
  '/': 'home',
  '/flow': 'flow',
  '/summary': 'summary',
  '/route': 'route',
  '/discover': 'discover',
  '/itinerary': 'itinerary',
  '/booking': 'booking',
  '/road': 'road',
  '/recap': 'recap',
  '/trips': 'trips',
};

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

/** Floating help widget, bottom-right, on every screen — answers free-text questions
 * about whatever's currently on screen via the real Claude agent (or a canned
 * per-screen blurb if the agent call fails — see backend/app/agent_service.py). */
export function AssistantWidget() {
  const location = useLocation();
  const tripId = useTripStore((s) => s.tripId);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [asking, setAsking] = useState(false);

  const screen = SCREEN_NAMES[location.pathname] ?? 'other';

  async function send() {
    const question = draft.trim();
    if (!question || asking) return;
    setDraft('');
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', text: question };
    setMessages((m) => [...m, userMsg]);
    setAsking(true);
    try {
      await ensureAuthenticated();
      const { answer } = await assistant.ask(question, screen, tripId);
      setMessages((m) => [...m, { id: `a-${Date.now()}`, role: 'assistant', text: answer }]);
    } catch (err) {
      setMessages((m) => [...m, { id: `a-${Date.now()}`, role: 'assistant', text: friendlyMessage(err) }]);
    } finally {
      setAsking(false);
    }
  }

  return (
    <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 900, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
      {open && (
        <div
          className="card"
          style={{
            width: 320, maxWidth: 'calc(100vw - 40px)', maxHeight: 440, display: 'flex', flexDirection: 'column',
            padding: 0, overflow: 'hidden', boxShadow: 'var(--shadow-lg)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <div className="agent-avatar" aria-hidden="true"><LogoMark style={{ width: 15, height: 15 }} /></div>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 600, fontSize: 14.5 }}>Ask the agent</p>
              <p className="mono-label" style={{ fontSize: 10.5 }}>About this screen</p>
            </div>
            <button className="icon-btn" style={{ width: 28, height: 28 }} aria-label="Close" onClick={() => setOpen(false)}>
              <CloseIcon style={{ width: 14, height: 14 }} />
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.length === 0 && (
              <p style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>
                Ask anything about what's on this screen — e.g. "what does the autonomy dial do?"
              </p>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '88%',
                  background: m.role === 'user' ? 'var(--accent)' : 'var(--surface-2)',
                  color: m.role === 'user' ? '#fff' : 'var(--text)',
                  borderRadius: 14,
                  borderBottomRightRadius: m.role === 'user' ? 4 : 14,
                  borderBottomLeftRadius: m.role === 'assistant' ? 4 : 14,
                  padding: '8px 12px',
                  fontSize: 13.5,
                }}
              >
                {m.text}
              </div>
            ))}
            {asking && (
              <div className="agent-avatar agent-avatar--thinking" style={{ width: 26, height: 26, alignSelf: 'flex-start' }} aria-hidden="true">
                <LogoMark style={{ width: 13, height: 13 }} />
              </div>
            )}
          </div>

          <form
            style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--border)' }}
            onSubmit={(e) => { e.preventDefault(); void send(); }}
          >
            <div className="pill-input" style={{ padding: '7px 14px' }}>
              <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ask a question…" disabled={asking} />
            </div>
            <button type="submit" className="btn-secondary" style={{ padding: '8px 16px' }} disabled={asking || !draft.trim()}>
              Send
            </button>
          </form>
        </div>
      )}

      <button
        className="icon-btn"
        aria-label={open ? 'Close assistant' : 'Ask the agent a question'}
        onClick={() => setOpen((v) => !v)}
        style={{ width: 52, height: 52, background: 'var(--accent)', color: '#fff', border: 'none', boxShadow: 'var(--shadow-lg)' }}
      >
        {open ? <CloseIcon style={{ width: 20, height: 20 }} /> : <ChatIcon style={{ width: 22, height: 22 }} />}
      </button>
    </div>
  );
}
