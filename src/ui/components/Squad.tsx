import { classDef } from '../../engine/data/classes';
import { isKnockedOut } from '../../engine/engine';
import * as S from '../../engine/stats';
import type { GameState } from '../../engine/types';
import type { SessionSnapshot } from '../../session/session';
import { Icon } from '../icons';

export function Squad({ state, snap, onSkip }: { state: GameState; snap: SessionSnapshot; onSkip: (id: string) => void }) {
  return (
    <div className="card">
      <h2>Squad</h2>
      {state.order.map((id, idx) => {
        const p = state.players[id];
        if (!p) return null;
        const pend = state.pending.find((x) => x.playerId === id);
        const connected = snap.connected[id] ?? false;
        const ko = isKnockedOut(p, state.round);
        const resolved = state.resolvedThisRound.includes(id);
        let status = '';
        if (state.phase === 'over') status = state.winner === id ? 'Made it' : '';
        else if (ko) status = `Out for ${p.koUntil - state.round + 1}`;
        else if (pend?.type === 'action') status = 'Thinking…';
        else if (pend?.type === 'enc') status = `Facing a ${pend.foe === 'horde' ? 'horde' : 'walker'}…`;
        else if (state.phase === 'plan') status = 'Locked in';
        else if (resolved) status = 'Done';
        else status = 'Up next';
        return (
          <div className="player-row" key={id}>
            <span className="mono dim tiny" title="Resolution order this round">
              {idx + 1}
            </span>
            <span className="class-badge small" style={{ color: p.color }}>
              <Icon name={p.classId} size={20} />
            </span>
            <div className="grow">
              <div>
                {p.name} {id === snap.me.playerId && <span className="dim">(you)</span>}
                {p.bot && <span className="dim tiny"> · bot</span>}
              </div>
              <div className="tiny muted">
                {classDef(p.classId).name} · HP {p.hp}/{S.maxHp(p)} · row {state.rows - p.pos.y}/{state.rows}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="small">{status}</div>
              <div className="tiny row" style={{ justifyContent: 'flex-end' }}>
                <span className={`dot ${connected ? 'on' : 'off'}`} />
                {connected ? 'online' : 'offline'}
              </div>
              {pend && !connected && state.phase !== 'over' && (
                <button className="btn small danger" style={{ marginTop: 4 }} onClick={() => onSkip(id)}>
                  Skip (count as Wait)
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
