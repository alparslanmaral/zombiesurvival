import { isClassId } from './data/classes';
import { hashString } from './rng';
import type { GameInput, InputType } from './types';

export function inputKey(i: Pick<GameInput, 'round' | 'playerId' | 'type' | 'n'>): string {
  return `${i.round}:${i.playerId}:${i.type}:${i.n}`;
}

/** JSON with sorted object keys, so equal values always serialize identically. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`;
}

const TYPES: readonly InputType[] = ['start', 'action', 'enc', 'force', 'next'];
const DIRS = ['N', 'E', 'S', 'W'];
const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Structural validation for inputs received from the network or storage.
 * Semantic validity (e.g. moving into a wall) is the engine's job.
 */
export function isValidInput(v: unknown): v is GameInput {
  if (!isObj(v)) return false;
  const { round, playerId, type, n, payload } = v;
  if (typeof round !== 'number' || !Number.isInteger(round) || round < 0 || round > 10_000) return false;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > 1000) return false;
  if (typeof playerId !== 'string' || !ID_RE.test(playerId)) return false;
  if (typeof type !== 'string' || !TYPES.includes(type as InputType)) return false;
  if (!isObj(payload)) return false;
  switch (type as InputType) {
    case 'start': {
      if (typeof payload.seed !== 'string' || payload.seed.length > 100) return false;
      const roster = payload.roster;
      if (!Array.isArray(roster) || roster.length < 1 || roster.length > 8) return false;
      return roster.every(
        (r) =>
          isObj(r) &&
          typeof r.id === 'string' &&
          ID_RE.test(r.id) &&
          typeof r.name === 'string' &&
          r.name.length <= 40 &&
          typeof r.classId === 'string' &&
          isClassId(r.classId) &&
          typeof r.startPerk === 'string',
      );
    }
    case 'action': {
      const k = payload.kind;
      if (payload.perk !== undefined && typeof payload.perk !== 'string') return false;
      if (k === 'wait' || k === 'craft') return true;
      if (k === 'move' || k === 'openPath') return typeof payload.dir === 'string' && DIRS.includes(payload.dir);
      if (k === 'use') return typeof payload.item === 'string';
      return false;
    }
    case 'enc':
      return (
        ['fight', 'flee', 'hide', 'team'].includes(payload.choice as string) &&
        (payload.item === undefined || typeof payload.item === 'string')
      );
    case 'force':
      return typeof payload.by === 'string';
    case 'next':
      return typeof payload.room === 'string' && payload.room.length <= 20;
  }
}

/**
 * Grow-only input set. Same key twice is idempotent; if two different payloads
 * ever share a key (e.g. the same player in two tabs), the one with the smallest
 * canonical JSON wins on every client, independent of arrival order.
 */
export class InputSet {
  private map = new Map<string, { input: GameInput; json: string }>();
  private _version = 0;

  constructor(inputs: Iterable<GameInput> = []) {
    for (const i of inputs) this.add(i);
  }

  get version(): number {
    return this._version;
  }

  get size(): number {
    return this.map.size;
  }

  /** Returns true if the set changed. */
  add(input: GameInput): boolean {
    if (!isValidInput(input)) return false;
    const key = inputKey(input);
    const json = canonicalJson(input);
    const existing = this.map.get(key);
    if (existing && existing.json <= json) return false;
    this.map.set(key, { input: JSON.parse(json) as GameInput, json });
    this._version++;
    return true;
  }

  addAll(inputs: Iterable<GameInput>): GameInput[] {
    const added: GameInput[] = [];
    for (const i of inputs) if (this.add(i)) added.push(i);
    return added;
  }

  has(key: string): boolean {
    return this.map.has(key);
  }

  get(key: string): GameInput | undefined {
    return this.map.get(key)?.input;
  }

  keys(): string[] {
    return [...this.map.keys()];
  }

  values(): GameInput[] {
    return [...this.map.values()].map((v) => v.input);
  }

  /** Inputs whose keys are not in `known`. */
  missingFrom(known: Iterable<string>): GameInput[] {
    const k = new Set(known);
    return [...this.map.entries()].filter(([key]) => !k.has(key)).map(([, v]) => v.input);
  }

  /** Order-independent digest for anti-entropy. */
  digest(): { count: number; hash: string } {
    const parts = [...this.map.values()].map((v) => v.json).sort();
    return { count: parts.length, hash: hashString(parts.join('\n')) };
  }
}
