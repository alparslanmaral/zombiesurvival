import { describe, expect, it } from 'vitest';
import { deriveState } from '../src/engine/engine';
import { canonicalJson } from '../src/engine/inputs';
import type { GameInput } from '../src/engine/types';
import { MemoryHub, MemoryTransport } from '../src/net/memory';
import { GameSession } from '../src/session/session';
import { MemoryStorage } from '../src/session/storage';

const flush = async (n = 10) => {
  for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0));
};

function mk(hub: MemoryHub, playerId: string, opts: { storage?: MemoryStorage; host?: boolean; clock?: { t: number } } = {}) {
  const clock = opts.clock;
  return new GameSession({
    room: 'ROOM',
    playerId,
    name: playerId.toUpperCase(),
    transport: new MemoryTransport(hub),
    storage: opts.storage ?? new MemoryStorage(),
    host: opts.host ?? false,
    manualTimers: true,
    ...(clock ? { now: () => clock.t } : {}),
  });
}

const act = (round: number, playerId: string, kind: 'wait' | 'move' = 'wait'): GameInput => ({
  round,
  playerId,
  type: 'action',
  n: 0,
  payload: kind === 'wait' ? { kind: 'wait' } : { kind: 'move', dir: 'N' },
});

async function lobbyAndStart(hub: MemoryHub) {
  const a = mk(hub, 'alice', { host: true });
  const b = mk(hub, 'bob');
  await a.start();
  await b.start();
  await flush();
  a.setLobby({ classId: 'scout', ready: true });
  b.setLobby({ classId: 'guardian', ready: true });
  await flush();
  expect(a.canStart()).toBe(true);
  expect(b.canStart()).toBe(false);
  expect(a.startGame('seed-1')).toBe(true);
  await flush();
  return { a, b };
}

describe('session sync', () => {
  it('lobby presence and start propagate', async () => {
    const hub = new MemoryHub();
    const { a, b } = await lobbyAndStart(hub);
    expect(b.state.phase).toBe('plan');
    expect(b.state.roster.map((r) => r.id)).toEqual(['alice', 'bob']);
    expect(canonicalJson(a.state)).toBe(canonicalJson(b.state));
  });

  it('merges inputs made while disconnected (reconnect merge)', async () => {
    const hub = new MemoryHub();
    const { a, b } = await lobbyAndStart(hub);
    // partition: both act while offline
    hub.online = false;
    a.submit(act(1, 'alice'));
    b.submit(act(1, 'bob'));
    await flush();
    expect(a.store.size).toBe(2);
    expect(b.store.size).toBe(2);
    hub.online = true;
    // reconnect: leave and rejoin triggers hello exchange (union merge)
    await b.rejoin();
    await flush(20);
    expect(a.store.size).toBe(3);
    expect(b.store.size).toBe(3);
    expect(a.state.round).toBe(2);
    expect(canonicalJson(a.state)).toBe(canonicalJson(b.state));
  });

  it('anti-entropy repairs silently dropped messages', async () => {
    const hub = new MemoryHub();
    const { a, b } = await lobbyAndStart(hub);
    hub.online = false;
    a.submit(act(1, 'alice', 'move'));
    hub.online = true;
    await flush();
    expect(b.store.size).toBe(1);
    a.antiEntropy();
    await flush(20);
    expect(b.store.size).toBe(2);
  });

  it('resumes from storage after a refresh, even with nobody else online', async () => {
    const hub = new MemoryHub();
    const storageA = new MemoryStorage();
    const a = mk(hub, 'alice', { host: true, storage: storageA });
    const b = mk(hub, 'bob');
    await a.start();
    await b.start();
    await flush();
    a.setLobby({ classId: 'medic', ready: true });
    b.setLobby({ classId: 'engineer', ready: true });
    await flush();
    a.startGame('seed-2');
    await flush();
    a.submit(act(1, 'alice'));
    b.submit(act(1, 'bob'));
    await flush();
    const before = canonicalJson(a.state);
    await a.stop();
    await b.stop();
    // everyone gone; alice comes back alone with the same link
    const a2 = mk(new MemoryHub(), 'alice', { storage: storageA });
    await a2.start();
    expect(canonicalJson(a2.state)).toBe(before);
    expect(a2.state.round).toBe(2);
  });

  it('a late joiner (fresh device) catches up via hello', async () => {
    const hub = new MemoryHub();
    const { a } = await lobbyAndStart(hub);
    a.submit(act(1, 'alice'));
    await flush();
    const bob2 = mk(hub, 'bob'); // bob on a new phone, empty storage
    await bob2.start();
    await flush(20);
    expect(bob2.store.size).toBe(a.store.size);
    expect(canonicalJson(bob2.state)).toBe(canonicalJson(a.state));
  });

  it('forced skip lets the round resolve and syncs to everyone', async () => {
    const hub = new MemoryHub();
    const { a, b } = await lobbyAndStart(hub);
    a.submit(act(1, 'alice', 'move'));
    await flush();
    expect(a.state.pending).toEqual([{ type: 'action', playerId: 'bob' }]);
    expect(a.forceSkip('bob')).toBe(true);
    await flush();
    expect(a.state.round).toBe(2);
    expect(b.state.round).toBe(2);
    // bob's late real input for round 1 does not change the outcome
    const snapshot = canonicalJson(deriveState(a.store));
    b.submit(act(1, 'bob', 'move'));
    await flush();
    expect(canonicalJson(deriveState(a.store).players)).toBe(canonicalJson(JSON.parse(snapshot).players));
  });

  it('tracks connection badges', async () => {
    const hub = new MemoryHub();
    const clock = { t: 1_000_000 };
    const a = mk(hub, 'alice', { host: true, clock });
    const b = mk(hub, 'bob', { clock });
    await a.start();
    await b.start();
    await flush();
    expect(a.getSnapshot().connected.bob).toBe(true);
    await b.stop();
    await flush();
    expect(a.getSnapshot().connected.bob).toBe(false);
  });

  it('solo mode: bots play a full game', async () => {
    const s = new GameSession({
      room: 'SOLO1',
      playerId: 'me',
      name: 'Me',
      transport: new MemoryTransport(new MemoryHub()),
      storage: new MemoryStorage(),
      bots: 3,
      manualTimers: true,
      botDelayMs: 0,
    });
    await s.start();
    s.setLobby({ classId: 'scout', ready: true });
    expect(s.lobbyRoster()).toHaveLength(4);
    expect(s.startGame('solo-seed')).toBe(true);
    // play "me" as a wait-bot until the game ends
    for (let i = 0; i < 400 && s.state.phase !== 'over'; i++) {
      const p = s.state.pending.find((x) => x.playerId === 'me');
      if (p?.type === 'action') s.submit(act(s.state.round, 'me', 'move'));
      else if (p?.type === 'enc') s.submit({ round: s.state.round, playerId: 'me', type: 'enc', n: 0, payload: { choice: 'flee' } });
      await new Promise((r) => setTimeout(r, 1));
    }
    expect(s.state.phase).toBe('over');
    await s.stop();
  });
});
