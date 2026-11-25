import { STORAGE_PREFIX } from '../config';
import { Emitter, randomId, type Transport, type Unsub } from './transport';

type Envelope =
  | { k: 'join' | 'here' | 'leave' | 'beat'; from: string; to?: string }
  | { k: 'msg'; from: string; to?: string; msg: unknown };

const BEAT_MS = 3000;
const PEER_TIMEOUT_MS = 12000;

/**
 * BroadcastChannel transport: every tab of the same origin in the same room is a peer.
 * Used for multi-tab testing (`?net=local`) without any network.
 */
export class LocalTransport implements Transport {
  readonly kind = 'local' as const;
  readonly selfId = randomId(8);
  private ch: BroadcastChannel | null = null;
  private seen = new Map<string, number>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private msg = new Emitter<[unknown, string]>();
  private joinE = new Emitter<[string]>();
  private leaveE = new Emitter<[string]>();
  private onHide = () => this.post({ k: 'leave', from: this.selfId });

  async join(room: string): Promise<void> {
    await this.leave();
    const ch = new BroadcastChannel(`${STORAGE_PREFIX}:local:${room}`);
    this.ch = ch;
    ch.onmessage = (e: MessageEvent<Envelope>) => this.receive(e.data);
    this.post({ k: 'join', from: this.selfId });
    this.timer = setInterval(() => {
      this.post({ k: 'beat', from: this.selfId });
      const now = Date.now();
      for (const [peer, t] of this.seen) if (now - t > PEER_TIMEOUT_MS) this.drop(peer);
    }, BEAT_MS);
    if (typeof window !== 'undefined') window.addEventListener('pagehide', this.onHide);
  }

  async leave(): Promise<void> {
    if (!this.ch) return;
    this.post({ k: 'leave', from: this.selfId });
    this.ch.close();
    this.ch = null;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (typeof window !== 'undefined') window.removeEventListener('pagehide', this.onHide);
    for (const p of [...this.seen.keys()]) this.drop(p);
  }

  send(msg: unknown, to?: string): void {
    this.post(to ? { k: 'msg', from: this.selfId, to, msg } : { k: 'msg', from: this.selfId, msg });
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
    return [...this.seen.keys()];
  }

  private post(e: Envelope): void {
    try {
      this.ch?.postMessage(e);
    } catch (err) {
      console.warn('LocalTransport post failed', err);
    }
  }

  private touch(peer: string): void {
    const isNew = !this.seen.has(peer);
    this.seen.set(peer, Date.now());
    if (isNew) this.joinE.emit(peer);
  }

  private drop(peer: string): void {
    if (this.seen.delete(peer)) this.leaveE.emit(peer);
  }

  private receive(e: Envelope): void {
    if (!e || e.from === this.selfId) return;
    if (e.to && e.to !== this.selfId) return;
    switch (e.k) {
      case 'join':
        this.post({ k: 'here', from: this.selfId, to: e.from });
        this.touch(e.from);
        return;
      case 'here':
      case 'beat':
        this.touch(e.from);
        return;
      case 'leave':
        this.drop(e.from);
        return;
      case 'msg':
        this.touch(e.from);
        this.msg.emit(e.msg, e.from);
        return;
    }
  }
}
