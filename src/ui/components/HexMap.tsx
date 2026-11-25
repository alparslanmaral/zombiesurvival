import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { isKnockedOut } from '../../engine/engine';
import { cellPos, neighbors, cellIndex } from '../../engine/map';
import type { Cell, Dir, GameState, PlayerId } from '../../engine/types';
import { visibleCells } from '../../engine/view';
import { cellName } from '../format';
import { IconG } from '../icons';

const S = 30; // hex radius in viewBox units
const W = Math.sqrt(3) * S;
const PAD = 8;

export function hexCenter(x: number, y: number): { cx: number; cy: number } {
  return { cx: PAD + W * (x + 0.5 * (y & 1)) + W / 2, cy: PAD + S + 1.5 * S * y };
}

function hexPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let k = 0; k < 6; k++) {
    const a = (Math.PI / 180) * (60 * k - 90);
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}

function iconFor(c: Cell): string | null {
  switch (c.type) {
    case 'zombie':
    case 'horde':
      return c.cleared ? 'cleared' : c.type;
    case 'loot':
    case 'event':
      return c.cleared ? null : c.type;
    case 'empty':
      return null;
    default:
      return c.type;
  }
}

interface Props {
  state: GameState;
  viewer: PlayerId | null;
  /** cell index -> direction for tappable move targets */
  targets: Map<number, Dir>;
  chosen: number | null;
  onPick: (dir: Dir) => void;
}

export const HexMap = memo(function HexMap({ state, viewer, targets, chosen, onPick }: Props) {
  const { cols, rows, cells } = state;
  const visible = visibleCells(state, viewer);
  const waveEdge = rows - state.waveRows;
  const width = PAD * 2 + W * (cols + 0.5);
  const height = PAD * 2 + S * 2 + 1.5 * S * (rows - 1);

  // street segments between adjacent passable cells (the layout is public knowledge)
  const streets = useMemo(() => {
    const segs: { x1: number; y1: number; x2: number; y2: number; key: string }[] = [];
    cells.forEach((c, i) => {
      if (c.type === 'ruin') return;
      const p = cellPos(i, cols);
      for (const q of neighbors(p, cols, rows)) {
        const j = cellIndex(q, cols);
        if (j <= i || cells[j]?.type === 'ruin') continue;
        const a = hexCenter(p.x, p.y);
        const b = hexCenter(q.x, q.y);
        segs.push({ x1: a.cx, y1: a.cy, x2: b.cx, y2: b.cy, key: `${i}-${j}` });
      }
    });
    return segs;
  }, [cells, cols, rows]);

  const groups = new Map<number, PlayerId[]>();
  for (const r of state.roster) {
    const p = state.players[r.id];
    if (!p) continue;
    const i = cellIndex(p.pos, cols);
    groups.set(i, [...(groups.get(i) ?? []), r.id]);
  }

  // floating damage / heal numbers over tokens
  const lastHp = useRef<Record<string, number> | null>(null);
  const [floats, setFloats] = useState<{ id: number; x: number; y: number; text: string; kind: 'hit' | 'heal' }[]>([]);
  const floatId = useRef(0);
  useEffect(() => {
    const now: Record<string, number> = {};
    for (const r of state.roster) now[r.id] = state.players[r.id]?.hp ?? 0;
    const before = lastHp.current;
    lastHp.current = now;
    if (!before) return;
    const fresh: typeof floats = [];
    for (const r of state.roster) {
      const pl = state.players[r.id];
      const prev = before[r.id];
      if (!pl || prev === undefined || prev === pl.hp) continue;
      const { cx, cy } = hexCenter(pl.pos.x, pl.pos.y);
      const d = pl.hp - prev;
      fresh.push({ id: ++floatId.current, x: cx, y: cy - S * 0.5, text: d > 0 ? `+${d}` : `${d}`, kind: d > 0 ? 'heal' : 'hit' });
    }
    if (!fresh.length) return;
    setFloats((f) => [...f, ...fresh]);
    const ids = new Set(fresh.map((f) => f.id));
    const t = setTimeout(() => setFloats((f) => f.filter((x) => !ids.has(x.id))), 1400);
    return () => clearTimeout(t);
  }, [state]);

  const waveY = state.waveRows > 0 ? hexCenter(0, waveEdge).cy - S * 0.95 : null;

  return (
    <div className="hexmap-wrap">
      <svg className="hexmap" viewBox={`0 0 ${width.toFixed(1)} ${height.toFixed(1)}`} role="grid" aria-label="Map">
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-strong" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="sheen" cx="35%" cy="25%" r="80%">
            <stop offset="0" stopColor="#fff" stopOpacity="0.09" />
            <stop offset="0.6" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <pattern id="fog" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
            <rect width="7" height="7" fill="#1c0d0d" />
            <line x1="0" y1="0" x2="0" y2="7" stroke="#2f1613" strokeWidth="3" />
          </pattern>
          <linearGradient id="wave-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ff3b2f" stopOpacity="0.55" />
            <stop offset="1" stopColor="#7a0d0d" stopOpacity="0.25" />
          </linearGradient>
        </defs>

        {/* streets */}
        <g className="streets">
          {streets.map((s) => (
            <line key={s.key} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} className="street" />
          ))}
          {streets.map((s) => (
            <line key={`c${s.key}`} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} className="street-line" />
          ))}
        </g>

        {/* tiles */}
        <g>
          {cells.map((c, i) => {
            const p = cellPos(i, cols);
            const { cx, cy } = hexCenter(p.x, p.y);
            if (c.type === 'ruin') {
              return (
                <g key={i} className="hx-ruin">
                  <polygon points={hexPoints(cx, cy, S * 0.66)} />
                  <IconG name="ruin" x={cx} y={cy} size={S * 0.62} className="ruin-ic" strokeWidth={1.3} />
                </g>
              );
            }
            const seen = visible.has(i);
            const ic = seen ? iconFor(c) : null;
            const danger = seen && (c.type === 'zombie' || c.type === 'horde') && !c.cleared;
            const cls = ['hx', seen ? `t-${c.type}` : 'fog', c.cleared && seen ? 'spent' : '', danger ? 'danger' : ''].join(' ');
            return (
              <g key={`${i}${seen ? 's' : 'f'}`} className={`tile ${seen ? 'pop' : ''}`} style={{ animationDelay: `${p.y * 25}ms` }}>
                <title>{seen ? cellName(c) : 'Unknown street'}</title>
                <polygon className={cls} points={hexPoints(cx, cy, S * 0.84)} />
                <polygon className="hx-sheen" points={hexPoints(cx, cy, S * 0.84)} />
                {ic && (
                  <g className={`ic ic-${c.cleared ? 'spent' : c.type}`}>
                    <IconG name={ic} x={cx} y={cy} size={S * 0.92} strokeWidth={1.7} />
                  </g>
                )}
                {!seen && <circle cx={cx} cy={cy} r={1.6} className="fog-dot" />}
              </g>
            );
          })}
        </g>

        {/* outbreak wave */}
        {state.waveRows > 0 && (
          <g className="wave-layer" pointerEvents="none">
            {cells.map((_, i) => {
              const p = cellPos(i, cols);
              if (p.y < waveEdge) return null;
              const { cx, cy } = hexCenter(p.x, p.y);
              return <polygon key={i} className="wave-hex" points={hexPoints(cx, cy, S * 0.97)} style={{ animationDelay: `${(p.x * 0.13 + p.y * 0.21) % 1.2}s` }} />;
            })}
            {waveY !== null && (
              <path
                className="wave-front"
                d={`M 0 ${waveY} ${Array.from({ length: 12 }, (_, k) => `Q ${(k + 0.5) * (width / 12)} ${waveY + (k % 2 ? 7 : -7)} ${(k + 1) * (width / 12)} ${waveY}`).join(' ')}`}
              />
            )}
          </g>
        )}

        {/* trails: where everyone came from */}
        <g pointerEvents="none">
          {state.roster.map((r) => {
            const pl = state.players[r.id];
            if (!pl || (pl.prevPos.x === pl.pos.x && pl.prevPos.y === pl.pos.y)) return null;
            const a = hexCenter(pl.prevPos.x, pl.prevPos.y);
            const b = hexCenter(pl.pos.x, pl.pos.y);
            return <line key={r.id} className="trail" x1={a.cx} y1={a.cy} x2={b.cx} y2={b.cy} stroke={pl.color} />;
          })}
        </g>

        {/* move targets */}
        <g>
          {[...targets.entries()].map(([i, dir]) => {
            const p = cellPos(i, cols);
            const { cx, cy } = hexCenter(p.x, p.y);
            return (
              <polygon
                key={`t${i}`}
                className={`target ${chosen === i ? 'chosen' : ''}`}
                points={hexPoints(cx, cy, S * 0.9)}
                onClick={() => onPick(dir)}
                role="button"
                aria-label={`Move ${dir}`}
              />
            );
          })}
        </g>

        {/* players */}
        <g className="tokens">
          {state.roster.map((r) => {
            const pl = state.players[r.id];
            if (!pl) return null;
            const i = cellIndex(pl.pos, cols);
            const group = groups.get(i) ?? [r.id];
            const k = group.indexOf(r.id);
            const n = group.length;
            const { cx, cy } = hexCenter(pl.pos.x, pl.pos.y);
            const off = n > 1 ? S * 0.36 : 0;
            const ang = (2 * Math.PI * k) / n - Math.PI / 2;
            const x = cx + off * Math.cos(ang);
            const y = cy + off * Math.sin(ang);
            const rad = n > 1 ? S * 0.3 : S * 0.42;
            const ko = isKnockedOut(pl, state.round);
            const me = r.id === viewer;
            return (
              <g key={r.id} className={`tok ${me ? 'me' : ''} ${ko ? 'ko' : ''}`} style={{ transform: `translate(${x}px, ${y}px)` }}>
                <title>{pl.name}</title>
                {me && <circle className="tok-ring" r={rad + 4} stroke={pl.color} />}
                <circle className="tok-glow" r={rad} fill={pl.color} filter="url(#glow)" />
                <circle className="tok-body" r={rad} fill={pl.color} />
                {ko ? (
                  <IconG name="ko" x={0} y={0} size={rad * 1.3} className="tok-ko" strokeWidth={2.2} />
                ) : (
                  <text className="tok-letter" dy="0.36em" fontSize={rad * 1.05}>
                    {pl.name.slice(0, 1).toUpperCase()}
                  </text>
                )}
              </g>
            );
          })}
        </g>
        <g pointerEvents="none">
          {floats.map((f) => (
            <text key={f.id} x={f.x} y={f.y} className={`float ${f.kind}`}>
              {f.text}
            </text>
          ))}
        </g>
      </svg>
    </div>
  );
});
