import { Emitter, randomId, type Transport, type Unsub } from './transport';

/** In-memory network for tests: transports joined to the same hub room see each other. */
export class MemoryHub {
  private rooms = new Map<string, Set<MemoryTransport>>();
  /** when false, messages are dropped (simulates a network partition) */
  online = true;

  attach(t: MemoryTransport, room: string): void {
    const set = this.rooms.get(room) ?? new Set();
    this.rooms.set(room, set);
    for (const other of set) {
      queueMicrotask(() => {
        other.peerJoined(t.selfId);
        t.peerJoined(other.selfId);
      });
    }
    set.add(t);
  }

  detach(t: MemoryTransport, room: string): void {
    const set = this.rooms.get(room);
    if (!set?.delete(t)) return;
    for (const other of set) {
      other.peerLeft(t.selfId);
      t.peerLeft(other.selfId);
    }
  }

  deliver(room: string, from: MemoryTransport, msg: unknown, to?: string): void {
    if (!this.online) return;
    const copy = JSON.parse(JSON.stringify(msg)) as unknown;
    for (const t of this.rooms.get(room) ?? []) {
      if (t === from || (to && t.selfId !== to)) continue;
      queueMicrotask(() => t.receive(copy, from.selfId));
    }
  }
}

export class MemoryTransport implements Transport {
  readonly kind = 'memory' as const;
  readonly selfId = randomId(6);
  private room: string | null = null;
  private peerSet = new Set<string>();
  private msg = new Emitter<[unknown, string]>();
  private joinE = new Emitter<[string]>();
  private leaveE = new Emitter<[string]>();

  constructor(private readonly hub: MemoryHub) {}

  async join(room: string): Promise<void> {
    await this.leave();
    this.room = room;
    this.hub.attach(this, room);
  }
  async leave(): Promise<void> {
    if (this.room) this.hub.detach(this, this.room);
    this.room = null;
  }
  send(msg: unknown, to?: string): void {
    if (this.room) this.hub.deliver(this.room, this, msg, to);
  }
  onMessage(h: (msg: unknown, from: string) => void): Unsub {
    return this.msg.on(h);
  }
  onPeerJoin(h: (peer: string) => void): Unsub {
    return this.joinE.on(h);
  }
  onPeerLeave(h: (peer: string) => void): Unsub {
    return this.leaveE.on(h);
  }
  peers(): string[] {
    return [...this.peerSet];
  }
  peerJoined(p: string): void {
    if (this.peerSet.has(p)) return;
    this.peerSet.add(p);
    this.joinE.emit(p);
  }
  peerLeft(p: string): void {
    if (this.peerSet.delete(p)) this.leaveE.emit(p);
  }
  receive(msg: unknown, from: string): void {
    if (!this.room) return;
    this.msg.emit(msg, from);
  }
}
