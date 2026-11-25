import type { GameSession } from './session';

/**
 * Browser lifecycle hooks. Mobile browsers freeze background tabs and drop
 * WebRTC connections; when the page comes back we check for peers and rejoin
 * the room if we are alone.
 */
export function attachLifecycle(session: GameSession): () => void {
  const check = () => void session.checkConnectivity(true);
  const onVisible = () => {
    if (document.visibilityState === 'visible') check();
  };
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('pageshow', check);
  window.addEventListener('online', check);
  return () => {
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('pageshow', check);
    window.removeEventListener('online', check);
  };
}
