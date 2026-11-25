import { isClassId } from '../engine/data/classes';
import { isValidInput } from '../engine/inputs';
import type { ClassId, GameInput } from '../engine/types';

/** Lobby presence. Ephemeral: never persisted, re-broadcast as a heartbeat. */
export interface Presence {
  playerId: string;
  name: string;
  classId: ClassId | null;
  startPerk: string | null;
  ready: boolean;
  host: boolean;
  /** ms since epoch when this client first entered the room (join order for the roster) */
  since: number;
}

export type NetMessage =
  | { t: 'hello'; playerId: string; keys: string[]; reply?: boolean }
  | { t: 'inputs'; inputs: GameInput[] }
  | { t: 'sum'; count: number; hash: string }
  | { t: 'presence'; p: Presence }
  | { t: 'bye'; playerId: string };

const NAME_MAX = 24;

function isPresence(v: unknown): v is Presence {
  if (typeof v !== 'object' || v === null) return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.playerId === 'string' &&
    typeof p.name === 'string' &&
    p.name.length <= NAME_MAX * 2 &&
    (p.classId === null || (typeof p.classId === 'string' && isClassId(p.classId))) &&
    (p.startPerk === null || typeof p.startPerk === 'string') &&
    typeof p.ready === 'boolean' &&
    typeof p.host === 'boolean' &&
    typeof p.since === 'number'
  );
}

/** Validate an incoming message; invalid inputs inside an `inputs` message are filtered out. */
export function parseMessage(v: unknown): NetMessage | null {
  if (typeof v !== 'object' || v === null) return null;
  const m = v as Record<string, unknown>;
  switch (m.t) {
    case 'hello':
      return typeof m.playerId === 'string' && Array.isArray(m.keys) && m.keys.every((k) => typeof k === 'string')
        ? { t: 'hello', playerId: m.playerId, keys: m.keys as string[], reply: m.reply === true }
        : null;
    case 'inputs':
      return Array.isArray(m.inputs) ? { t: 'inputs', inputs: m.inputs.filter(isValidInput) } : null;
    case 'sum':
      return typeof m.count === 'number' && typeof m.hash === 'string' ? { t: 'sum', count: m.count, hash: m.hash } : null;
    case 'presence':
      return isPresence(m.p) ? { t: 'presence', p: m.p } : null;
    case 'bye':
      return typeof m.playerId === 'string' ? { t: 'bye', playerId: m.playerId } : null;
    default:
      return null;
  }
}

export const MAX_NAME_LENGTH = NAME_MAX;
