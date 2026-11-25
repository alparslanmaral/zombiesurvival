import { useEffect, useState, useSyncExternalStore } from 'react';
import { GameSession, type SessionSnapshot } from '../session/session';
import { attachLifecycle } from '../session/lifecycle';
import { LocalRoomStorage } from '../session/storage';
import { botsParam, createTransport, type Identity } from './net';

const storage = new LocalRoomStorage();

export function roomIsSolo(code: string): number {
  return storage.loadMeta(code)?.bots ?? 0;
}

export function markRoom(code: string, meta: { host?: boolean; bots?: number }): void {
  storage.saveMeta(code, { ...(storage.loadMeta(code) ?? {}), ...meta, createdAt: Date.now() });
}

/** One GameSession per mounted room. */
export function useGameSession(code: string, me: Identity): GameSession | null {
  const [session, setSession] = useState<GameSession | null>(null);
  useEffect(() => {
    const bots = roomIsSolo(code) || botsParam();
    if (bots && !storage.loadMeta(code)?.bots) markRoom(code, { bots, host: true });
    const s = new GameSession({
      room: code,
      playerId: me.id,
      name: me.name || 'Survivor',
      transport: createTransport(bots > 0),
      storage,
      bots,
    });
    const detach = attachLifecycle(s);
    void s.start();
    setSession(s);
    return () => {
      detach();
      void s.stop();
    };
  }, [code, me.id, me.name]);
  return session;
}

const EMPTY = () => () => {};

export function useSnapshot(session: GameSession | null): SessionSnapshot | null {
  return useSyncExternalStore(session ? session.subscribe : EMPTY, session ? session.getSnapshot : () => null);
}
