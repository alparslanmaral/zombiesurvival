/**
 * Minimal message transport. Implementations: TrysteroTransport (WebRTC),
 * LocalTransport (BroadcastChannel, multi-tab testing), NullTransport (solo),
 * MemoryHub (tests). Peer ids identify connections, never players.
 */
export type Unsub = () => void;

export interface Transport {
  readonly kind: 'trystero' | 'local' | 'none' | 'memory';
  join(room: string): Promise<void>;
  leave(): Promise<void>;
  /** Broadcast when `to` is omitted. */
  send(msg: unknown, to?: string): void;
  onMessage(handler: (msg: unknown, fromPeer: string) => void): Unsub;
  onPeerJoin(handler: (peer: string) => void): Unsub;
  onPeerLeave(handler: (peer: string) => void): Unsub;
  peers(): string[];
}

/** Tiny typed event emitter shared by transports. */
export class Emitter<T extends unknown[]> {
  private hs = new Set<(...args: T) => void>();
  on(h: (...args: T) => void): Unsub {
    this.hs.add(h);
    return () => this.hs.delete(h);
  }
  emit(...args: T): void {
    for (const h of [...this.hs]) {
      try {
        h(...args);
      } catch (e) {
        console.error(e);
      }
    }
  }
}

export function randomId(len = 10): string {
  const alphabet = 'abcdefghijkmnopqrstuvwxyz23456789';
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

/** Transport for solo games: no peers, messages go nowhere. */
export class NullTransport implements Transport {
  readonly kind = 'none' as const;
  async join(): Promise<void> {}
  async leave(): Promise<void> {}
  send(): void {}
  onMessage(): Unsub {
    return () => {};
  }
  onPeerJoin(): Unsub {
    return () => {};
  }
  onPeerLeave(): Unsub {
    return () => {};
  }
  peers(): string[] {
    return [];
  }
}
