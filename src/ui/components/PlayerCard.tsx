import type { CSSProperties } from 'react';
import { classDef, perkDef } from '../../engine/data/classes';
import { itemDef } from '../../engine/data/items';
import { BALANCE } from '../../engine/balance';
import * as S from '../../engine/stats';
import type { GameState, PlayerState } from '../../engine/types';
import { isKnockedOut } from '../../engine/engine';
import { Icon } from '../icons';
import { Stamina } from './ActionPanel';

export function PlayerCard({ state, p }: { state: GameState; p: PlayerState }) {
  const cls = classDef(p.classId);
  const max = S.maxHp(p);
  const nextPerk = (p.levels + 1) * BALANCE.CLEARS_PER_PERK;
  const status: [string, string][] = [];
  if (isKnockedOut(p, state.round)) status.push(['ko', 'Out cold']);
  if (p.hidden) status.push(['hide', 'Hidden']);
  else if (p.engaged) status.push(['engaged', 'Engaged']);
  if (p.slipped) status.push(['slipped', 'Slipped past']);
  if (p.windedUntil >= state.round) status.push(['winded', 'Winded']);
  if (p.adrenaline) status.push(['adrenaline', `+${p.adrenaline} next roll`]);

  return (
    <div className="card player-card" style={{ '--pc': p.color } as CSSProperties}>
      <div className="row" style={{ marginBottom: 10 }}>
        <span className="class-badge">
          <Icon name={cls.id} size={30} />
        </span>
        <div className="grow">
          <div style={{ fontWeight: 700 }}>
            <span className="dot" style={{ background: p.color, marginRight: 6 }} />
            {p.name}
          </div>
          <div className="small muted">{cls.name}</div>
        </div>
        <div className="mono" style={{ fontSize: 22 }}>
          {p.hp}
          <span className="dim small">/{max}</span>
        </div>
      </div>
      <div className={`hpbar ${p.hp <= 3 ? 'critical' : ''}`} style={{ marginBottom: 12 }}>
        <div style={{ width: `${Math.max(0, (p.hp / max) * 100)}%` }} />
      </div>
      <div className="stat-grid" style={{ marginBottom: 12 }}>
        <div>
          <b>{S.stat(p, 'combat')}</b>
          <span>Combat</span>
        </div>
        <div>
          <b>{S.stat(p, 'evasion')}</b>
          <span>Evasion</span>
        </div>
        <div>
          <b>{S.stat(p, 'scavenging')}</b>
          <span>Scav</span>
        </div>
        <div>
          <b>{S.armor(p)}</b>
          <span>Armor</span>
        </div>
      </div>
      {status.length > 0 && (
        <div className="chips" style={{ marginBottom: 10 }}>
          {status.map(([ic, label]) => (
            <span key={label} className="chip status">
              <Icon name={ic} size={14} /> {label}
            </span>
          ))}
        </div>
      )}
      <div className="small muted" style={{ marginBottom: 6 }}>
        Stamina <Stamina p={p} />{' '}
        · Clears {p.clears} (next perk at {nextPerk})
      </div>
      <p className="tiny muted" style={{ margin: '0 0 10px' }}>
        {cls.passive}
      </p>

      <h3>
        Pack ({p.inventory.length}/{S.slots(p)})
      </h3>
      {p.inventory.length === 0 && <p className="dim small">Empty. Pockets full of lint and regret.</p>}
      {p.inventory.map((it) => {
        const d = itemDef(it.defId);
        return (
          <div className="item" key={it.uid}>
            <span className={`ico rarity-${d.rarity}`}>
              <Icon name={d.id} size={24} />
            </span>
            <div className="grow">
              <div>
                {d.name} <span className="tiny dim">{d.rarity}</span>
              </div>
              <div className="tiny muted">
                {d.desc} — <i>{d.flavor}</i>
              </div>
            </div>
          </div>
        );
      })}

      <h3 style={{ marginTop: 12 }}>Perks</h3>
      {p.perks.map((id) => (
        <div className="small" key={id} style={{ padding: '3px 0' }}>
          <b>{perkDef(id).name}</b> <span className="muted">— {perkDef(id).desc}</span>
        </div>
      ))}
    </div>
  );
}
