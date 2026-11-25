import { BALANCE } from './balance';
import { classDef, perkDef } from './data/classes';
import { itemDef } from './data/items';
import type { Mods, PlayerState, StatId } from './types';

type ModKey = keyof Mods;

/** Sum of a modifier across perks. */
export function perkMod(p: PlayerState, key: ModKey): number {
  let s = 0;
  for (const id of p.perks) s += perkDef(id).mods[key] ?? 0;
  return s;
}

/** Best (max) value of a modifier across carried items. Gear does not stack. */
export function itemMod(p: PlayerState, key: ModKey): number {
  let best = 0;
  for (const it of p.inventory) best = Math.max(best, itemDef(it.defId).mods?.[key] ?? 0);
  return best;
}

export function stat(p: PlayerState, s: StatId): number {
  return classDef(p.classId)[s] + itemMod(p, s) + perkMod(p, s);
}

export function armor(p: PlayerState): number {
  return itemMod(p, 'armor') + perkMod(p, 'armor') + (p.classId === 'guardian' ? BALANCE.GUARDIAN_ARMOR : 0);
}

export function maxHp(p: PlayerState): number {
  return classDef(p.classId).hp + perkMod(p, 'maxHp');
}

export function vision(p: PlayerState): number {
  const base = p.classId === 'scout' ? BALANCE.SCOUT_VISION : BALANCE.VISION;
  return base + itemMod(p, 'vision') + perkMod(p, 'vision');
}

export function slots(p: PlayerState): number {
  return BALANCE.BASE_SLOTS + perkMod(p, 'slots');
}

export function fleeDifficulty(p: PlayerState): number {
  return BALANCE.FLEE_DIFFICULTY + perkMod(p, 'fleeDiff') + (p.classId === 'guardian' ? BALANCE.GUARDIAN_FLEE_PENALTY : 0);
}

export function hideDifficulty(p: PlayerState): number {
  return BALANCE.HIDE_DIFFICULTY + perkMod(p, 'hideDiff');
}

export function secondDrawDifficulty(p: PlayerState): number {
  return (
    BALANCE.SECOND_DRAW_DIFFICULTY +
    perkMod(p, 'lootDiff') -
    (p.classId === 'scavenger' ? BALANCE.SCAVENGER_SECOND_DRAW_BONUS : 0)
  );
}

export function healAmount(p: PlayerState, base: number): number {
  const mult = p.classId === 'medic' ? BALANCE.MEDIC_HEAL_MULTIPLIER : 1;
  return base * mult + perkMod(p, 'healBonus');
}

export function shelterHeal(p: PlayerState): number {
  return BALANCE.SHELTER_HEAL + perkMod(p, 'shelterHeal');
}

export function waveResist(p: PlayerState): number {
  return itemMod(p, 'waveResist') + perkMod(p, 'waveResist');
}

export function koRounds(p: PlayerState): number {
  return Math.max(1, BALANCE.KO_SKIP_ROUNDS + perkMod(p, 'koRounds'));
}

export function craftCooldown(p: PlayerState): number {
  return Math.max(1, BALANCE.ENGINEER_CRAFT_COOLDOWN + perkMod(p, 'craftCooldown'));
}

export function openPathCooldown(p: PlayerState): number {
  return Math.max(1, BALANCE.ENGINEER_OPEN_PATH_COOLDOWN + perkMod(p, 'openPathCooldown'));
}

export function teamBonus(p: PlayerState): number {
  return perkMod(p, 'teamBonus');
}

export function hasFlag(p: PlayerState, flag: 'gasmask'): boolean {
  return p.inventory.some((i) => itemDef(i.defId).flags?.includes(flag));
}

/** Probability that 2d6 + mod >= difficulty, honoring double-6 auto success and double-1 auto failure. */
export function successChance(mod: number, difficulty: number): number {
  let ok = 0;
  for (let a = 1; a <= 6; a++) {
    for (let b = 1; b <= 6; b++) {
      if (a === 6 && b === 6) ok++;
      else if (a === 1 && b === 1) continue;
      else if (a + b + mod >= difficulty) ok++;
    }
  }
  return ok / 36;
}
