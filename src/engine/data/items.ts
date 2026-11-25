import type { Mods } from '../types';

export type ItemSlot = 'weapon' | 'armor' | 'tool' | 'consumable';
export type Rarity = 'common' | 'uncommon' | 'rare';

export type ItemEffect =
  | { kind: 'heal'; amount: number }
  | { kind: 'adrenaline' }
  /** auto-success on Fight; `hordeToo` false means single zombies only */
  | { kind: 'autoFight'; hordeToo: boolean }
  | { kind: 'autoFlee' };

export interface ItemDef {
  id: string;
  name: string;
  icon: string;
  slot: ItemSlot;
  rarity: Rarity;
  mods?: Mods;
  effect?: ItemEffect;
  /** special flags checked by events */
  flags?: ('gasmask')[];
  desc: string;
  flavor: string;
  /** false = cannot be found as loot (crafted only) */
  lootable?: boolean;
}

export const ITEMS: readonly ItemDef[] = [
  // weapons
  { id: 'rebar', name: 'Rebar Club', icon: '🔩', slot: 'weapon', rarity: 'common', mods: { combat: 1 }, desc: '+1 Combat', flavor: 'Bent steel. Heavier than it looks.' },
  { id: 'knife', name: 'Butcher Knife', icon: '🔪', slot: 'weapon', rarity: 'common', mods: { combat: 1 }, desc: '+1 Combat', flavor: 'Still smells of the shop.' },
  { id: 'axe', name: 'Fire Axe', icon: '🪓', slot: 'weapon', rarity: 'uncommon', mods: { combat: 2 }, desc: '+2 Combat', flavor: 'Break glass in case of the end of the world.' },
  { id: 'machete', name: 'Machete', icon: '🗡️', slot: 'weapon', rarity: 'uncommon', mods: { combat: 2 }, desc: '+2 Combat', flavor: 'Someone kept it sharp. They are not here now.' },
  { id: 'nailgun', name: 'Nail Gun', icon: '🔫', slot: 'weapon', rarity: 'rare', mods: { combat: 3 }, desc: '+3 Combat', flavor: 'Battery at half. Mercy at none.' },
  { id: 'shotgun', name: 'Sawn-off Shotgun', icon: '💥', slot: 'weapon', rarity: 'rare', mods: { combat: 3 }, desc: '+3 Combat', flavor: 'Loud. Everything hears it. Everything stops.' },
  // armor
  { id: 'jacket', name: 'Padded Jacket', icon: '🧥', slot: 'armor', rarity: 'common', mods: { armor: 1 }, desc: '1 armor', flavor: 'Teeth catch in the stuffing.' },
  { id: 'leathers', name: 'Biker Leathers', icon: '🦺', slot: 'armor', rarity: 'uncommon', mods: { armor: 1, evasion: 1 }, desc: '1 armor, +1 Evasion', flavor: 'Built for falling at speed.' },
  { id: 'riotvest', name: 'Riot Vest', icon: '🛡️', slot: 'armor', rarity: 'rare', mods: { armor: 2 }, desc: '2 armor', flavor: 'POLICE, in letters nobody obeys anymore.' },
  // tools
  { id: 'shoes', name: 'Running Shoes', icon: '👟', slot: 'tool', rarity: 'common', mods: { evasion: 1 }, desc: '+1 Evasion', flavor: 'Laces double-knotted. Lesson learned.' },
  { id: 'crowbar', name: 'Crowbar', icon: '🪛', slot: 'tool', rarity: 'common', mods: { scavenging: 1 }, desc: '+1 Scavenging', flavor: 'Every locked door is a suggestion.' },
  { id: 'flashlight', name: 'Flashlight', icon: '🔦', slot: 'tool', rarity: 'uncommon', mods: { vision: 1 }, desc: '+1 vision range', flavor: 'The dark is smaller with it. Not gone.' },
  { id: 'hook', name: 'Grappling Hook', icon: '🪝', slot: 'tool', rarity: 'uncommon', mods: { evasion: 2 }, desc: '+2 Evasion', flavor: 'Up is an exit too.' },
  { id: 'lockpicks', name: 'Lockpick Set', icon: '🗝️', slot: 'tool', rarity: 'uncommon', mods: { scavenging: 2 }, desc: '+2 Scavenging', flavor: 'Quiet hands. Full pockets.' },
  { id: 'gasmask', name: 'Gas Mask', icon: '😷', slot: 'tool', rarity: 'uncommon', flags: ['gasmask'], mods: { waveResist: 1 }, desc: 'Immune to radiation. -1 wave damage.', flavor: 'Your breath, loud as a stranger.' },
  // consumables
  { id: 'bandages', name: 'Bandages', icon: '🩹', slot: 'consumable', rarity: 'common', effect: { kind: 'heal', amount: 2 }, desc: 'Heal 2 HP', flavor: 'Grey, but clean enough.' },
  { id: 'firstaid', name: 'First Aid Kit', icon: '🧰', slot: 'consumable', rarity: 'common', effect: { kind: 'heal', amount: 4 }, desc: 'Heal 4 HP', flavor: 'Half the labels are in a language that no longer matters.' },
  { id: 'painkillers', name: 'Painkillers', icon: '💊', slot: 'consumable', rarity: 'uncommon', effect: { kind: 'heal', amount: 3 }, desc: 'Heal 3 HP', flavor: 'Expired. Still works. Mostly.' },
  { id: 'adrenaline', name: 'Adrenaline Shot', icon: '💉', slot: 'consumable', rarity: 'uncommon', effect: { kind: 'adrenaline' }, desc: '+3 to your next roll', flavor: 'Your heart becomes a fist.' },
  { id: 'molotov', name: 'Molotov', icon: '🍾', slot: 'consumable', rarity: 'uncommon', effect: { kind: 'autoFight', hordeToo: true }, desc: 'Win a fight automatically', flavor: 'They burn slower than you would like.' },
  { id: 'smoke', name: 'Smoke Bomb', icon: '💨', slot: 'consumable', rarity: 'uncommon', effect: { kind: 'autoFlee' }, desc: 'Flee automatically', flavor: 'Grey wall. You on the other side of it.' },
  { id: 'pipebomb', name: 'Pipe Bomb', icon: '🧨', slot: 'consumable', rarity: 'rare', effect: { kind: 'autoFight', hordeToo: false }, desc: 'Win a fight vs a single zombie', flavor: 'Fuse cut short. No time for long goodbyes.' },
];

const BY_ID: Record<string, ItemDef> = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

export function itemDef(id: string): ItemDef {
  const def = BY_ID[id];
  if (!def) throw new Error(`Unknown item: ${id}`);
  return def;
}

export function isKnownItem(id: string): boolean {
  return id in BY_ID;
}

export const LOOT_TABLE: readonly ItemDef[] = ITEMS.filter((i) => i.lootable !== false);
