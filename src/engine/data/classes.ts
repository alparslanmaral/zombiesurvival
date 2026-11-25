import type { ClassId, Mods } from '../types';

export interface PerkDef {
  id: string;
  name: string;
  desc: string;
  mods: Mods;
}

export interface ClassDef {
  id: ClassId;
  name: string;
  icon: string;
  tagline: string;
  combat: number;
  evasion: number;
  scavenging: number;
  hp: number;
  passive: string;
  startPerks: [string, string];
  /** item ids carried from the start */
  startItems: string[];
  pool: [string, string, string];
}

export const PERKS: readonly PerkDef[] = [
  // scout
  { id: 'low_profile', name: 'Low Profile', desc: 'Hide difficulty -2.', mods: { hideDiff: -2 } },
  { id: 'rooftop_eyes', name: 'Rooftop Eyes', desc: '+1 vision range.', mods: { vision: 1 } },
  { id: 'ghost_step', name: 'Ghost Step', desc: 'Flee difficulty -2.', mods: { fleeDiff: -2 } },
  { id: 'shadow', name: 'Shadow', desc: 'Hide difficulty -2, +1 Evasion.', mods: { hideDiff: -2, evasion: 1 } },
  { id: 'wind_runner', name: 'Wind Runner', desc: '+1 Evasion, -1 wave damage.', mods: { evasion: 1, waveResist: 1 } },
  // scavenger
  { id: 'deep_pockets', name: 'Deep Pockets', desc: '+1 inventory slot.', mods: { slots: 1 } },
  { id: 'sharp_eye', name: 'Sharp Eye', desc: '+1 Scavenging.', mods: { scavenging: 1 } },
  { id: 'hoarder', name: 'Hoarder', desc: 'Second loot draw difficulty -2.', mods: { lootDiff: -2 } },
  { id: 'field_kitchen', name: 'Field Kitchen', desc: 'Shelters heal +2 more.', mods: { shelterHeal: 2 } },
  { id: 'lucky_find', name: 'Lucky Find', desc: '+1 Scavenging, +1 Evasion.', mods: { scavenging: 1, evasion: 1 } },
  // guardian
  { id: 'iron_skin', name: 'Iron Skin', desc: '+1 armor.', mods: { armor: 1 } },
  { id: 'brawler', name: 'Brawler', desc: '+1 Combat.', mods: { combat: 1 } },
  { id: 'unbreakable', name: 'Unbreakable', desc: '+3 max HP.', mods: { maxHp: 3 } },
  { id: 'cleaver', name: 'Cleaver', desc: '+1 Combat.', mods: { combat: 1 } },
  { id: 'shield_wall', name: 'Shield Wall', desc: 'Team fights +2.', mods: { teamBonus: 2 } },
  // medic
  { id: 'triage', name: 'Triage', desc: 'Every heal +1.', mods: { healBonus: 1 } },
  { id: 'steady_pulse', name: 'Steady Pulse', desc: '+2 max HP.', mods: { maxHp: 2 } },
  { id: 'field_surgeon', name: 'Field Surgeon', desc: 'Shelters heal +2 more.', mods: { shelterHeal: 2 } },
  { id: 'stimulants', name: 'Stimulants', desc: 'Knockouts last 1 round less.', mods: { koRounds: -1 } },
  { id: 'calm_nerves', name: 'Calm Nerves', desc: 'Hide difficulty -2, +1 Evasion.', mods: { hideDiff: -2, evasion: 1 } },
  // engineer
  { id: 'tinkerer', name: 'Tinkerer', desc: 'Craft cooldown -1.', mods: { craftCooldown: -1 } },
  { id: 'rigger', name: 'Rigger', desc: 'Open Path cooldown -2.', mods: { openPathCooldown: -2 } },
  { id: 'scrap_armor', name: 'Scrap Armor', desc: '+1 armor.', mods: { armor: 1 } },
  { id: 'lockpick', name: 'Lockpick', desc: '+1 Scavenging.', mods: { scavenging: 1 } },
  { id: 'spring_trap', name: 'Spring Trap', desc: '+1 Combat.', mods: { combat: 1 } },
  // generic filler
  { id: 'hardened', name: 'Hardened', desc: '+2 max HP.', mods: { maxHp: 2 } },
  { id: 'grit', name: 'Grit', desc: '+1 Combat.', mods: { combat: 1 } },
  { id: 'quick', name: 'Quick', desc: '+1 Evasion.', mods: { evasion: 1 } },
  { id: 'scrounger', name: 'Scrounger', desc: '+1 Scavenging.', mods: { scavenging: 1 } },
];

export const GENERIC_PERKS: readonly string[] = ['hardened', 'grit', 'quick', 'scrounger'];

export const CLASSES: readonly ClassDef[] = [
  {
    id: 'scout',
    name: 'Scout',
    icon: '🧭',
    tagline: 'Sees the street before the street sees you.',
    combat: 0,
    evasion: 3,
    scavenging: 2,
    hp: 9,
    passive: 'Sees 2 cells away instead of 1.',
    startPerks: ['low_profile', 'rooftop_eyes'],
    startItems: [],
    pool: ['ghost_step', 'shadow', 'wind_runner'],
  },
  {
    id: 'scavenger',
    name: 'Scavenger',
    icon: '🎒',
    tagline: 'Leaves nothing behind but empty shelves.',
    combat: 2,
    evasion: 2,
    scavenging: 3,
    hp: 10,
    passive: 'Starts with a Crowbar. Second loot draw is easier; may find a third item.',
    startPerks: ['deep_pockets', 'sharp_eye'],
    startItems: ['crowbar'],
    pool: ['hoarder', 'field_kitchen', 'lucky_find'],
  },
  {
    id: 'guardian',
    name: 'Guardian',
    icon: '🛡️',
    tagline: 'Walks into the dark so others can walk out.',
    combat: 3,
    evasion: 0,
    scavenging: 1,
    hp: 12,
    passive: '+1 armor. Flee difficulty +1.',
    startPerks: ['iron_skin', 'brawler'],
    startItems: [],
    pool: ['unbreakable', 'cleaver', 'shield_wall'],
  },
  {
    id: 'medic',
    name: 'Medic',
    icon: '⚕️',
    tagline: 'Keeps the living that way. Mostly.',
    combat: 2,
    evasion: 2,
    scavenging: 1,
    hp: 10,
    passive: 'Starts with a First Aid Kit. Healing items heal double, resting heals +1 more. Heals a partner after a team fight.',
    startPerks: ['triage', 'steady_pulse'],
    startItems: ['firstaid'],
    pool: ['field_surgeon', 'stimulants', 'calm_nerves'],
  },
  {
    id: 'engineer',
    name: 'Engineer',
    icon: '🔧',
    tagline: 'Every wall is a door with bad manners.',
    combat: 1,
    evasion: 2,
    scavenging: 2,
    hp: 10,
    passive: 'Craft (rest round): build a Pipe Bomb. Open Path: spend a round clearing adjacent rubble for everyone.',
    startPerks: ['tinkerer', 'rigger'],
    startItems: [],
    pool: ['scrap_armor', 'lockpick', 'spring_trap'],
  },
];

const PERK_BY_ID: Record<string, PerkDef> = Object.fromEntries(PERKS.map((p) => [p.id, p]));
const CLASS_BY_ID: Record<string, ClassDef> = Object.fromEntries(CLASSES.map((c) => [c.id, c]));

export function perkDef(id: string): PerkDef {
  const def = PERK_BY_ID[id];
  if (!def) throw new Error(`Unknown perk: ${id}`);
  return def;
}

export function isKnownPerk(id: string): boolean {
  return id in PERK_BY_ID;
}

export function classDef(id: ClassId): ClassDef {
  const def = CLASS_BY_ID[id];
  if (!def) throw new Error(`Unknown class: ${id}`);
  return def;
}

export function isClassId(id: string): id is ClassId {
  return id in CLASS_BY_ID;
}

export const PLAYER_COLORS = ['#e8b04b', '#4fb3e8', '#e0605a', '#7fd65e'] as const;
