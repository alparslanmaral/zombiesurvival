import { useState } from 'react';
import { CLASSES, classDef } from '../../engine/data/classes';
import { BALANCE } from '../../engine/balance';
import type { GameSession, SessionSnapshot } from '../../session/session';
import { perkName } from '../format';
import { goHome, roomLink } from '../router';
import { perkDef } from '../../engine/data/classes';
import { NetBadge } from '../components/NetBadge';

export function Lobby({ session, snap, code }: { session: GameSession; snap: SessionSnapshot; code: string }) {
  const me = snap.me;
  const [copied, setCopied] = useState(false);
  const roster = session.lobbyRoster();
  const starter = session.isStarter();
  const canStart = session.canStart();
  const link = roomLink(code);

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: 'Ashen Road', text: `Room ${code}. Bring a weapon.`, url: link });
      else {
        await navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      /* user cancelled */
    }
  };

  const takenBy = (classId: string) => snap.lobby.filter((p) => p.classId === classId && p.playerId !== me.playerId).map((p) => p.name);

  return (
    <div className="screen">
      <div className="row">
        <button className="btn small ghost" onClick={goHome}>
          ← Leave
        </button>
        <div className="grow" />
        <NetBadge snap={snap} />
      </div>

      {!snap.solo && (
        <div className="card center">
          <h2>Room code</h2>
          <div className="room-code">{code}</div>
          <button className="btn block" onClick={share}>
            {copied ? 'Link copied' : 'Share invite link'}
          </button>
          <p className="dim tiny" style={{ wordBreak: 'break-all' }}>
            {link}
          </p>
        </div>
      )}

      <div className="card">
        <h2>
          Survivors ({snap.lobby.length}/{BALANCE.MAX_PLAYERS})
        </h2>
        {snap.lobby.map((p) => (
          <div className="player-row" key={p.playerId}>
            <span className={`dot ${snap.connected[p.playerId] ? 'on' : 'off'}`} />
            <span className="grow">
              {p.name}
              {p.playerId === me.playerId && <span className="dim"> (you)</span>}
              {p.host && <span className="dim tiny"> · host</span>}
            </span>
            <span className="small muted">{p.classId ? `${classDef(p.classId).icon} ${classDef(p.classId).name}` : 'choosing…'}</span>
            <span className={p.ready ? 'ok-text small' : 'dim small'}>{p.ready ? 'Ready' : '…'}</span>
          </div>
        ))}
        {snap.lobby.length < 2 && !snap.solo && <p className="muted small">Waiting for others to arrive. Send them the link.</p>}
      </div>

      <div className="card">
        <h2>Choose a class</h2>
        <div className="class-grid">
          {CLASSES.map((c) => {
            const taken = takenBy(c.id);
            return (
              <button
                key={c.id}
                className={`btn class-card ${me.classId === c.id ? 'selected' : ''}`}
                onClick={() => session.setLobby({ classId: c.id, ready: false })}
              >
                <span className="icon">{c.icon}</span>
                <span className="name">
                  {c.name} {taken.length > 0 && <span className="taken">· also {taken.join(', ')}</span>}
                </span>
                <span className="stats">
                  <span>
                    CMB <b>{c.combat}</b>
                  </span>
                  <span>
                    EVA <b>{c.evasion}</b>
                  </span>
                  <span>
                    SCV <b>{c.scavenging}</b>
                  </span>
                  <span>
                    HP <b>{c.hp}</b>
                  </span>
                </span>
                <span className="small muted">{c.passive}</span>
              </button>
            );
          })}
        </div>
      </div>

      {me.classId && (
        <div className="card">
          <h2>Starting perk</h2>
          <div className="choice-grid">
            {classDef(me.classId).startPerks.map((id) => (
              <button
                key={id}
                className={`btn small ${me.startPerk === id ? 'selected' : ''}`}
                style={{ minHeight: 60, textAlign: 'left' }}
                onClick={() => session.setLobby({ startPerk: id, ready: false })}
              >
                <div>{perkName(id)}</div>
                <div className="tiny muted">{perkDef(id).desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        className={`btn block ${me.ready ? 'selected' : ''}`}
        disabled={!me.classId}
        onClick={() => session.setLobby({ ready: !me.ready })}
      >
        {me.ready ? '✓ Ready — tap to change' : me.classId ? 'Ready' : 'Pick a class first'}
      </button>

      {starter ? (
        <button className="btn primary block" disabled={!canStart} onClick={() => session.startGame()}>
          {canStart ? `Start the run (${roster.length} players)` : `Need ${BALANCE.MIN_PLAYERS}+ ready players`}
        </button>
      ) : (
        <p className="muted small center">The host starts the run when everyone is ready.</p>
      )}
    </div>
  );
}
