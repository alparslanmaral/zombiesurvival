import type { GameState, LogEntry, LogKind } from '../../engine/types';
import { Icon } from '../icons';

const KIND_ICON: Record<LogKind, string> = {
  info: 'log',
  move: 'arrow',
  encounter: 'fight',
  loot: 'loot',
  event: 'event',
  damage: 'heart',
  heal: 'medic',
  wave: 'wave',
  ko: 'ko',
  win: 'flag',
  round: 'dice',
  perk: 'star',
};

export function LogList({ state, limit }: { state: GameState; limit?: number }) {
  const entries = limit ? state.log.slice(-limit) : state.log;
  const byRound: [number, LogEntry[]][] = [];
  for (const e of entries) {
    const last = byRound[byRound.length - 1];
    if (last && last[0] === e.round) last[1].push(e);
    else byRound.push([e.round, [e]]);
  }
  return (
    <div className="log">
      {byRound.reverse().map(([round, list]) => (
        <div key={round}>
          <div className="round-h">Round {round}</div>
          {list
            .filter((e) => e.kind !== 'round' || round === 1)
            .reverse()
            .map((e) => (
              <div key={`${e.id}|${e.text}`} className={`entry ${e.kind}`}>
                <Icon name={e.roll ? 'dice' : KIND_ICON[e.kind]} size={14} className="entry-ic" />
                <span>{e.text}</span>
                {e.roll && (
                  <span className="mini-dice">
                    [{e.roll.dice[0]}+{e.roll.dice[1]}
                    {e.roll.mod ? `${e.roll.mod > 0 ? '+' : '−'}${Math.abs(e.roll.mod)}` : ''}={e.roll.total} vs {e.roll.difficulty}]
                  </span>
                )}
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}
