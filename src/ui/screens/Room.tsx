import type { Identity } from '../net';
import { goHome } from '../router';
import { useGameSession, useSnapshot } from '../useSession';
import { Game } from './Game';
import { Lobby } from './Lobby';

export function Room({ code, me, onName }: { code: string; me: Identity; onName: (n: string) => void }) {
  const session = useGameSession(code, me);
  const snap = useSnapshot(session);
  if (!session || !snap) {
    return (
      <div className="screen center">
        <p className="muted">Tuning the radio…</p>
      </div>
    );
  }
  if (!me.name) {
    // arrived by link without a name: ask once, then continue
    return <NamePrompt onName={onName} />;
  }
  if (snap.state.phase === 'lobby') return <Lobby session={session} snap={snap} code={code} />;
  return <Game session={session} snap={snap} code={code} onLeave={goHome} />;
}

function NamePrompt({ onName }: { onName: (n: string) => void }) {
  return (
    <form
      className="screen"
      onSubmit={(e) => {
        e.preventDefault();
        const v = new FormData(e.currentTarget).get('name');
        if (typeof v === 'string' && v.trim()) onName(v.trim().slice(0, 24));
      }}
    >
      <div className="title">
        <h1>Who goes there?</h1>
        <p>A friend sent you a road out. Give a name.</p>
      </div>
      <input className="input" name="name" maxLength={24} autoFocus placeholder="Your name" />
      <button className="btn primary block" type="submit">
        Enter
      </button>
    </form>
  );
}
