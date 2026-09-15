import type { ReactNode } from 'react';
import { LogoMark } from './icons';

/** A small avatar + speech-bubble pairing that gives the agent a visible presence. */
export function AgentMessage({ children, thinking }: { children: ReactNode; thinking?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <div
        className={thinking ? 'agent-avatar agent-avatar--thinking' : 'agent-avatar'}
        aria-hidden="true"
      >
        <LogoMark style={{ width: 15, height: 15 }} />
      </div>
      <div className="card" style={{ padding: '11px 15px', fontSize: 14.5, borderTopLeftRadius: 4, flex: 1 }}>
        {children}
      </div>
    </div>
  );
}
