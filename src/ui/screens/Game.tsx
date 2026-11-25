import { useEffect, useMemo, useState } from 'react';
import { BALANCE } from '../../engine/balance';
import { cellIndex, inBounds, step } from '../../engine/map';
import * as S from '../../engine/stats';
import type { ActionPayload, Dir, EncounterPayload, PlanAction } from '../../engine/types';
import { legalMoves, pendingFor, waveEta } from '../../engine/view';
import type { GameSession, SessionSnapshot } from '../../session/session';
import { ActionPanel } from '../components/ActionPanel';
import { DiceOverlay } from '../components/Dice';
import { EncounterSheet } from '../components/EncounterSheet';
import { LogList } from '../components/LogList';
import { MapGrid } from '../components/MapGrid';
import { NetBadge } from '../components/NetBadge';
import { PlayerCard } from '../components/PlayerCard';
import { Squad } from '../components/Squad';
import { actionLabel, listNames, nameOf } from '../format';
import { End } from './End';

type Tab = 'map' | 'pack' | 'log' | 'squad';

export function Game({ session, snap, code, onLeave }: { session: GameSession; snap: SessionSnapshot; code: string; onLeave: () => void }) {
  const state = snap.state;
  const myId = session.playerId;
  const me = state.players[myId];
  const [tab, setTab] = useState<Tab>('map');
  const [selected, setSelected] = useState<PlanAction | null>(null);
  const [perk, setPerk] = useState<string | null>(null);

  // reset local choices when a new round starts
  useEffect(() => {
    setSelected(null);
    setPerk(null);
  }, [state.round]);

  const myKey = `${state.round}:${myId}:action:0`;
  const submittedInput = session.store.get(myKey);
  const forced = session.store.has(`${state.round}:${myId}:force:0`);
  const submitted: ActionPayload | 'forced' | null = forced ? 'forced' : submittedInput?.type === 'action' ? submittedInput.payload : null;

  const myPending = pendingFor(state, myId);
  const planning = state.phase === 'plan' && !!me && myPending?.type === 'action';

  const targets = useMemo(() => {
    const m = new Map<number, Dir>();
    if (!planning || !me || submitted) return m;
    for (const d of legalMoves(state, me)) {
      const t = step(me.pos, d);
      if (inBounds(t, state.cols, state.rows)) m.set(cellIndex(t, state.cols), d);
    }
    return m;
  }, [planning, me, submitted, state]);

  const chosenCell = selected?.kind === 'move' && me ? cellIndex(step(me.pos, selected.dir), state.cols) : null;

  if (state.phase === 'over') {
    return (
      <>
        <DiceOverlay state={state} viewer={myId} />
        <End state={state} session={session} />
      </>
    );
  }

  const waitingNames = state.pending.filter((p) => p.playerId !== myId).map((p) => nameOf(state, p.playerId));
  const encWait = state.pending.find((p) => p.type === 'enc');
  let status: string;
  if (!me) status = 'You are watching from the rooftops.';
  else if (myPending?.type === 'enc') status = 'They have seen you. Decide.';
  else if (planning && !submitted) status = 'Your move.';
  else if (encWait) status = `Waiting for ${nameOf(state, encWait.playerId)} to face a ${encWait.foe === 'horde' ? 'horde' : 'walker'}…`;
  else if (state.pending.length) status = `Waiting for ${listNames(waitingNames)}`;
  else status = 'Resolving…';

  const eta = waveEta(state);
  const confirm = () => {
    if (!selected || !me) return;
    const payload: ActionPayload = me.perkOffer && perk ? { ...selected, perk } : selected;
    session.submit({ round: state.round, playerId: myId, type: 'action', n: 0, payload });
  };
  const decide = (p: EncounterPayload) => session.submit({ round: state.round, playerId: myId, type: 'enc', n: 0, payload: p });
  const pick = (d: Dir) => {
    setSelected({ kind: 'move', dir: d });
    setTab('map');
  };

  const offlinePending = state.pending.filter((p) => !snap.connected[p.playerId]).length;

  return (
    <div className="game">
      <div className="topbar">
        <div className="line1">
          <b>Round {state.round}</b>
          <span className="wave-chip small" title="Outbreak Wave: rows covered, rounds until it advances">
            🌊 {state.waveRows > 0 ? state.waveRows : '–'}
            {eta !== null && <span className="dim"> · {eta === 0 ? 'rising' : `+1 in ${eta}`}</span>}
          </span>
          <span className="grow" />
          {me && (
            <span className="hp-chip">
              ❤️ <span className="mono">{me.hp}</span>
              <span className="dim small">/{S.maxHp(me)}</span>
            </span>
          )}
          <NetBadge snap={snap} compact />
        </div>
        <div className="status">{status}</div>
      </div>

      <div className="content">
        {snap.status === 'reconnecting' && <div className="banner warn small">Signal lost. Reconnecting… Your moves are saved and will sync.</div>}
        {snap.status === 'alone' && !snap.solo && state.roster.length > 1 && (
          <div className="banner warn small">Nobody else is connected right now. Moves are saved; the game resumes when they return.</div>
        )}

        {tab === 'map' && (
          <>
            <MapGrid state={state} viewer={me ? myId : null} targets={targets} chosen={chosenCell} onPick={pick} />
            {me ? (
              state.phase === 'plan' ? (
                <ActionPanel
                  state={state}
                  me={me}
                  selected={selected}
                  perk={perk}
                  submitted={submitted}
                  waitingFor={waitingNames}
                  onSelect={setSelected}
                  onPerk={setPerk}
                  onConfirm={confirm}
                />
              ) : (
                <div className="panel">
                  <b>Resolving round {state.round}</b>
                  <div className="small muted">
                    {state.order.map((id) => {
                      const a = state.revealedActions[id];
                      const p = state.players[id];
                      return a && p ? (
                        <div key={id}>
                          <span className="dot" style={{ background: p.color, marginRight: 6 }} />
                          {p.name}: {actionLabel(a, p)}
                          {state.resolvedThisRound.includes(id) ? ' ✓' : ''}
                        </div>
                      ) : null;
                    })}
                  </div>
                  <span className="hint">{status}</span>
                </div>
              )
            ) : (
              <div className="banner small">Room {code}. You are not in this run. You can watch.</div>
            )}
            <div className="card">
              <h3>Latest</h3>
              <LogList state={state} limit={8} />
            </div>
          </>
        )}
        {tab === 'pack' && (me ? <PlayerCard state={state} p={me} /> : <p className="muted">You have no pack. You are not in this run.</p>)}
        {tab === 'log' && (
          <div className="card">
            <LogList state={state} />
          </div>
        )}
        {tab === 'squad' && (
          <>
            <Squad state={state} snap={snap} onSkip={(id) => session.forceSkip(id)} />
            <div className="card small muted">
              <h3>Rules of the road</h3>
              Reach the top row first. Walkers need {BALANCE.ZOMBIE_DIFFICULTY}+, hordes {BALANCE.HORDE_DIFFICULTY}+ on 2d6 + Combat. Fleeing needs{' '}
              {BALANCE.FLEE_DIFFICULTY}+ with Evasion. Cleared cells are free to cross. After {BALANCE.MAX_CONSECUTIVE_MOVES} moves in a row you must rest. The
              Wave rises from round {BALANCE.WAVE_START_ROUND} and bleeds anyone inside it.
            </div>
            <button className="btn ghost block" onClick={onLeave}>
              Leave to menu (the run stays saved)
            </button>
          </>
        )}
      </div>

      <nav className="tabs">
        {(
          [
            ['map', '🗺️', 'Map'],
            ['pack', '🎒', 'Pack'],
            ['log', '📜', 'Log'],
            ['squad', '👥', 'Squad'],
          ] as const
        ).map(([id, ico, label]) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
            <span className="ico">{ico}</span>
            {label}
            {id === 'squad' && offlinePending > 0 && <span className="badge">{offlinePending}</span>}
          </button>
        ))}
      </nav>

      {me && myPending?.type === 'enc' && <EncounterSheet key={`${state.round}-${myPending.cell}`} state={state} me={me} pending={myPending} onDecide={decide} />}
      <DiceOverlay state={state} viewer={myId} />
    </div>
  );
}
