import { classDef } from '../../engine/data/classes';
import type { GameState } from '../../engine/types';
import type { GameSession } from '../../session/session';
import { makeRoomCode } from '../../session/session';
import { goHome, goRoom } from '../router';
import { markRoom } from '../useSession';

export function End({ state, session }: { state: GameState; session: GameSession }) {
  const winner = state.winner ? state.players[state.winner] : undefined;
  const iWon = state.winner === session.playerId;
  const ranked = state.roster
    .map((r) => state.players[r.id])
    .filter((p): p is NonNullable<typeof p> => !!p)
    .sort((a, b) => (a.id === state.winner ? -1 : b.id === state.winner ? 1 : a.pos.y - b.pos.y || b.hp - a.hp));

  const again = () => {
    const code = makeRoomCode();
    if (session.solo) {
      markRoom(code, { host: true, bots: state.roster.filter((r) => r.bot).length || 3 });
    } else {
      markRoom(code, { host: true });
      session.announceNextRoom(code);
    }
    goRoom(code);
  };

  return (
    <div className="screen">
      <div className="title">
        <h1 style={{ fontSize: 30 }}>{iWon ? 'You made it' : winner ? `${winner.name} made it` : 'Silence'}</h1>
        <p>
          {state.winReason === 'timeout'
            ? 'Nobody reached the gate. The one who got closest gets the story.'
            : iWon
              ? 'The gate shuts behind you. You do not look back. You try not to.'
              : 'The gate shuts. You hear it from three streets away.'}
        </p>
      </div>

      <div className="card">
        <h2>After-action · {state.round} rounds</h2>
        <table className="stats-table">
          <thead>
            <tr>
              <th>Survivor</th>
              <th title="Zombie cells cleared">Kills</th>
              <th title="Items found">Loot</th>
              <th title="Damage taken">Dmg</th>
              <th title="Knockouts">KO</th>
              <th title="Rows from the City">Row</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((p) => (
              <tr key={p.id}>
                <td>
                  <span className="dot" style={{ background: p.color, marginRight: 6 }} />
                  {p.id === state.winner ? '🏁 ' : ''}
                  {p.name} <span className="dim tiny">{classDef(p.classId).icon}</span>
                </td>
                <td>{p.stats.zombiesCleared}</td>
                <td>{p.stats.itemsFound}</td>
                <td>{p.stats.damageTaken}</td>
                <td>{p.stats.knockouts}</td>
                <td>{state.rows - p.pos.y}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {state.nextRoom && !session.solo ? (
        <button className="btn primary block" onClick={() => goRoom(state.nextRoom as string)}>
          Join the next run · {state.nextRoom}
        </button>
      ) : (
        <button className="btn primary block" onClick={again}>
          Play again
        </button>
      )}
      <button className="btn ghost block" onClick={goHome}>
        Back to the road
      </button>
    </div>
  );
}
