/**
 * Heuristic bot. Used by solo mode (`?bots=3`) and by the balance simulator.
 * Bots only use information their player could see (revealed cells + vision).
 */
import { BALANCE } from './balance';
import { itemDef } from './data/items';
import { cellIndex, cellPos, DIRS, dirBetween, inBounds, isZombieCell, step } from './map';
import { makeRng } from './rng';
import * as S from './stats';
import type { ActionPayload, Dir, EncounterPayload, GameInput, GameState, PlayerId, PlayerState } from './types';
import { canOpenPath, encounterOdds, isExhausted, isPinned, isWinded, pendingFor, visibleCells } from './view';

/** Expected-cost pathfinding (Dijkstra) from the player to the Safe Zone over what the bot knows. */
function planPath(state: GameState, p: PlayerState, known: Set<number>): number[] {
  const { cols, rows, cells } = state;
  const n = cells.length;
  const pf = S.successChance(S.stat(p, 'combat'), BALANCE.ZOMBIE_DIFFICULTY);
  const ph = S.successChance(S.stat(p, 'combat'), BALANCE.HORDE_DIFFICULTY);
  const pe = S.successChance(S.stat(p, 'evasion'), S.fleeDifficulty(p));
  // late in the game (or stuck in the Wave) caution stops paying: charge
  const inWave = p.pos.y >= state.rows - state.waveRows;
  const desperate = state.round >= 20 || (inWave && p.hp <= 2);
  const lowHp = p.hp <= S.maxHp(p) / 2 && !desperate;
  const cost = (i: number): number => {
    const c = cells[i];
    if (!c) return Infinity;
    if (!known.has(i)) return 1.5;
    if (c.type === 'blocked') return Infinity;
    if (isZombieCell(c)) {
      const best = Math.max(c.type === 'horde' ? ph : pf, pe);
      const dmg = c.type === 'horde' ? BALANCE.HORDE_DAMAGE : BALANCE.ZOMBIE_DAMAGE;
      return 1 + (1 - best) * (1.5 + dmg * (lowHp ? 1 : 0.4));
    }
    if (c.type === 'loot' && !c.cleared) return 0.7;
    if (c.type === 'shelter' && lowHp && !p.sheltersUsed.includes(i)) return 0.5;
    return 1;
  };
  const dist = new Array<number>(n).fill(Infinity);
  const prev = new Array<number>(n).fill(-1);
  const done = new Array<boolean>(n).fill(false);
  const start = cellIndex(p.pos, cols);
  dist[start] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!done[i] && (dist[i] as number) < Infinity && (u < 0 || (dist[i] as number) < (dist[u] as number))) u = i;
    if (u < 0) break;
    done[u] = true;
    const up = cellPos(u, cols);
    if (up.y === 0) {
      const path: number[] = [];
      for (let v = u; v !== start && v >= 0; v = prev[v] as number) path.unshift(v);
      return path;
    }
    for (const d of DIRS) {
      const q = step(up, d);
      if (!inBounds(q, cols, rows)) continue;
      const v = cellIndex(q, cols);
      // hysteresis: stepping straight back where we came from is discouraged (stops E/W dithering)
      const back = u === start && q.x === p.prevPos.x && q.y === p.prevPos.y ? 2 : 0;
      const nd = (dist[u] as number) + cost(v) + back;
      if (nd < (dist[v] as number)) {
        dist[v] = nd;
        prev[v] = u;
      }
    }
  }
  return [];
}

function healValue(p: PlayerState, uid: string): number {
  const it = p.inventory.find((i) => i.uid === uid);
  const e = it ? itemDef(it.defId).effect : undefined;
  return e?.kind === 'heal' ? S.healAmount(p, e.amount) : 0;
}

function canCraftNow(state: GameState, p: PlayerState): boolean {
  return p.classId === 'engineer' && state.round >= p.craftReadyRound && p.inventory.length < S.slots(p);
}

function healItem(p: PlayerState): string | undefined {
  return p.inventory.find((i) => itemDef(i.defId).effect?.kind === 'heal')?.uid;
}

export function botAction(state: GameState, pid: PlayerId): ActionPayload {
  const p = state.players[pid];
  if (!p) return { kind: 'wait' };
  const rng = makeRng(state.seed, state.round, pid, 'bot');
  const perk = p.perkOffer ? rng.pick(p.perkOffer) : undefined;
  const withPerk = (a: ActionPayload): ActionPayload => (perk ? { ...a, perk } : a);
  const heal = healItem(p);

  if (isPinned(state, p) || isWinded(state, p) || isExhausted(p)) {
    // forced rest: make it count
    if (heal && (p.hp <= 4 || p.hp + healValue(p, heal) <= S.maxHp(p) + 1)) return withPerk({ kind: 'use', item: heal });
    if (!isPinned(state, p) && canCraftNow(state, p)) return withPerk({ kind: 'craft' });
    return withPerk({ kind: 'wait' });
  }
  const inWave = p.pos.y >= state.rows - state.waveRows;
  if (heal && (p.hp <= 3 || (p.hp <= 5 && !inWave && p.hp + 4 <= S.maxHp(p)))) return withPerk({ kind: 'use', item: heal });

  const known = visibleCells(state, pid);
  const path = planPath(state, p, known);
  const next = path[0];
  if (next === undefined) return withPerk({ kind: 'move', dir: rng.pick(DIRS) });
  const dir = dirBetween(p.pos, cellPos(next, state.cols)) as Dir;

  if (canOpenPath(state, p)) {
    // open rubble directly north when the planned route has to detour around it
    const north = step(p.pos, 'N');
    const ni = inBounds(north, state.cols, state.rows) ? cellIndex(north, state.cols) : -1;
    if (ni >= 0 && state.cells[ni]?.type === 'blocked' && dir !== 'N' && known.has(ni) && p.pos.y > 1) return withPerk({ kind: 'openPath', dir: 'N' });
  }
  return withPerk({ kind: 'move', dir });
}

export function botEncounter(state: GameState, pid: PlayerId): EncounterPayload {
  const p = state.players[pid];
  const pend = pendingFor(state, pid);
  if (!p || !pend || pend.type !== 'enc') return { choice: 'hide' };
  const foe = pend.foe;
  const partner = pend.partner;
  const find = (pred: (id: string) => boolean) => p.inventory.find((i) => pred(i.defId))?.uid;
  const molotov = find((id) => id === 'molotov');
  const pipe = foe === 'zombie' ? find((id) => id === 'pipebomb') : undefined;
  const smoke = find((id) => id === 'smoke');
  const adren = find((id) => id === 'adrenaline');
  const dmg = foe === 'horde' ? BALANCE.HORDE_DAMAGE : BALANCE.ZOMBIE_DAMAGE;

  if (pipe) return { choice: partner ? 'team' : 'fight', item: pipe };
  if (molotov && foe === 'horde') return { choice: partner ? 'team' : 'fight', item: molotov };

  const fight = encounterOdds(state, pid, foe, 'fight').chance;
  const flee = encounterOdds(state, pid, foe, 'flee').chance;
  if (partner) {
    const team = encounterOdds(state, pid, foe, 'team', undefined, partner).chance;
    if (team >= 0.5) return { choice: 'team' };
  }
  if (fight >= 0.58) return { choice: 'fight', ...(adren && fight < 0.8 ? { item: adren } : {}) };
  if (molotov) return { choice: 'fight', item: molotov };
  if (smoke) return { choice: 'flee', item: smoke };
  if (flee >= 0.5) return { choice: 'flee', ...(adren && flee < 0.75 ? { item: adren } : {}) };
  if (p.hp <= dmg && !p.hidden) return { choice: 'hide' };
  return fight >= flee ? { choice: 'fight' } : { choice: 'flee' };
}

/** Produce the input a bot would submit for its current pending requirement, if any. */
export function botInput(state: GameState, pid: PlayerId): GameInput | null {
  const pend = pendingFor(state, pid);
  if (!pend) return null;
  if (pend.type === 'action') return { round: state.round, playerId: pid, type: 'action', n: 0, payload: botAction(state, pid) };
  return { round: state.round, playerId: pid, type: 'enc', n: 0, payload: botEncounter(state, pid) };
}
