import { memo } from 'react';
import { isKnockedOut } from '../../engine/engine';
import { cellPos } from '../../engine/map';
import type { Dir, GameState, PlayerId } from '../../engine/types';
import { visibleCells } from '../../engine/view';
import { cellGlyph, cellName } from '../format';

interface Props {
  state: GameState;
  viewer: PlayerId | null;
  /** cell index -> direction for tappable move targets */
  targets: Map<number, Dir>;
  chosen: number | null;
  onPick: (dir: Dir) => void;
}

export const MapGrid = memo(function MapGrid({ state, viewer, targets, chosen, onPick }: Props) {
  const visible = visibleCells(state, viewer);
  const waveEdge = state.rows - state.waveRows;
  const byCell = new Map<number, PlayerId[]>();
  for (const r of state.roster) {
    const p = state.players[r.id];
    if (!p) continue;
    const i = p.pos.y * state.cols + p.pos.x;
    byCell.set(i, [...(byCell.get(i) ?? []), r.id]);
  }

  return (
    <div className="map-wrap">
      <div className="map" role="grid" aria-label="Map">
        {state.cells.map((c, i) => {
          const seen = visible.has(i);
          const pos = cellPos(i, state.cols);
          const target = targets.get(i);
          const spent = c.cleared && c.type !== 'safe';
          const cls = ['cell', seen ? c.type : 'fog', spent ? 'spent' : '', target ? 'target' : '', chosen === i ? 'chosen' : '']
            .filter(Boolean)
            .join(' ');
          const tokens = byCell.get(i) ?? [];
          const label = seen ? cellName(c) : 'Unknown';
          return (
            <button
              key={i}
              className={cls}
              aria-label={`${label} (${pos.x + 1}, ${state.rows - pos.y})`}
              title={label}
              onClick={target ? () => onPick(target) : undefined}
              tabIndex={target ? 0 : -1}
            >
              <span className="glyph">{seen ? cellGlyph(c) : '·'}</span>
              {seen && c.type === 'horde' && !c.cleared && <span className="badge-n">HORDE</span>}
              {pos.y >= waveEdge && state.waveRows > 0 && <span className="wave" />}
              {tokens.length > 0 && (
                <span className="tokens">
                  {tokens.map((pid) => {
                    const p = state.players[pid];
                    if (!p) return null;
                    const ko = isKnockedOut(p, state.round);
                    return (
                      <span
                        key={pid}
                        className={`token ${tokens.length === 1 ? 'solo' : ''} ${pid === viewer ? 'me' : ''} ${ko ? 'ko' : ''}`}
                        style={{ background: p.color }}
                        title={p.name}
                      >
                        {ko ? '💤' : p.name.slice(0, 1).toUpperCase()}
                      </span>
                    );
                  })}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
});
