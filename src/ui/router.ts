import { useEffect, useState } from 'react';

export type Route = { name: 'home' } | { name: 'room'; code: string };

export function parseHash(hash: string): Route {
  const m = /^#\/room\/([A-Za-z0-9-]{3,12})/.exec(hash);
  if (m?.[1]) return { name: 'room', code: m[1].toUpperCase() };
  return { name: 'home' };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const on = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function goRoom(code: string): void {
  window.location.hash = `#/room/${code}`;
}

export function goHome(): void {
  window.location.hash = '#/';
}

/** Shareable link for a room, preserving the base path and any ?net= override. */
export function roomLink(code: string): string {
  const url = new URL(window.location.href);
  url.searchParams.delete('bots');
  url.hash = `#/room/${code}`;
  return url.toString();
}
