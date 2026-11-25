import { useEffect, useState } from 'react';
import { GAME_TITLE } from './config';
import { botsParam, loadIdentity, saveIdentity, type Identity } from './ui/net';
import { goRoom, useRoute } from './ui/router';
import { Home } from './ui/screens/Home';
import { Room } from './ui/screens/Room';
import { makeRoomCode } from './session/session';
import { markRoom } from './ui/useSession';
import { Embers } from './ui/components/Effects';

export function App() {
  const route = useRoute();
  const [me, setMe] = useState<Identity>(() => loadIdentity());

  useEffect(() => {
    document.title = route.name === 'room' ? `${route.code} · ${GAME_TITLE}` : GAME_TITLE;
  }, [route]);

  // `?bots=N` on the home page drops straight into a fresh solo lobby.
  useEffect(() => {
    const bots = botsParam();
    if (route.name === 'home' && bots > 0) {
      const code = makeRoomCode();
      markRoom(code, { host: true, bots });
      goRoom(code);
    }
  }, [route.name]);

  const updateName = (name: string) => {
    const next = { ...me, name };
    saveIdentity(next);
    setMe(next);
  };

  return (
    <>
      <div className="backdrop" aria-hidden>
        <div className="vignette" />
        <div className="grain" />
      </div>
      <Embers />
      <div className="app">
      {route.name === 'home' ? <Home me={me} onName={updateName} /> : <Room key={route.code} code={route.code} me={me} onName={updateName} />}
      </div>
    </>
  );
}
