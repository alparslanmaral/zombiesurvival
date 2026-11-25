import { BALANCE } from '../../engine/balance';
import { itemDef } from '../../engine/data/items';
import { perkDef } from '../../engine/data/classes';
import { isKnockedOut } from '../../engine/engine';
import { cellIndex, inBounds, step } from '../../engine/map';
import type { ActionPayload, Dir, GameState, PlanAction, PlayerState } from '../../engine/types';
import { canCraft, isExhausted, isPinned, isWinded, legalMoves, openPathTargets, usableInPlan, visibleCells } from '../../engine/view';
import { actionLabel, cellName, DIR_NAME } from '../format';
import { DIR_ANGLE, Icon } from '../icons';

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

/** 6-way hex pad laid out like the hexes themselves. */
const PAD_LAYOUT: (Dir | 'wait' | null)[] = ['NW', null, 'NE', 'W', 'wait', 'E', 'SW', null, 'SE'];

export function Stamina({ p }: { p: PlayerState }) {
  const left = Math.max(0, BALANCE.MAX_CONSECUTIVE_MOVES - p.fatigue);
  return (
    <span className="stamina" title={`Stamina: ${left} move(s) before you must rest`}>
      {Array.from({ length: BALANCE.MAX_CONSECUTIVE_MOVES }, (_, i) => (
        <Icon key={i} name="bolt" size={14} className={i < left ? 'on' : 'off'} />
      ))}
    </span>
  );
}

export function ActionPanel({ state, me, selected, perk, submitted, waitingFor, onSelect, onPerk, onConfirm }: Props) {
  if (isKnockedOut(me, state.round)) {
    return (
      <div className="panel ko-panel">
        <div className="row">
          <Icon name="ko" size={26} className="danger-text" />
          <b>Out cold.</b>
        </div>
        <span className="hint">You come to in {me.koUntil - state.round + 1} round(s). The others will not wait for you, and they do not have to.</span>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="panel locked">
        <div className="row">
          <Icon name="check" size={20} className="ok-text" />
          <b className="grow">Locked in: {actionLabel(submitted, me)}</b>
        </div>
        <span className="hint">
          {waitingFor.length ? (
            <>
              Waiting for <b className="accent-text">{waitingFor.join(', ')}</b>
              <span className="ellipsis" />
            </>
          ) : (
            'Everyone is in. Resolving…'
          )}
        </span>
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
  const is = (a: PlanAction) => JSON.stringify(a) === JSON.stringify(selected);

  const describe = (a: PlanAction | null): string => {
    if (!a) return 'Tap a glowing street or pick an action.';
    if (a.kind === 'move') {
      const t = step(me.pos, a.dir);
      if (!inBounds(t, state.cols, state.rows)) return 'Edge of the map.';
      const i = cellIndex(t, state.cols);
      const c = state.cells[i];
      return `Head ${DIR_NAME[a.dir]} — ${c && visible.has(i) ? cellName(c) : 'into the unknown'}`;
    }
    return actionLabel(a, me);
  };

  return (
    <div className="panel">
      {pinned && <div className="banner bad small">You are in the thick of it. When your turn resolves, you face them again.</div>}
      {!pinned && winded && <div className="banner warn small">Catching your breath after the fight. No moving this round.</div>}
      {!pinned && !winded && exhausted && <div className="banner warn small">Your legs give out. Rest this round.</div>}
      {me.slipped && !pinned && <div className="banner warn small">You slipped past them. Keep moving: if you stop here, they turn around.</div>}

      {me.perkOffer && (
        <div className="perk-offer">
          <div className="small accent-text row">
            <Icon name="star" size={16} /> Choose a perk
          </div>
          <div className="choice-grid">
            {me.perkOffer.map((id) => (
              <button key={id} className={`btn small perk ${perk === id ? 'selected' : ''}`} onClick={() => onPerk(id)}>
                <div>{perkDef(id).name}</div>
                <div className="tiny muted">{perkDef(id).desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="pad-row">
        <div className="hexpad">
          {PAD_LAYOUT.map((d, k) => {
            if (d === null) return <span key={k} />;
            if (d === 'wait') {
              return (
                <button key={k} className={`padbtn wait ${is({ kind: 'wait' }) ? 'selected' : ''}`} onClick={() => onSelect({ kind: 'wait' })} aria-label="Wait and rest">
                  <Icon name="wait" size={20} />
                </button>
              );
            }
            return (
              <button
                key={k}
                className={`padbtn ${is({ kind: 'move', dir: d }) ? 'selected' : ''}`}
                disabled={!moves.has(d)}
                onClick={() => onSelect({ kind: 'move', dir: d })}
                aria-label={`Move ${DIR_NAME[d]}`}
              >
                <Icon name="arrow" size={20} style={{ transform: `rotate(${DIR_ANGLE[d]}deg)` }} />
              </button>
            );
          })}
        </div>
        <div className="pad-side">
          {items.map((it) => {
            const d = itemDef(it.defId);
            const a: PlanAction = { kind: 'use', item: it.uid };
            return (
              <button key={it.uid} className={`chip ${is(a) ? 'selected' : ''}`} onClick={() => onSelect(a)} title={d.desc}>
                <Icon name={d.id} size={16} /> {d.name}
              </button>
            );
          })}
          {canCraft(state, me) && (
            <button className={`chip ${is({ kind: 'craft' }) ? 'selected' : ''}`} onClick={() => onSelect({ kind: 'craft' })}>
              <Icon name="craft" size={16} /> Craft Pipe Bomb
            </button>
          )}
          {opens.map((d) => {
            const a: PlanAction = { kind: 'openPath', dir: d };
            return (
              <button key={d} className={`chip ${is(a) ? 'selected' : ''}`} onClick={() => onSelect(a)}>
                <Icon name="engineer" size={16} /> Open {DIR_NAME[d]}
              </button>
            );
          })}
          {items.length === 0 && !canCraft(state, me) && opens.length === 0 && <span className="tiny dim">Nothing to use.</span>}
        </div>
      </div>

      <div className="row">
        <span className="small grow muted">{describe(selected)}</span>
        <Stamina p={me} />
      </div>
      <button className="btn primary block" disabled={!selected || needsPerk} onClick={onConfirm}>
        {needsPerk ? 'Pick a perk first' : selected ? 'Confirm' : 'Choose your move'}
      </button>
    </div>
  );
}
