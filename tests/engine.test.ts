import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/engine/balance';
import { CLASSES } from '../src/engine/data/classes';
import { deriveState, orderForRound } from '../src/engine/engine';
import { canonicalJson, inputKey, InputSet, isValidInput } from '../src/engine/inputs';
import { generateMap, isSolvable, minHazardToGoal, startColumns } from '../src/engine/map';
import { gameRng, makeRng, roll2d6 } from '../src/engine/rng';
import { botRoster, makeStartInput, simulateGame } from '../src/engine/simulate';
import { successChance } from '../src/engine/stats';
import type { GameInput, GameState, RosterEntry } from '../src/engine/types';

const roster4: RosterEntry[] = botRoster(['scout', 'guardian', 'medic', 'engineer']);

function fingerprint(s: GameState): string {
  return canonicalJson({
    round: s.round,
    phase: s.phase,
    winner: s.winner,
    players: s.players,
    cells: s.cells,
    pending: s.pending,
    log: s.log.map((l) => l.text),
  });
}

describe('rng', () => {
  it('is deterministic per address', () => {
    expect(roll2d6('seed', 3, 'p1', 'enc')).toEqual(roll2d6('seed', 3, 'p1', 'enc'));
    const a = gameRng('s', 1, 'p', 'x');
    const b = gameRng('s', 1, 'p', 'x');
    for (let i = 0; i < 20; i++) expect(a.next()).toBe(b.next());
  });

  it('differs by address component', () => {
    const base = Array.from({ length: 30 }, (_, r) => roll2d6('seed', r, 'p1', 'enc').join());
    const otherPlayer = Array.from({ length: 30 }, (_, r) => roll2d6('seed', r, 'p2', 'enc').join());
    const otherSeed = Array.from({ length: 30 }, (_, r) => roll2d6('seed2', r, 'p1', 'enc').join());
    expect(base).not.toEqual(otherPlayer);
    expect(base).not.toEqual(otherSeed);
  });

  it('produces fair-looking d6 values', () => {
    const counts = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 6000; i++) {
      const [a] = roll2d6('fair', i, 'p', 'x');
      counts[a - 1]!++;
    }
    for (const c of counts) expect(c).toBeGreaterThan(850);
  });

  it('success chance honours crits', () => {
    expect(successChance(100, 7)).toBeCloseTo(35 / 36);
    expect(successChance(-100, 7)).toBeCloseTo(1 / 36);
  });
});

describe('map generation', () => {
  it('is deterministic for a seed', () => {
    expect(generateMap('abc', 4)).toEqual(generateMap('abc', 4));
  });

  it('every start can always reach the Safe Zone (500 seeds, 2-4 players)', () => {
    for (let i = 0; i < 500; i++) {
      const n = 2 + (i % 3);
      const { cells } = generateMap(`solv-${i}`, n);
      const starts = startColumns(n, BALANCE.COLS).map((x) => ({ x, y: BALANCE.ROWS - 1 }));
      expect(isSolvable(cells, BALANCE.COLS, BALANCE.ROWS, starts)).toBe(true);
      for (const st of starts) expect(minHazardToGoal(cells, BALANCE.COLS, BALANCE.ROWS, st)).toBeLessThanOrEqual(BALANCE.MAX_PATH_HAZARD);
    }
  });

  it('has the right shape and roughly the configured blocked share', () => {
    let blocked = 0;
    let inner = 0;
    for (let i = 0; i < 200; i++) {
      const { cells } = generateMap(`shape-${i}`, 4);
      expect(cells).toHaveLength(BALANCE.COLS * BALANCE.ROWS);
      cells.forEach((c, idx) => {
        const y = Math.floor(idx / BALANCE.COLS);
        if (y === 0) expect(c.type).toBe('safe');
        else if (y === BALANCE.ROWS - 1) expect(c.type).toBe('start');
        else {
          inner++;
          if (c.type === 'blocked') blocked++;
        }
      });
    }
    expect(blocked / inner).toBeGreaterThan(0.06);
    expect(blocked / inner).toBeLessThan(0.18);
  });

  it('start columns are distinct', () => {
    for (let n = 1; n <= 4; n++) expect(new Set(startColumns(n, 7)).size).toBe(n);
  });
});

describe('inputs', () => {
  it('validates structure', () => {
    expect(isValidInput({ round: 1, playerId: 'p1', type: 'action', n: 0, payload: { kind: 'wait' } })).toBe(true);
    expect(isValidInput({ round: 1, playerId: 'p1', type: 'action', n: 0, payload: { kind: 'fly' } })).toBe(false);
    expect(isValidInput({ round: -1, playerId: 'p1', type: 'action', n: 0, payload: { kind: 'wait' } })).toBe(false);
    expect(isValidInput({ round: 1, playerId: 'bad id!', type: 'action', n: 0, payload: { kind: 'wait' } })).toBe(false);
    expect(isValidInput(null)).toBe(false);
  });

  it('is idempotent: duplicates do not change the set', () => {
    const set = new InputSet();
    const i: GameInput = { round: 1, playerId: 'p1', type: 'action', n: 0, payload: { kind: 'wait' } };
    expect(set.add(i)).toBe(true);
    expect(set.add({ ...i })).toBe(false);
    expect(set.add(JSON.parse(JSON.stringify(i)))).toBe(false);
    expect(set.size).toBe(1);
  });

  it('resolves same-key conflicts identically regardless of arrival order', () => {
    const a: GameInput = { round: 1, playerId: 'p1', type: 'action', n: 0, payload: { kind: 'move', dir: 'N' } };
    const b: GameInput = { round: 1, playerId: 'p1', type: 'action', n: 0, payload: { kind: 'wait' } };
    const s1 = new InputSet([a, b]);
    const s2 = new InputSet([b, a]);
    expect(s1.get(inputKey(a))).toEqual(s2.get(inputKey(a)));
    expect(s1.digest()).toEqual(s2.digest());
  });
});

describe('replay determinism', () => {
  const games = Array.from({ length: 12 }, (_, i) => {
    const pick = makeRng('det', i);
    const classes = pick.shuffle(CLASSES.map((c) => c.id)).slice(0, 2 + (i % 3));
    return simulateGame(`det-${i}`, botRoster(classes, i % 2));
  });

  it('bot games finish', () => {
    for (const g of games) expect(g.state.phase).toBe('over');
  });

  it('input order does not matter (shuffled replays are identical)', () => {
    for (const [gi, g] of games.entries()) {
      const ref = fingerprint(deriveState(g.inputs));
      for (let k = 0; k < 5; k++) {
        const shuffled = makeRng('shuffle', gi, k).shuffle(g.inputs);
        expect(fingerprint(deriveState(shuffled))).toBe(ref);
      }
      expect(fingerprint(deriveState([...g.inputs].reverse()))).toBe(ref);
    }
  });

  it('duplicated inputs do not change the state', () => {
    const g = games[0]!;
    const ref = fingerprint(deriveState(g.inputs));
    const dup = [...g.inputs, ...g.inputs.map((i) => JSON.parse(JSON.stringify(i)) as GameInput)];
    expect(fingerprint(deriveState(makeRng('dup').shuffle(dup)))).toBe(ref);
  });

  it('every prefix of the history is a valid intermediate state', () => {
    const g = games[1]!;
    // sort by round so prefixes are plausible histories
    const sorted = [...g.inputs].sort((a, b) => a.round - b.round);
    for (let n = 1; n <= sorted.length; n += 3) {
      const s = deriveState(sorted.slice(0, n));
      expect(['plan', 'resolve', 'over']).toContain(s.phase);
    }
  });

  it('a round does not resolve until every required input exists', () => {
    const start = makeStartInput('wait-test', roster4);
    const ins: GameInput[] = [start];
    for (const r of roster4.slice(0, 3)) ins.push({ round: 1, playerId: r.id, type: 'action', n: 0, payload: { kind: 'wait' } });
    const s = deriveState(ins);
    expect(s.round).toBe(1);
    expect(s.phase).toBe('plan');
    expect(s.pending).toEqual([{ type: 'action', playerId: roster4[3]!.id }]);
  });

  it('rotates the resolution order every round', () => {
    expect(orderForRound(roster4, 1)).toEqual(['bot1', 'bot2', 'bot3', 'bot4']);
    expect(orderForRound(roster4, 2)).toEqual(['bot2', 'bot3', 'bot4', 'bot1']);
    expect(orderForRound(roster4, 5)).toEqual(['bot1', 'bot2', 'bot3', 'bot4']);
  });
});

describe('forced inputs ("Skip, count as Wait")', () => {
  const start = makeStartInput('force-test', roster4);
  const moves: GameInput[] = roster4.map((r) => ({ round: 1, playerId: r.id, type: 'action', n: 0, payload: { kind: 'move', dir: 'N' } }));
  const force: GameInput = { round: 1, playerId: 'bot2', type: 'force', n: 0, payload: { by: 'bot1' } };

  it('replaces a missing action so the round can resolve', () => {
    const s = deriveState([start, ...moves.filter((m) => m.playerId !== 'bot2'), force]);
    expect(s.round).toBeGreaterThanOrEqual(1);
    expect(s.pending.some((p) => p.type === 'action' && p.playerId === 'bot2' && s.round === 1)).toBe(false);
    expect(s.players.bot2!.pos).toEqual(deriveState([start]).players.bot2!.pos);
  });

  it('beats a real input regardless of arrival order', () => {
    const a = deriveState([start, ...moves, force]);
    const b = deriveState([force, start, ...moves]);
    const c = deriveState([...moves.reverse(), force, start]);
    expect(fingerprint(a)).toBe(fingerprint(b));
    expect(fingerprint(a)).toBe(fingerprint(c));
    // bot2 counted as Wait: it did not move
    expect(a.players.bot2!.pos).toEqual(deriveState([start]).players.bot2!.pos);
    expect(a.revealedActions.bot2 ?? 'forced').toBe('forced');
  });

  it('answers a pending encounter as Hide', () => {
    // find a game where someone is waiting on an encounter decision, then force them
    for (let i = 0; i < 50; i++) {
      const g = simulateGame(`enc-${i}`, botRoster(['guardian', 'scout']));
      const encs = g.inputs.filter((x) => x.type === 'enc');
      const target = encs[0];
      if (!target) continue;
      const without = g.inputs.filter((x) => inputKey(x) !== inputKey(target) && x.round <= target.round);
      const blocked = deriveState(without);
      expect(blocked.pending[0]).toMatchObject({ type: 'enc', playerId: target.playerId });
      const forced = deriveState([...without, { round: target.round, playerId: target.playerId, type: 'force', n: 0, payload: { by: 'x' } }]);
      expect(forced.pending.some((p) => p.type === 'enc' && p.playerId === target.playerId && forced.round === target.round)).toBe(false);
      return;
    }
    throw new Error('no encounter found in sample games');
  });
});

describe('rules', () => {
  it('starting state matches class data', () => {
    const s = deriveState([makeStartInput('start', roster4)]);
    expect(s.phase).toBe('plan');
    expect(s.round).toBe(1);
    expect(s.players.bot2!.hp).toBe(12); // guardian
    expect(s.players.bot3!.inventory.map((i) => i.defId)).toContain('firstaid'); // medic
    const xs = Object.values(s.players).map((p) => p.pos.x);
    expect(new Set(xs).size).toBe(4);
  });

  it('knocked-out players are not waited for', () => {
    for (let i = 0; i < 200; i++) {
      const g = simulateGame(`ko-${i}`, botRoster(['scout', 'medic', 'guardian']));
      const koLog = g.state.log.find((l) => l.kind === 'ko' && l.text.includes('goes down'));
      if (!koLog?.playerId) continue;
      const pid = koLog.playerId;
      const r = koLog.round;
      // the knocked-out player submits no actions for the next rounds
      const acts = g.inputs.filter((x) => x.type === 'action' && x.playerId === pid && x.round > r && x.round <= r + 2);
      expect(acts.length).toBe(0);
      return;
    }
  });

  it('games always end (safe zone or timeout)', () => {
    for (let i = 0; i < 60; i++) {
      const g = simulateGame(`end-${i}`, botRoster(['scavenger', 'engineer', 'medic', 'scout']));
      expect(g.state.phase).toBe('over');
      expect(g.state.winner).toBeTruthy();
    }
  });
});
