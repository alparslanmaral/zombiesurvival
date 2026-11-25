/** Read-only helpers for UI and bots. Pure functions over GameState. */
import { BALANCE } from './balance';
import { itemDef } from './data/items';
import { cellIndex, DIRS, hexDistance, inBounds, isZombieCell, step } from './map';
import * as S from './stats';
import type { Dir, EncounterChoice, GameState, PlayerId, PlayerState } from './types';

/** Cells whose type this player can see: everything revealed plus their vision square. */
export function visibleCells(state: GameState, pid: PlayerId | null): Set<number> {
  const out = new Set<number>();
  state.cells.forEach((c, i) => c.revealed && out.add(i));
  const p = pid ? state.players[pid] : undefined;
  if (!p) return out;
  const r = S.vision(p);
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r - 1; dx <= r + 1; dx++) {
      const q = { x: p.pos.x + dx, y: p.pos.y + dy };
      if (inBounds(q, state.cols, state.rows) && hexDistance(p.pos, q) <= r) out.add(cellIndex(q, state.cols));
    }
  return out;
}

export function isPinned(state: GameState, p: PlayerState): boolean {
  return p.engaged && isZombieCell(state.cells[cellIndex(p.pos, state.cols)]);
}

/** Directions that are in bounds (blocked cells are allowed: bumping is a legal, if wasted, move). */
export function isWinded(state: GameState, p: PlayerState): boolean {
  return p.windedUntil >= state.round;
}

export function isExhausted(p: PlayerState): boolean {
  return p.fatigue >= BALANCE.MAX_CONSECUTIVE_MOVES;
}

export function legalMoves(state: GameState, p: PlayerState): Dir[] {
  if (isPinned(state, p) || isWinded(state, p) || isExhausted(p)) return [];
  const seen = visibleCells(state, p.id);
  return DIRS.filter((d) => {
    const q = step(p.pos, d);
    if (!inBounds(q, state.cols, state.rows)) return false;
    const i = cellIndex(q, state.cols);
    const c = state.cells[i];
    if (c?.type === 'ruin') return false;
    return !(c?.type === 'blocked' && seen.has(i));
  });
}

export function usableInPlan(p: PlayerState): PlayerState['inventory'] {
  return p.inventory.filter((i) => {
    const e = itemDef(i.defId).effect;
    return e?.kind === 'heal' || e?.kind === 'adrenaline';
  });
}

export function usableInEncounter(p: PlayerState, choice: EncounterChoice, foe: 'zombie' | 'horde'): PlayerState['inventory'] {
  return p.inventory.filter((i) => {
    const e = itemDef(i.defId).effect;
    if (!e) return false;
    if (e.kind === 'adrenaline') return true;
    if (e.kind === 'autoFight') return (choice === 'fight' || choice === 'team') && (e.hordeToo || foe === 'zombie');
    if (e.kind === 'autoFlee') return choice === 'flee';
    return false;
  });
}

export function canCraft(state: GameState, p: PlayerState): boolean {
  return p.classId === 'engineer' && state.round >= p.craftReadyRound && p.inventory.length < S.slots(p) && !isPinned(state, p);
}

export function canOpenPath(state: GameState, p: PlayerState): boolean {
  return p.classId === 'engineer' && state.round >= p.openPathReadyRound && !isPinned(state, p);
}

/** Directions with adjacent rubble the Engineer could open. */
export function openPathTargets(state: GameState, p: PlayerState): Dir[] {
  if (!canOpenPath(state, p)) return [];
  return DIRS.filter((d) => {
    const q = step(p.pos, d);
    if (!inBounds(q, state.cols, state.rows)) return false;
    const t = state.cells[cellIndex(q, state.cols)]?.type;
    return t === 'blocked' || (t === 'ruin' && BALANCE.ENGINEER_OPEN_RUINS && q.y > 0);
  });
}

export interface Odds {
  chance: number;
  difficulty: number;
  mod: number;
  auto: boolean;
}

/** Success chance for an encounter choice, as the engine would roll it right now. */
export function encounterOdds(
  state: GameState,
  pid: PlayerId,
  foe: 'zombie' | 'horde',
  choice: EncounterChoice,
  itemUid?: string,
  partnerId?: PlayerId | null,
): Odds {
  const p = state.players[pid];
  if (!p) return { chance: 0, difficulty: 0, mod: 0, auto: false };
  const it = itemUid ? p.inventory.find((i) => i.uid === itemUid) : undefined;
  const eff = it ? itemDef(it.defId).effect : undefined;
  const boost = p.adrenaline + (eff?.kind === 'adrenaline' ? BALANCE.ADRENALINE_BONUS : 0);
  const ambush = p.hidden ? BALANCE.HIDE_AMBUSH_BONUS : 0;
  const diff = foe === 'horde' ? BALANCE.HORDE_DIFFICULTY : BALANCE.ZOMBIE_DIFFICULTY;
  const autoFight = eff?.kind === 'autoFight' && (eff.hordeToo || foe === 'zombie');
  switch (choice) {
    case 'fight': {
      const mod = S.stat(p, 'combat') + ambush + boost;
      return { chance: autoFight ? 1 : S.successChance(mod, diff), difficulty: diff, mod, auto: autoFight };
    }
    case 'flee': {
      const mod = S.stat(p, 'evasion') + ambush + boost;
      const d = S.fleeDifficulty(p);
      const auto = eff?.kind === 'autoFlee';
      return { chance: auto ? 1 : S.successChance(mod, d), difficulty: d, mod, auto };
    }
    case 'hide': {
      const d = S.hideDifficulty(p);
      return { chance: S.successChance(boost, d), difficulty: d, mod: boost, auto: false };
    }
    case 'team': {
      const a = partnerId ? state.players[partnerId] : undefined;
      if (!a) return encounterOdds(state, pid, foe, 'fight', itemUid);
      const bonus = BALANCE.TEAM_BONUS + S.teamBonus(p) + S.teamBonus(a);
      const mb = S.stat(p, 'combat') + boost + bonus;
      const ma = S.stat(a, 'combat') + BALANCE.HIDE_AMBUSH_BONUS + a.adrenaline + bonus;
      if (autoFight) return { chance: 1, difficulty: diff, mod: Math.max(mb, ma), auto: true };
      let ok = 0;
      for (let b1 = 1; b1 <= 6; b1++)
        for (let b2 = 1; b2 <= 6; b2++)
          for (let a1 = 1; a1 <= 6; a1++)
            for (let a2 = 1; a2 <= 6; a2++) {
              const c6 = (b1 === 6 && b2 === 6) || (a1 === 6 && a2 === 6);
              const c1 = b1 === 1 && b2 === 1 && a1 === 1 && a2 === 1;
              if (c6 || (!c1 && Math.max(b1 + b2 + mb, a1 + a2 + ma) >= diff)) ok++;
            }
      return { chance: ok / 1296, difficulty: diff, mod: Math.max(mb, ma), auto: false };
    }
  }
}

export function pendingFor(state: GameState, pid: PlayerId): GameState['pending'][number] | undefined {
  return state.pending.find((p) => p.playerId === pid);
}

/** Rounds until the wave next advances (0 = at the end of this round), or null if it never will. */
export function waveEta(state: GameState): number | null {
  if (state.waveRows >= Math.min(state.rows - 1, BALANCE.WAVE_MAX_ROWS)) return null;
  const start = BALANCE.WAVE_START_ROUND;
  const every = BALANCE.WAVE_ADVANCE_EVERY;
  const r = state.round;
  if (r <= start) return start - r;
  return (((start - r) % every) + every) % every;
}
