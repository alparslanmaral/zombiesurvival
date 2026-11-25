import { STORAGE_PREFIX } from '../config';
import { isValidInput } from '../engine/inputs';
import type { GameInput } from '../engine/types';

/** Persistence for inputs and per-room metadata. Every client keeps the full history. */
export interface RoomStorage {
  loadInputs(room: string): GameInput[];
  saveInputs(room: string, inputs: GameInput[]): void;
  loadMeta(room: string): RoomMeta | null;
  saveMeta(room: string, meta: RoomMeta): void;
}

export interface RoomMeta {
  /** this client created the room */
  host?: boolean;
  /** solo game against bots */
  bots?: number;
  createdAt?: number;
  lastSeen?: number;
}

export class MemoryStorage implements RoomStorage {
  private inputs = new Map<string, GameInput[]>();
  private meta = new Map<string, RoomMeta>();
  loadInputs(room: string): GameInput[] {
    return (this.inputs.get(room) ?? []).map((i) => JSON.parse(JSON.stringify(i)) as GameInput);
  }
  saveInputs(room: string, inputs: GameInput[]): void {
    this.inputs.set(room, JSON.parse(JSON.stringify(inputs)) as GameInput[]);
  }
  loadMeta(room: string): RoomMeta | null {
    return this.meta.get(room) ?? null;
  }
  saveMeta(room: string, meta: RoomMeta): void {
    this.meta.set(room, { ...meta });
  }
}

export class LocalRoomStorage implements RoomStorage {
  private key(room: string, what: string): string {
    return `${STORAGE_PREFIX}:room:${room}:${what}`;
  }
  loadInputs(room: string): GameInput[] {
    try {
      const raw = localStorage.getItem(this.key(room, 'inputs'));
      const arr: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter(isValidInput) : [];
    } catch {
      return [];
    }
  }
  saveInputs(room: string, inputs: GameInput[]): void {
    try {
      // Merge with what another tab may have written meanwhile: the set is grow-only.
      const existing = this.loadInputs(room);
      const seen = new Set(inputs.map((i) => `${i.round}:${i.playerId}:${i.type}:${i.n}`));
      const merged = [...inputs, ...existing.filter((i) => !seen.has(`${i.round}:${i.playerId}:${i.type}:${i.n}`))];
      localStorage.setItem(this.key(room, 'inputs'), JSON.stringify(merged));
    } catch (e) {
      console.warn('Could not persist inputs', e);
    }
  }
  loadMeta(room: string): RoomMeta | null {
    try {
      const raw = localStorage.getItem(this.key(room, 'meta'));
      return raw ? (JSON.parse(raw) as RoomMeta) : null;
    } catch {
      return null;
    }
  }
  saveMeta(room: string, meta: RoomMeta): void {
    try {
      localStorage.setItem(this.key(room, 'meta'), JSON.stringify(meta));
    } catch {
      /* storage full or unavailable: the game still works in memory */
    }
  }
}
