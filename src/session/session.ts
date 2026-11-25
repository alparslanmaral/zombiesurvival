/**
 * GameSession: owns the input set for one room, keeps it in sync with peers,
 * persists it, tracks presence, reconnects, and runs bots in solo mode.
 * DOM-free (browser lifecycle hooks live in lifecycle.ts) so it can be tested.
 */
import { botInput } from '../engine/bot';
import { CLASSES, classDef } from '../engine/data/classes';
import { deriveState } from '../engine/engine';
import { inputKey, InputSet } from '../engine/inputs';
import { makeRng } from '../engine/rng';
import type { ClassId, GameInput, GameState, PlayerId, RosterEntry } from '../engine/types';
import { BALANCE } from '../engine/balance';
import { randomId, type Transport } from '../net/transport';
import { parseMessage, type NetMessage, type Presence } from './protocol';
import type { RoomStorage } from './storage';

export const HEARTBEAT_MS = 5_000;
export const PEER_TIMEOUT_MS = 30_000;
export const ANTI_ENTROPY_MS = 10_000;
export const CONNECTIVITY_CHECK_MS = 5_000;
/** How long with zero peers (while expecting some) before we leave and rejoin. */
export const ALONE_REJOIN_MS = 12_000;
export const BACKOFF_BASE_MS = 2_000;
export const BACKOFF_MAX_MS = 60_000;

const BOT_NAMES = ['Rook', 'Sable', 'Halloran', 'Juno', 'Vesna', 'Crow'];

export type NetStatus = 'connecting' | 'online' | 'alone' | 'reconnecting' | 'solo';

export interface SessionSnapshot {
  state: GameState;
  me: Presence;
  /** everyone known in the lobby (including me and bots), ordered by join time */
  lobby: Presence[];
  /** playerId -> currently connected */
  connected: Record<PlayerId, boolean>;
  status: NetStatus;
  peerCount: number;
  inputCount: number;
  solo: boolean;
}

export interface SessionOptions {
  room: string;
  playerId: string;
  name: string;
  transport: Transport;
  storage: RoomStorage;
  host?: boolean;
  /** solo mode: number of bot opponents */
  bots?: number;
  /** disable internal timers (tests drive ticks manually) */
  manualTimers?: boolean;
  now?: () => number;
  /** bot think time in ms (solo mode) */
  botDelayMs?: number;
}

interface PeerPresence {
  p: Presence;
  peers: Set<string>;
  lastSeen: number;
}

export class GameSession {
  readonly room: string;
  readonly playerId: string;
  readonly store: InputSet;
  readonly solo: boolean;
  private readonly t: Transport;
  private readonly storage: RoomStorage;
  private readonly now: () => number;
  private me: Presence;
  private others = new Map<PlayerId, PeerPresence>();
  private peerToPlayer = new Map<string, PlayerId>();
  private listeners = new Set<() => void>();
  private snap: SessionSnapshot | null = null;
  private derived: { version: number; state: GameState } | null = null;
  private timers: ReturnType<typeof setInterval>[] = [];
  private botTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private unsubs: (() => void)[] = [];
  private status: NetStatus = 'connecting';
  private lastPeerAt: number;
  private backoffStep = 0;
  private nextRejoinAt = 0;
  private rejoining = false;
  private started = false;
  private everSawPeer = false;
  private readonly botDelay: number;
  private readonly bots: RosterEntry[];

  constructor(opts: SessionOptions) {
    this.room = opts.room;
    this.playerId = opts.playerId;
    this.t = opts.transport;
    this.storage = opts.storage;
    this.now = opts.now ?? (() => Date.now());
    this.solo = (opts.bots ?? 0) > 0;
    this.botDelay = opts.botDelayMs ?? 700;
    const meta = this.storage.loadMeta(this.room) ?? {};
    const since = meta.createdAt ?? this.now();
    this.storage.saveMeta(this.room, {
      ...meta,
      createdAt: since,
      lastSeen: this.now(),
      ...(opts.host || meta.host ? { host: true } : {}),
      ...(this.solo ? { bots: opts.bots } : {}),
    });
    this.me = {
      playerId: opts.playerId,
      name: opts.name,
      classId: null,
      startPerk: null,
      ready: false,
      host: !!(opts.host || meta.host || this.solo),
      since,
    };
    this.store = new InputSet(this.storage.loadInputs(this.room));
    this.lastPeerAt = this.now();
    this.bots = this.solo ? this.makeBots(opts.bots ?? 0) : [];
    if (this.solo) this.status = 'solo';
    if (!opts.manualTimers) this.startTimers();
  }

  // ------------------------------------------------------------ lifecycle

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    this.unsubs.push(
      this.t.onMessage((m, from) => this.onMessage(m, from)),
      this.t.onPeerJoin((p) => this.onPeerJoin(p)),
      this.t.onPeerLeave((p) => this.onPeerLeave(p)),
    );
    if (!this.solo) {
      try {
        await this.t.join(this.room);
        this.status = 'alone';
      } catch (e) {
        console.warn('join failed', e);
        this.status = 'reconnecting';
      }
      this.announce();
    }
    this.emit();
    this.runBots();
  }

  async stop(): Promise<void> {
    this.timers.forEach((t) => clearInterval(t));
    this.timers = [];
    this.botTimers.forEach((t) => clearTimeout(t));
    this.botTimers.clear();
    if (!this.solo) this.t.send({ t: 'bye', playerId: this.playerId } satisfies NetMessage);
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    this.started = false;
    await this.t.leave();
  }

  private startTimers(): void {
    if (this.solo) return;
    this.timers.push(
      setInterval(() => this.heartbeat(), HEARTBEAT_MS),
      setInterval(() => this.antiEntropy(), ANTI_ENTROPY_MS),
      setInterval(() => void this.checkConnectivity(), CONNECTIVITY_CHECK_MS),
    );
  }

  // ------------------------------------------------------------ React bridge

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = (): SessionSnapshot => {
    if (!this.snap) this.snap = this.buildSnapshot();
    return this.snap;
  };

  get state(): GameState {
    if (!this.derived || this.derived.version !== this.store.version) {
      this.derived = { version: this.store.version, state: deriveState(this.store) };
    }
    return this.derived.state;
  }

  private emit(): void {
    this.snap = null;
    for (const l of [...this.listeners]) l();
  }

  private buildSnapshot(): SessionSnapshot {
    const now = this.now();
    const lobby: Presence[] = [this.me];
    const connected: Record<PlayerId, boolean> = { [this.playerId]: true };
    for (const [pid, o] of this.others) {
      lobby.push(o.p);
      connected[pid] = this.isConnected(o, now);
    }
    for (const b of this.bots) {
      lobby.push({ playerId: b.id, name: b.name, classId: b.classId, startPerk: b.startPerk, ready: true, host: false, since: Infinity });
      connected[b.id] = true;
    }
    for (const r of this.state.roster) if (r.bot) connected[r.id] = true;
    lobby.sort((a, b) => (b.host ? 1 : 0) - (a.host ? 1 : 0) || a.since - b.since || (a.playerId < b.playerId ? -1 : 1));
    return {
      state: this.state,
      me: this.me,
      lobby,
      connected,
      status: this.status,
      peerCount: this.t.peers().length,
      inputCount: this.store.size,
      solo: this.solo,
    };
  }

  private isConnected(o: PeerPresence, now: number): boolean {
    return o.peers.size > 0 && now - o.lastSeen < PEER_TIMEOUT_MS;
  }

  // ------------------------------------------------------------ inputs

  /** Add a locally created input: persist, broadcast, re-derive. */
  submit(input: GameInput): boolean {
    if (!this.store.add(input)) return false;
    this.persist();
    if (!this.solo) this.t.send({ t: 'inputs', inputs: [input] } satisfies NetMessage);
    this.emit();
    this.runBots();
    return true;
  }

  private merge(inputs: GameInput[], fromPeer?: string): GameInput[] {
    const added = this.store.addAll(inputs);
    if (added.length > 0) {
      this.persist();
      // gossip newly learned inputs once, so partial meshes still converge
      if (!this.solo) for (const p of this.t.peers()) if (p !== fromPeer) this.t.send({ t: 'inputs', inputs: added } satisfies NetMessage, p);
      this.emit();
    }
    return added;
  }

  private persist(): void {
    this.storage.saveInputs(this.room, this.store.values());
    const meta = this.storage.loadMeta(this.room) ?? {};
    this.storage.saveMeta(this.room, { ...meta, lastSeen: this.now() });
  }

  // ------------------------------------------------------------ protocol

  private hello(to?: string, reply = false): void {
    const msg: NetMessage = { t: 'hello', playerId: this.playerId, keys: this.store.keys(), ...(reply ? { reply: true } : {}) };
    this.t.send(msg, to);
  }

  private sendPresence(to?: string): void {
    this.t.send({ t: 'presence', p: this.me } satisfies NetMessage, to);
  }

  private announce(): void {
    this.hello();
    this.sendPresence();
  }

  private onPeerJoin(peer: string): void {
    this.everSawPeer = true;
    this.lastPeerAt = this.now();
    this.backoffStep = 0;
    this.status = 'online';
    this.hello(peer);
    this.sendPresence(peer);
    this.emit();
  }

  private onPeerLeave(peer: string): void {
    const pid = this.peerToPlayer.get(peer);
    this.peerToPlayer.delete(peer);
    if (pid) this.others.get(pid)?.peers.delete(peer);
    if (this.t.peers().length === 0 && !this.solo) this.status = 'alone';
    this.emit();
  }

  private bindPeer(peer: string, pid: PlayerId): void {
    if (pid === this.playerId) return;
    this.peerToPlayer.set(peer, pid);
    const o = this.others.get(pid);
    if (o) {
      o.peers.add(peer);
      o.lastSeen = this.now();
    }
  }

  private onMessage(raw: unknown, from: string): void {
    const msg = parseMessage(raw);
    if (!msg) return;
    this.lastPeerAt = this.now();
    const pid = this.peerToPlayer.get(from);
    if (pid) {
      const o = this.others.get(pid);
      if (o) o.lastSeen = this.now();
    }
    switch (msg.t) {
      case 'hello': {
        this.bindPeer(from, msg.playerId);
        const missing = this.store.missingFrom(msg.keys);
        if (missing.length) this.t.send({ t: 'inputs', inputs: missing } satisfies NetMessage, from);
        const mine = new Set(this.store.keys());
        const theyHaveMore = msg.keys.some((k) => !mine.has(k));
        if (theyHaveMore && !msg.reply) this.hello(from, true);
        return;
      }
      case 'inputs':
        this.merge(msg.inputs, from);
        return;
      case 'sum': {
        const d = this.store.digest();
        if (d.count !== msg.count || d.hash !== msg.hash) this.hello(from);
        return;
      }
      case 'presence': {
        if (msg.p.playerId === this.playerId) return;
        const known = this.others.get(msg.p.playerId);
        const entry: PeerPresence = known ?? { p: msg.p, peers: new Set(), lastSeen: this.now() };
        entry.p = msg.p;
        entry.lastSeen = this.now();
        entry.peers.add(from);
        this.others.set(msg.p.playerId, entry);
        this.peerToPlayer.set(from, msg.p.playerId);
        if (!known) {
          this.sendPresence(from);
          this.hello(from);
        }
        this.emit();
        return;
      }
      case 'bye': {
        const o = this.others.get(msg.playerId);
        if (o) {
          o.peers.delete(from);
          if (o.peers.size === 0) o.lastSeen = 0;
        }
        this.emit();
        return;
      }
    }
  }

  // ------------------------------------------------------------ timers (public for tests)

  heartbeat(): void {
    if (this.solo) return;
    this.sendPresence();
    this.emit();
  }

  antiEntropy(): void {
    if (this.solo || this.t.peers().length === 0) return;
    const d = this.store.digest();
    this.t.send({ t: 'sum', count: d.count, hash: d.hash } satisfies NetMessage);
  }

  /** Whether we should have company: someone else is in the roster or was seen in this room. */
  expectsPeers(): boolean {
    if (this.solo) return false;
    if (this.state.roster.some((r) => !r.bot && r.id !== this.playerId)) return true;
    return this.everSawPeer || this.others.size > 0;
  }

  /** Called periodically and on visibilitychange/pageshow/online. Leaves and rejoins when stranded. */
  async checkConnectivity(force = false): Promise<void> {
    if (this.solo || this.rejoining) return;
    const now = this.now();
    if (this.t.peers().length > 0) {
      this.lastPeerAt = now;
      this.backoffStep = 0;
      if (this.status !== 'online') {
        this.status = 'online';
        this.emit();
      }
      return;
    }
    if (!this.expectsPeers()) return;
    const stranded = force || now - this.lastPeerAt > ALONE_REJOIN_MS;
    if (!stranded || now < this.nextRejoinAt) return;
    await this.rejoin();
  }

  async rejoin(): Promise<void> {
    if (this.rejoining || this.solo) return;
    this.rejoining = true;
    this.status = 'reconnecting';
    this.emit();
    const delay = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** this.backoffStep);
    this.backoffStep = Math.min(this.backoffStep + 1, 10);
    this.nextRejoinAt = this.now() + delay;
    try {
      await this.t.leave();
      await this.t.join(this.room);
      this.announce();
      this.status = this.t.peers().length ? 'online' : 'alone';
    } catch (e) {
      console.warn('rejoin failed', e);
      this.status = 'reconnecting';
    } finally {
      this.lastPeerAt = this.now();
      this.rejoining = false;
      this.emit();
    }
  }

  // ------------------------------------------------------------ lobby

  setLobby(patch: Partial<Pick<Presence, 'classId' | 'startPerk' | 'ready' | 'name'>>): void {
    this.me = { ...this.me, ...patch };
    if (patch.classId !== undefined && patch.classId !== null && patch.startPerk === undefined) {
      const cls = classDef(patch.classId);
      if (!this.me.startPerk || !cls.startPerks.includes(this.me.startPerk)) this.me = { ...this.me, startPerk: cls.startPerks[0] };
    }
    if (!this.solo) this.sendPresence();
    this.emit();
  }

  /** Players who would be in the roster if the game started now. */
  lobbyRoster(): RosterEntry[] {
    const snap = this.getSnapshot();
    return snap.lobby
      .filter((p) => p.ready && p.classId && snap.connected[p.playerId])
      .slice(0, BALANCE.MAX_PLAYERS)
      .map((p) => ({
        id: p.playerId,
        name: p.name,
        classId: p.classId as ClassId,
        startPerk: p.startPerk ?? classDef(p.classId as ClassId).startPerks[0],
        ...(this.bots.some((b) => b.id === p.playerId) ? { bot: true } : {}),
      }));
  }

  /** The room creator starts; if no creator is connected, the earliest connected player may. */
  isStarter(): boolean {
    if (this.me.host) return true;
    const snap = this.getSnapshot();
    const hostOnline = snap.lobby.some((p) => p.host && snap.connected[p.playerId]);
    if (hostOnline) return false;
    const first = snap.lobby.filter((p) => snap.connected[p.playerId] && !this.bots.some((b) => b.id === p.playerId))[0];
    return first?.playerId === this.playerId;
  }

  canStart(): boolean {
    const roster = this.lobbyRoster();
    return this.state.phase === 'lobby' && this.isStarter() && roster.length >= BALANCE.MIN_PLAYERS && roster.some((r) => r.id === this.playerId);
  }

  startGame(seed = randomId(12)): boolean {
    if (!this.canStart()) return false;
    return this.submit({ round: 0, playerId: this.playerId, type: 'start', n: 0, payload: { seed, roster: this.lobbyRoster() } });
  }

  forceSkip(target: PlayerId): boolean {
    const s = this.state;
    if (s.phase !== 'plan' && s.phase !== 'resolve') return false;
    if (!s.pending.some((p) => p.playerId === target)) return false;
    return this.submit({ round: s.round, playerId: target, type: 'force', n: 0, payload: { by: this.playerId } });
  }

  announceNextRoom(code: string): boolean {
    return this.submit({ round: Math.max(0, this.state.round), playerId: this.playerId, type: 'next', n: 0, payload: { room: code } });
  }

  hasSubmitted(key: string): boolean {
    return this.store.has(key);
  }

  // ------------------------------------------------------------ bots (solo)

  private makeBots(n: number): RosterEntry[] {
    const rng = makeRng(this.room, 'bots');
    const classes = rng.shuffle(CLASSES.map((c) => c.id));
    return Array.from({ length: Math.min(n, BALANCE.MAX_PLAYERS - 1) }, (_, i) => {
      const classId = classes[i % classes.length] as ClassId;
      return { id: `bot${i + 1}`, name: BOT_NAMES[i] ?? `Bot ${i + 1}`, classId, startPerk: classDef(classId).startPerks[rng.int(2)] as string, bot: true };
    });
  }

  private runBots(): void {
    const s = this.state;
    if (s.phase !== 'plan' && s.phase !== 'resolve') return;
    for (const pend of s.pending) {
      const r = s.roster.find((x) => x.id === pend.playerId);
      if (!r?.bot) continue;
      const input = botInput(s, pend.playerId);
      if (!input) continue;
      const key = inputKey(input);
      if (this.botTimers.has(key) || this.store.has(key)) continue;
      const delay = this.botDelay * (0.5 + makeRng(key).next());
      this.botTimers.set(
        key,
        setTimeout(() => {
          this.botTimers.delete(key);
          // re-derive in case the state moved on
          const now = this.state;
          if (!now.pending.some((p) => p.playerId === pend.playerId)) return;
          const fresh = botInput(now, pend.playerId);
          if (fresh) this.submit(fresh);
        }, delay),
      );
    }
  }
}

export function makeRoomCode(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => letters[b % letters.length]).join('');
}
