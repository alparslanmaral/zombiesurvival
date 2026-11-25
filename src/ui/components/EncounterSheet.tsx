import { useState } from 'react';
import { BALANCE } from '../../engine/balance';
import { itemDef } from '../../engine/data/items';
import type { EncounterChoice, EncounterPayload, GameState, Pending, PlayerState } from '../../engine/types';
import { encounterOdds, usableInEncounter } from '../../engine/view';
import { pct } from '../format';

type EncPending = Extract<Pending, { type: 'enc' }>;

const FLAVOR = {
  zombie: 'A walker turns toward the sound of you. Then another shape behind it. No — just the one.',
  horde: 'The street is moving. A horde, shoulder to shoulder, and every head turns at once.',
};

export function EncounterSheet({ state, me, pending, onDecide }: { state: GameState; me: PlayerState; pending: EncPending; onDecide: (p: EncounterPayload) => void }) {
  const [choice, setChoice] = useState<EncounterChoice | null>(null);
  const [item, setItem] = useState<string | null>(null);
  const foe = pending.foe;
  const partner = pending.partner ? state.players[pending.partner] : undefined;
  const dmg = foe === 'horde' ? BALANCE.HORDE_DAMAGE : BALANCE.ZOMBIE_DAMAGE;

  const choices: { id: EncounterChoice; label: string; sub: string }[] = [
    ...(partner ? [{ id: 'team' as const, label: `Fight with ${partner.name}`, sub: 'Both roll, best total +1. Share the damage, both get loot.' }] : []),
    { id: 'fight', label: 'Fight', sub: foe === 'horde' && BALANCE.HORDE_HITS > 1 ? 'Win twice to break a horde. Loot if it falls.' : 'Clear the cell, take the loot. Leaves you winded.' },
    { id: 'flee', label: 'Flee', sub: 'Slip past and keep going. Fail and you are driven back.' },
    { id: 'hide', label: 'Hide', sub: `Stay put, unseen. +${BALANCE.HIDE_AMBUSH_BONUS} to your next roll here.` },
  ];

  const odds = (c: EncounterChoice) => encounterOdds(state, me.id, foe, c, item ?? undefined, pending.partner);
  const items = choice ? usableInEncounter(me, choice, foe) : [];

  return (
    <div className="sheet-backdrop">
      <div className="sheet" role="dialog" aria-label="Encounter">
        <div className="row">
          <span style={{ fontSize: 34 }}>🧟</span>
          <div className="grow">
            <h2>{foe === 'horde' ? 'Horde' : 'Walker'}</h2>
            <div className="small muted">
              Failure costs ~{dmg} HP. You have <b className="danger-text">{me.hp}</b>.
            </div>
          </div>
        </div>
        <p className="small muted" style={{ margin: 0, fontStyle: 'italic' }}>
          {FLAVOR[foe]}
          {partner && ` ${partner.name} is hiding here. You could do this together.`}
        </p>
        <div className="choice-grid">
          {choices.map((c) => {
            const o = odds(c.id);
            return (
              <button
                key={c.id}
                className={`btn enc-btn ${choice === c.id ? 'selected' : ''}`}
                style={c.id === 'team' ? { gridColumn: '1 / span 2' } : undefined}
                onClick={() => {
                  setChoice(c.id);
                  if (item && !usableInEncounter(me, c.id, foe).some((i) => i.uid === item)) setItem(null);
                }}
              >
                <span>{c.label}</span>
                <span className="odds">
                  <b>{pct(o.chance)}</b> · {o.auto ? 'auto' : `need ${o.difficulty} (+${o.mod})`}
                </span>
                <span className="tiny muted">{c.sub}</span>
              </button>
            );
          })}
        </div>
        {items.length > 0 && (
          <div className="chips">
            {items.map((it) => {
              const d = itemDef(it.defId);
              return (
                <button key={it.uid} className={`chip ${item === it.uid ? 'selected' : ''}`} onClick={() => setItem(item === it.uid ? null : it.uid)}>
                  {d.icon} {d.name}
                </button>
              );
            })}
          </div>
        )}
        <button className="btn primary block" disabled={!choice} onClick={() => choice && onDecide(item ? { choice, item } : { choice })}>
          {choice ? `Commit: ${choices.find((c) => c.id === choice)?.label}${item ? ` + ${itemDef(me.inventory.find((i) => i.uid === item)?.defId ?? 'bandages').name}` : ''}` : 'Decide'}
        </button>
      </div>
    </div>
  );
}
