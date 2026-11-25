import { BALANCE } from '../../engine/balance';
import { itemDef } from '../../engine/data/items';
import { perkDef } from '../../engine/data/classes';
import { isKnockedOut } from '../../engine/engine';
import { cellIndex, inBounds, step } from '../../engine/map';
import type { ActionPayload, Dir, GameState, PlanAction, PlayerState } from '../../engine/types';
import { canCraft, isExhausted, isPinned, isWinded, legalMoves, openPathTargets, usableInPlan, visibleCells } from '../../engine/view';
import { actionLabel, cellName, DIR_ARROW } from '../format';

interface Props {
  state: GameState;
  me: PlayerState;
  selected: PlanAction | null;
  perk: string | null;
  submitted: ActionPayload | 'forced' | null;
  waitingFor: string[];
  onSelect: (a: PlanAction | null) => void;
  onPerk: (id: string) => void;
  onConfirm: () => void;
}

export function ActionPanel({ state, me, selected, perk, submitted, waitingFor, onSelect, onPerk, onConfirm }: Props) {
  if (isKnockedOut(me, state.round)) {
    return (
      <div className="panel">
        <b>Out cold.</b>
        <span className="hint">
          You come to in {me.koUntil - state.round + 1} round(s). The others will not wait for you, and they do not have to.
        </span>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="panel">
        <div className="row">
          <span className="dot on" />
          <b className="grow">Locked in: {actionLabel(submitted, me)}</b>
        </div>
        <span className="hint">{waitingFor.length ? `Waiting for ${waitingFor.join(', ')}.` : 'Everyone is in. Resolving…'}</span>
      </div>
    );
  }

  const pinned = isPinned(state, me);
  const winded = isWinded(state, me);
  const exhausted = isExhausted(me);
  const moves = new Set(legalMoves(state, me));
  const items = usableInPlan(me);
  const opens = openPathTargets(state, me);
  const visible = visibleCells(state, me.id);
  const needsPerk = !!me.perkOffer && !perk;

  const pickDir = (d: Dir) => onSelect({ kind: 'move', dir: d });
  const is = (a: PlanAction) => JSON.stringify(a) === JSON.stringify(selected);

  const describe = (a: PlanAction | null): string => {
    if (!a) return 'Choose an action.';
    if (a.kind === 'move') {
      const t = step(me.pos, a.dir);
      if (!inBounds(t, state.cols, state.rows)) return 'Edge of the map.';
      const i = cellIndex(t, state.cols);
      const c = state.cells[i];
      return `${actionLabel(a, me)} — ${c && visible.has(i) ? cellName(c) : 'into the unknown'}`;
    }
    return actionLabel(a, me);
  };

  return (
    <div className="panel">
      {pinned && <div className="banner bad small">You are in the thick of it. When your turn resolves, you face them again.</div>}
      {!pinned && winded && <div className="banner warn small">Catching your breath after the fight. No moving this round.</div>}
      {!pinned && !winded && exhausted && <div className="banner warn small">Your legs give out. Rest this round.</div>}
      {me.slipped && !pinned && (
        <div className="banner warn small">You slipped past them. Keep moving: if you stop here, they turn around.</div>
      )}

      {me.perkOffer && (
        <div>
          <div className="small accent-text" style={{ marginBottom: 6 }}>
            Choose a perk
          </div>
          <div className="choice-grid">
            {me.perkOffer.map((id) => (
              <button key={id} className={`btn small ${perk === id ? 'selected' : ''}`} style={{ textAlign: 'left', minHeight: 56 }} onClick={() => onPerk(id)}>
                <div>{perkDef(id).name}</div>
                <div className="tiny muted">{perkDef(id).desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="dpad">
        {(['N', 'W', 'S', 'E'] as Dir[]).map((d) => (
          <button
            key={d}
            className={`btn ${d.toLowerCase()} ${is({ kind: 'move', dir: d }) ? 'selected' : ''}`}
            disabled={!moves.has(d)}
            onClick={() => pickDir(d)}
            aria-label={`Move ${d}`}
          >
            {DIR_ARROW[d]}
          </button>
        ))}
        <button className={`btn wait ${is({ kind: 'wait' }) ? 'selected' : ''}`} onClick={() => onSelect({ kind: 'wait' })} style={{ fontSize: 13 }}>
          Wait
        </button>
      </div>

      {(items.length > 0 || canCraft(state, me) || opens.length > 0) && (
        <div className="chips">
          {items.map((it) => {
            const d = itemDef(it.defId);
            const a: PlanAction = { kind: 'use', item: it.uid };
            return (
              <button key={it.uid} className={`chip ${is(a) ? 'selected' : ''}`} onClick={() => onSelect(a)}>
                {d.icon} {d.name}
              </button>
            );
          })}
          {canCraft(state, me) && (
            <button className={`chip ${is({ kind: 'craft' }) ? 'selected' : ''}`} onClick={() => onSelect({ kind: 'craft' })}>
              🧨 Craft Pipe Bomb
            </button>
          )}
          {opens.map((d) => {
            const a: PlanAction = { kind: 'openPath', dir: d };
            return (
              <button key={d} className={`chip ${is(a) ? 'selected' : ''}`} onClick={() => onSelect(a)}>
                🔧 Open Path {DIR_ARROW[d]}
              </button>
            );
          })}
        </div>
      )}

      <div className="row">
        <span className="small grow">{describe(selected)}</span>
        <span className="tiny dim mono" title="Stamina">
          {'●'.repeat(Math.max(0, BALANCE.MAX_CONSECUTIVE_MOVES - me.fatigue))}
          {'○'.repeat(Math.min(BALANCE.MAX_CONSECUTIVE_MOVES, me.fatigue))}
        </span>
      </div>
      <button className="btn primary block" disabled={!selected || needsPerk} onClick={onConfirm}>
        {needsPerk ? 'Pick a perk first' : selected ? 'Confirm' : 'Tap a lit cell or choose'}
      </button>
    </div>
  );
}
