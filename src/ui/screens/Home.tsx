import { useState } from 'react';
import { GAME_TAGLINE, GAME_TITLE } from '../../config';
import { makeRoomCode } from '../../session/session';
import { MAX_NAME_LENGTH } from '../../session/protocol';
import { netMode, type Identity } from '../net';
import { goRoom } from '../router';
import { markRoom } from '../useSession';

export function Home({ me, onName }: { me: Identity; onName: (n: string) => void }) {
  const [name, setName] = useState(me.name);
  const [code, setCode] = useState('');
  const validName = name.trim().length > 0;
  const commitName = () => onName(name.trim().slice(0, MAX_NAME_LENGTH));
  const mode = netMode();

  const create = () => {
    commitName();
    const c = makeRoomCode();
    markRoom(c, { host: true });
    goRoom(c);
  };
  const join = () => {
    commitName();
    goRoom(code.trim().toUpperCase());
  };
  const solo = () => {
    commitName();
    const c = makeRoomCode();
    markRoom(c, { host: true, bots: 3 });
    goRoom(c);
  };

  return (
    <div className="screen">
      <div className="title">
        <h1>{GAME_TITLE}</h1>
        <p>{GAME_TAGLINE}</p>
      </div>

      <div className="card">
        <h2>Your name</h2>
        <input
          className="input"
          value={name}
          maxLength={MAX_NAME_LENGTH}
          placeholder="What the survivors call you"
          autoComplete="nickname"
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
        />
      </div>

      <button className="btn primary block" disabled={!validName} onClick={create}>
        Create a room
      </button>

      <div className="divider">or join</div>

      <div className="card">
        <div className="row">
          <input
            className="input code grow"
            value={code}
            maxLength={4}
            placeholder="ABCD"
            inputMode="text"
            autoCapitalize="characters"
            onChange={(e) => setCode(e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && validName && code.length === 4 && join()}
          />
          <button className="btn" disabled={!validName || code.length !== 4} onClick={join}>
            Join
          </button>
        </div>
      </div>

      <button className="btn ghost block" disabled={!validName} onClick={solo}>
        Solo run against 3 bots
      </button>

      <p className="dim tiny center">
        No servers. Your phone talks straight to your friends' phones.
        {mode === 'local' ? ' Local tab mode (BroadcastChannel).' : ` Signaling: ${mode}.`}
      </p>
    </div>
  );
}
