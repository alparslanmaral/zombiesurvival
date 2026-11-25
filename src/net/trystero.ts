import { APP_ID } from '../config';
import { Emitter, type Transport, type Unsub } from './transport';

/**
 * Trystero (WebRTC mesh, serverless signaling). Since 0.27 each signaling
 * strategy is its own package; they are loaded lazily so only the chosen one
 * ends up in the critical path.
 */
export type StrategyName = 'nostr' | 'torrent' | 'mqtt';

export const STRATEGIES: Record<StrategyName, () => Promise<{ joinRoom: JoinRoomFn }>> = {
  nostr: () => import('@trystero-p2p/nostr') as unknown as Promise<{ joinRoom: JoinRoomFn }>,
  torrent: () => import('@trystero-p2p/torrent') as unknown as Promise<{ joinRoom: JoinRoomFn }>,
  mqtt: () => import('@trystero-p2p/mqtt') as unknown as Promise<{ joinRoom: JoinRoomFn }>,
};

export function isStrategy(s: string | null | undefined): s is StrategyName {
  return !!s && s in STRATEGIES;
}

// Structural subset of the Trystero Room API we rely on (keeps us decoupled from its generics).
interface TRoom {
  makeAction: (ns: string) => {
    send: (data: unknown, opts?: { target?: string | string[] | null }) => Promise<void>;
    onMessage: (h: (data: unknown, ctx: { peerId: string }) => unknown) => () => void;
  };
  onPeerJoin: (h: (ctx: { peerId: string }) => unknown) => () => void;
  onPeerLeave: (h: (ctx: { peerId: string }) => unknown) => () => void;
  onError?: (h: (err: { code: string; message: string }) => unknown) => () => void;
  getPeers: () => Record<string, unknown>;
  leave: () => Promise<void>;
}
type JoinRoomFn = (config: Record<string, unknown>, roomId: string) => TRoom;

export interface IceEnv {
  turnUrl?: string | undefined;
  turnUsername?: string | undefined;
  turnCredential?: string | undefined;
}

export function buildRtcConfig(env: IceEnv): RTCConfiguration {
  const iceServers: RTCIceServer[] = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ];
  if (env.turnUrl) {
    const turn: RTCIceServer = { urls: env.turnUrl.split(',').map((u) => u.trim()).filter(Boolean) };
    if (env.turnUsername) turn.username = env.turnUsername;
    if (env.turnCredential) turn.credential = env.turnCredential;
    iceServers.push(turn);
  }
  return { iceServers };
}

export class TrysteroTransport implements Transport {
  readonly kind = 'trystero' as const;
  private room: TRoom | null = null;
  private sendFn: ((data: unknown, opts?: { target?: string }) => Promise<void>) | null = null;
  private peerSet = new Set<string>();
  private msg = new Emitter<[unknown, string]>();
  private joinE = new Emitter<[string]>();
  private leaveE = new Emitter<[string]>();

  constructor(
    private readonly strategy: StrategyName,
    private readonly rtcConfig: RTCConfiguration,
  ) {}

  async join(roomCode: string): Promise<void> {
    await this.leave();
    const mod = await STRATEGIES[this.strategy]();
    const room = mod.joinRoom(
      {
        appId: APP_ID,
        // Player identity is ours (localStorage playerId); keep Trystero's ephemeral so tabs are distinct peers.
        identity: 'none',
        rtcConfig: this.rtcConfig,
      },
      roomCode,
    );
    this.room = room;
    const action = room.makeAction('m');
    this.sendFn = (data, opts) => action.send(data, opts);
    action.onMessage((data, ctx) => {
      if (!this.peerSet.has(ctx.peerId)) {
        this.peerSet.add(ctx.peerId);
        this.joinE.emit(ctx.peerId);
      }
      this.msg.emit(data, ctx.peerId);
    });
    room.onPeerJoin(({ peerId }) => {
      if (this.peerSet.has(peerId)) return;
      this.peerSet.add(peerId);
      this.joinE.emit(peerId);
    });
    room.onPeerLeave(({ peerId }) => {
      if (this.peerSet.delete(peerId)) this.leaveE.emit(peerId);
    });
    room.onError?.((err) => console.warn(`[trystero] ${err.code}: ${err.message}`));
  }

  async leave(): Promise<void> {
    const room = this.room;
    this.room = null;
    this.sendFn = null;
    for (const p of [...this.peerSet]) {
      this.peerSet.delete(p);
      this.leaveE.emit(p);
    }
    if (room) {
      try {
        await room.leave();
      } catch (e) {
        console.warn('[trystero] leave failed', e);
      }
    }
  }

  send(msg: unknown, to?: string): void {
    if (!this.sendFn) return;
    this.sendFn(msg, to ? { target: to } : undefined).catch((e: unknown) => console.warn('[trystero] send failed', e));
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
    const live = this.room ? Object.keys(this.room.getPeers()) : [];
    return live.length ? live : [...this.peerSet];
  }
}
