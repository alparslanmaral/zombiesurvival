import { NullTransport, randomId, type Transport } from '../net/transport';
import { LocalTransport } from '../net/local';
import { buildRtcConfig, isStrategy, TrysteroTransport, type StrategyName } from '../net/trystero';
import { STORAGE_PREFIX } from '../config';
import { MAX_NAME_LENGTH } from '../session/protocol';

const params = () => new URLSearchParams(window.location.search);

/** `?net=local` → BroadcastChannel (multi-tab testing). `?net=nostr|torrent|mqtt` overrides the strategy. */
export function netMode(): 'local' | StrategyName {
  const p = params().get('net');
  if (p === 'local') return 'local';
  if (isStrategy(p)) return p;
  const env = import.meta.env.VITE_TRYSTERO_STRATEGY;
  return isStrategy(env) ? env : 'nostr';
}

export function botsParam(): number {
  const n = Number(params().get('bots'));
  return Number.isFinite(n) && n > 0 ? Math.min(3, Math.floor(n)) : 0;
}

export function createTransport(solo: boolean): Transport {
  if (solo) return new NullTransport();
  const mode = netMode();
  if (mode === 'local') return new LocalTransport();
  return new TrysteroTransport(
    mode,
    buildRtcConfig({
      turnUrl: import.meta.env.VITE_TURN_URL,
      turnUsername: import.meta.env.VITE_TURN_USERNAME,
      turnCredential: import.meta.env.VITE_TURN_CREDENTIAL,
    }),
  );
}

export interface Identity {
  id: string;
  name: string;
}

/**
 * Persistent player identity. Per-browser (localStorage) normally; per-tab
 * (sessionStorage) with ?net=local so several tabs can be different players.
 */
function identityStore(): Storage {
  return netMode() === 'local' ? sessionStorage : localStorage;
}

export function loadIdentity(): Identity {
  const key = `${STORAGE_PREFIX}:player`;
  try {
    const raw = identityStore().getItem(key);
    if (raw) {
      const v = JSON.parse(raw) as Partial<Identity>;
      if (typeof v.id === 'string' && /^[A-Za-z0-9_-]{4,40}$/.test(v.id) && typeof v.name === 'string') return { id: v.id, name: v.name };
    }
  } catch {
    /* fall through */
  }
  const fresh = { id: randomId(10), name: '' };
  saveIdentity(fresh);
  return fresh;
}

export function saveIdentity(id: Identity): void {
  try {
    identityStore().setItem(`${STORAGE_PREFIX}:player`, JSON.stringify({ ...id, name: id.name.slice(0, MAX_NAME_LENGTH) }));
  } catch {
    /* private mode: identity lives for this page only */
  }
}
