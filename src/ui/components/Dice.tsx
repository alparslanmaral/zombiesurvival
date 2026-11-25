import { useEffect, useRef, useState } from 'react';
import type { GameState, LogEntry } from '../../engine/types';

const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export function Die({ value, rolling }: { value: number; rolling: boolean }) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (!rolling) {
      setShown(value);
      return;
    }
    const t = setInterval(() => setShown(1 + Math.floor(Math.random() * 6)), 90);
    return () => clearInterval(t);
  }, [rolling, value]);
  const pips = PIPS[shown] ?? [];
  return (
    <div className={`die ${rolling ? 'rolling' : 'landed'}`} aria-label={`Die showing ${value}`}>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={pips.includes(i) ? 'pip' : ''} />
      ))}
    </div>
  );
}

type Roll = LogEntry & { roll: NonNullable<LogEntry['roll']> };

/**
 * Watches the log for new rolls and plays them one by one. Rolls that exist
 * when the component mounts (resume after refresh) are not replayed.
 */
export function DiceOverlay({ state, viewer }: { state: GameState; viewer: string | null }) {
  const seen = useRef<Set<string> | null>(null);
  const [queue, setQueue] = useState<Roll[]>([]);
  const [phase, setPhase] = useState<'rolling' | 'result'>('rolling');

  useEffect(() => {
    const rolls = state.log.filter((l): l is Roll => !!l.roll);
    const sig = (r: Roll) => `${r.id}|${r.text}`;
    if (!seen.current) {
      seen.current = new Set(rolls.map(sig));
      return;
    }
    const fresh = rolls.filter((r) => !seen.current!.has(sig(r)));
    if (!fresh.length) return;
    fresh.forEach((r) => seen.current!.add(sig(r)));
    // after a long absence don't make people sit through a backlog
    setQueue((q) => [...q, ...fresh].slice(-4));
  }, [state.log]);

  const current = queue[0];
  useEffect(() => {
    if (!current) return;
    setPhase('rolling');
    const mine = current.playerId === viewer;
    const t1 = setTimeout(() => setPhase('result'), mine ? 850 : 550);
    const t2 = setTimeout(() => setQueue((q) => q.slice(1)), mine ? 2300 : 1500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [current, viewer]);

  if (!current) return null;
  const r = current.roll;
  const who = state.players[current.playerId ?? '']?.name ?? '';
  return (
    <div className="dice-overlay" onClick={() => setQueue((q) => q.slice(1))} role="dialog" aria-live="polite">
      <div className="dice-box">
        <div className="small muted">
          {who} · {r.label}
        </div>
        <div className="dice-row">
          <Die value={r.dice[0]} rolling={phase === 'rolling'} />
          <Die value={r.dice[1]} rolling={phase === 'rolling'} />
        </div>
        {phase === 'result' ? (
          <>
            <div className="mono">
              {r.dice[0]} + {r.dice[1]} {r.mod >= 0 ? '+' : '−'} {Math.abs(r.mod)} = <b>{r.total}</b> vs {r.difficulty}
            </div>
            <div className={`verdict ${r.success ? 'ok' : 'bad'}`}>
              {r.auto ? 'Automatic' : r.crit === 'double6' ? 'Double six!' : r.crit === 'double1' ? 'Snake eyes' : r.success ? 'Success' : 'Failure'}
            </div>
          </>
        ) : (
          <div className="mono dim">rolling…</div>
        )}
        <div className="tiny dim">tap to skip</div>
      </div>
    </div>
  );
}
