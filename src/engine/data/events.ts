import type { StatId } from '../types';

export type EventEffect =
  | { kind: 'radiation'; damage: number }
  | { kind: 'freeLoot'; draws: number; bonusDifficulty: number }
  | { kind: 'check'; stat: StatId; difficulty: number; damage: number; rewardDraws: number }
  | { kind: 'tunnel'; rows: number }
  | { kind: 'giveItem'; item: string }
  | { kind: 'reveal'; rowsAhead: number; halfWidth: number };

export interface EventDef {
  id: string;
  name: string;
  icon: string;
  text: string;
  success?: string;
  failure?: string;
  effect: EventEffect;
}

export const EVENTS: readonly EventDef[] = [
  {
    id: 'radiation',
    name: 'Radiation Leak',
    icon: '☢️',
    text: 'A cracked drum hisses in the dark. The air tastes of copper.',
    success: 'The mask fogs. The filter holds.',
    failure: 'Your gums start to bleed.',
    effect: { kind: 'radiation', damage: 2 },
  },
  {
    id: 'depot',
    name: 'Abandoned Depot',
    icon: '🏚️',
    text: 'Shelves, mostly bare. Mostly.',
    effect: { kind: 'freeLoot', draws: 1, bonusDifficulty: 8 },
  },
  {
    id: 'ambush',
    name: 'Ambush',
    icon: '🩸',
    text: 'They were waiting under the cars.',
    success: 'You are already gone when the hands close.',
    failure: 'Teeth find your calf before you find your footing.',
    effect: { kind: 'check', stat: 'evasion', difficulty: 8, damage: 2, rewardDraws: 0 },
  },
  {
    id: 'tunnel',
    name: 'Tunnel Shortcut',
    icon: '🚇',
    text: 'A maintenance tunnel runs north. The tunnel breathes. Something breathes back.',
    effect: { kind: 'tunnel', rows: 1 },
  },
  {
    id: 'stranger',
    name: 'Dying Stranger',
    icon: '🫱',
    text: 'He presses a kit into your hands. "Go north." He does not follow.',
    effect: { kind: 'giveItem', item: 'firstaid' },
  },
  {
    id: 'collapse',
    name: 'Collapsed Floor',
    icon: '🕳️',
    text: 'The floor gives. Concrete is only a promise.',
    success: 'You catch the edge. Something below catches nothing.',
    failure: 'You land hard on what used to be the basement.',
    effect: { kind: 'check', stat: 'evasion', difficulty: 7, damage: 2, rewardDraws: 0 },
  },
  {
    id: 'radio',
    name: 'Radio Broadcast',
    icon: '📻',
    text: 'A looped message: "Safe Zone holding. Keep moving." The voice is very old. You mark the streets it names.',
    effect: { kind: 'reveal', rowsAhead: 3, halfWidth: 1 },
  },
  {
    id: 'dogs',
    name: 'Feral Dogs',
    icon: '🐕',
    text: 'The dogs ate well this year. They want to keep it that way.',
    success: 'The pack breaks. One leaves a collar and a stash behind.',
    failure: 'They take their share of you and vanish.',
    effect: { kind: 'check', stat: 'combat', difficulty: 8, damage: 2, rewardDraws: 1 },
  },
];

const BY_ID: Record<string, EventDef> = Object.fromEntries(EVENTS.map((e) => [e.id, e]));

export function eventDef(id: string): EventDef {
  const def = BY_ID[id];
  if (!def) throw new Error(`Unknown event: ${id}`);
  return def;
}
