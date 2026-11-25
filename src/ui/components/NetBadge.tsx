import type { SessionSnapshot } from '../../session/session';

const LABEL: Record<SessionSnapshot['status'], string> = {
  connecting: 'Connecting',
  online: 'Online',
  alone: 'No peers',
  reconnecting: 'Reconnecting',
  solo: 'Solo',
};

export function NetBadge({ snap, compact }: { snap: SessionSnapshot; compact?: boolean }) {
  const cls = snap.status === 'online' || snap.status === 'solo' ? 'on' : snap.status === 'alone' ? 'wait' : 'off';
  return (
    <span className="row small muted" title={`${snap.peerCount} peer connection(s), ${snap.inputCount} inputs`}>
      <span className={`dot ${cls}`} />
      {compact ? (snap.status === 'online' ? snap.peerCount : '') : LABEL[snap.status]}
      {!compact && snap.status === 'online' && <span className="dim">· {snap.peerCount}</span>}
    </span>
  );
}
