import { classDef, perkDef } from '../../engine/data/classes';
import { itemDef } from '../../engine/data/items';
import { BALANCE } from '../../engine/balance';
import * as S from '../../engine/stats';
import type { GameState, PlayerState } from '../../engine/types';
import { isKnockedOut } from '../../engine/engine';

export function PlayerCard({ state, p }: { state: GameState; p: PlayerState }) {
  const cls = classDef(p.classId);
  const max = S.maxHp(p);
  const nextPerk = (p.levels + 1) * BALANCE.CLEARS_PER_PERK;
  const status: string[] = [];
  if (isKnockedOut(p, state.round)) status.push('💤 Out cold');
  if (p.hidden) status.push('🫥 Hidden');
  else if (p.engaged) status.push('⚔️ Engaged');
  if (p.slipped) status.push('💨 Slipped past');
  if (p.windedUntil >= state.round) status.push('😮‍💨 Winded');
  if (p.adrenaline) status.push(`💉 +${p.adrenaline} next roll`);

  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 10 }}>
        <span style={{ fontSize: 30 }}>{cls.icon}</span>
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
      <div className="hpbar" style={{ marginBottom: 12 }}>
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
      {status.length > 0 && <div className="small" style={{ marginBottom: 10 }}>{status.join(' · ')}</div>}
      <div className="small muted" style={{ marginBottom: 6 }}>
        Stamina{' '}
        <span className="mono accent-text">
          {'●'.repeat(Math.max(0, BALANCE.MAX_CONSECUTIVE_MOVES - p.fatigue))}
          {'○'.repeat(Math.min(BALANCE.MAX_CONSECUTIVE_MOVES, p.fatigue))}
        </span>{' '}
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
            <span className="ico">{d.icon}</span>
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
