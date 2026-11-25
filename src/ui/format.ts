import { itemDef } from '../engine/data/items';
import { perkDef } from '../engine/data/classes';
import type { ActionPayload, Cell, Dir, GameState, PlayerState } from '../engine/types';

export const DIR_ARROW: Record<Dir, string> = { NE: '↗', E: '→', SE: '↘', SW: '↙', W: '←', NW: '↖' };
export const DIR_NAME: Record<Dir, string> = { NE: 'north-east', E: 'east', SE: 'south-east', SW: 'south-west', W: 'west', NW: 'north-west' };

export function cellName(c: Cell): string {
  switch (c.type) {
    case 'safe':
      return 'Safe Zone';
    case 'start':
      return 'The City';
    case 'empty':
      return 'Empty street';
    case 'loot':
      return c.cleared ? 'Picked clean' : 'Loot';
    case 'zombie':
      return c.cleared ? 'Cleared' : 'Walker';
    case 'horde':
      return c.cleared ? 'Cleared' : 'Horde';
    case 'event':
      return c.cleared ? 'Spent' : 'Something here';
    case 'shelter':
      return 'Shelter';
    case 'blocked':
      return 'Barricade';
    case 'ruin':
      return 'Ruins';
  }
}

export function actionLabel(a: ActionPayload | 'forced', p?: PlayerState): string {
  if (a === 'forced') return 'Skipped (wait)';
  switch (a.kind) {
    case 'move':
      return `Move ${DIR_ARROW[a.dir]}`;
    case 'wait':
      return 'Wait';
    case 'use': {
      const it = p?.inventory.find((i) => i.uid === a.item);
      return it ? `Use ${itemDef(it.defId).name}` : 'Use item';
    }
    case 'craft':
      return 'Craft';
    case 'openPath':
      return `Open Path ${DIR_ARROW[a.dir]}`;
  }
}

export function perkName(id: string): string {
  try {
    return perkDef(id).name;
  } catch {
    return id;
  }
}

export function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

export function nameOf(state: GameState, id: string): string {
  return state.players[id]?.name ?? state.roster.find((r) => r.id === id)?.name ?? 'someone';
}

export function listNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
