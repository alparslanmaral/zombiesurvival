/**
 * Balance simulator: plays N bot games and checks the balance targets.
 *
 *   npm run sim                 # 1000 four-player games
 *   npm run sim -- --games 200 --players 3 --no-check
 */
import { CLASSES } from '../src/engine/data/classes';
import { botRoster, simulateGame } from '../src/engine/simulate';
import { makeRng } from '../src/engine/rng';
import type { ClassId } from '../src/engine/types';

const args = process.argv.slice(2);
const arg = (name: string, def: number): number => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : def;
};
const GAMES = arg('games', 1000);
const PLAYERS = arg('players', 4);
const CHECK = !args.includes('--no-check');

// Targets from the design brief.
const TARGET_MIN_ROUNDS = 14;
const TARGET_MAX_ROUNDS = 18;
const TARGET_MAX_CLASS_WINRATE = 0.35;

// Rough table-time model for "average duration" (seconds).
const PLAN_SECONDS = 45;
const DECISION_SECONDS = 12;
const ROLL_SECONDS = 2.5;

const classIds = CLASSES.map((c) => c.id);
const appearances = Object.fromEntries(classIds.map((c) => [c, 0])) as Record<ClassId, number>;
const wins = Object.fromEntries(classIds.map((c) => [c, 0])) as Record<ClassId, number>;
let totalRounds = 0;
let totalSeconds = 0;
let timeouts = 0;
let knockouts = 0;
let minRounds = Infinity;
let maxRounds = 0;
const roundHist = new Map<number, number>();
const t0 = performance.now();

function runBatch(games: number, players: number, seedPrefix: string): { avgRounds: number } {
  let rounds = 0;
  for (let g = 0; g < games; g++) {
    const seed = `${seedPrefix}-${g}`;
    const pick = makeRng(seed, 'sim-classes');
    const classes = pick.shuffle(classIds).slice(0, players);
    const roster = botRoster(classes, pick.int(2));
    const { state, inputs } = simulateGame(seed, roster);
    if (state.phase !== 'over') throw new Error(`game ${seed} did not finish (round ${state.round})`);
    rounds += state.round;
    if (seedPrefix !== 'main') continue;
    totalRounds += state.round;
    minRounds = Math.min(minRounds, state.round);
    maxRounds = Math.max(maxRounds, state.round);
    roundHist.set(state.round, (roundHist.get(state.round) ?? 0) + 1);
    if (state.winReason === 'timeout') timeouts++;
    for (const c of classes) appearances[c]++;
    const w = state.winner ? state.players[state.winner] : undefined;
    if (w) wins[w.classId]++;
    const decisions = inputs.filter((i) => i.type === 'enc').length;
    const rolls = state.log.filter((l) => l.roll).length;
    totalSeconds += state.round * PLAN_SECONDS + decisions * DECISION_SECONDS + rolls * ROLL_SECONDS;
    knockouts += Object.values(state.players).reduce((s, p) => s + p.stats.knockouts, 0);
  }
  return { avgRounds: rounds / games };
}

runBatch(GAMES, PLAYERS, 'main');
const avgRounds = totalRounds / GAMES;
const avgMinutes = totalSeconds / GAMES / 60;

console.log(`\nAshen Road balance sim — ${GAMES} games, ${PLAYERS} players, ${((performance.now() - t0) / 1000).toFixed(1)}s\n`);
console.log(`Average rounds:        ${avgRounds.toFixed(2)}  (min ${minRounds}, max ${maxRounds}, target ${TARGET_MIN_ROUNDS}-${TARGET_MAX_ROUNDS})`);
console.log(`Estimated duration:    ${avgMinutes.toFixed(1)} min  (model: ${PLAN_SECONDS}s/plan, ${DECISION_SECONDS}s/decision, ${ROLL_SECONDS}s/roll)`);
console.log(`Timeouts (no winner):  ${timeouts}`);
console.log(`Knockouts per game:    ${(knockouts / GAMES).toFixed(2)}`);
console.log('\nRounds histogram:');
for (const r of [...roundHist.keys()].sort((a, b) => a - b)) {
  const n = roundHist.get(r) ?? 0;
  console.log(`  ${String(r).padStart(2)} ${'#'.repeat(Math.ceil((n / GAMES) * 100))} ${n}`);
}
console.log('\nWin rate per class (wins / games played as that class):');
let worst = 0;
for (const c of classIds) {
  const rate = appearances[c] ? wins[c] / appearances[c] : 0;
  worst = Math.max(worst, rate);
  console.log(`  ${c.padEnd(10)} ${(rate * 100).toFixed(1).padStart(5)}%   (${wins[c]}/${appearances[c]})`);
}

if (PLAYERS === 4) {
  console.log('\nOther table sizes (200 games each):');
  for (const n of [2, 3]) console.log(`  ${n} players: ${runBatch(200, n, `alt${n}`).avgRounds.toFixed(2)} rounds`);
}

if (CHECK) {
  const problems: string[] = [];
  if (avgRounds < TARGET_MIN_ROUNDS || avgRounds > TARGET_MAX_ROUNDS) problems.push(`average rounds ${avgRounds.toFixed(2)} outside ${TARGET_MIN_ROUNDS}-${TARGET_MAX_ROUNDS}`);
  if (worst > TARGET_MAX_CLASS_WINRATE) problems.push(`a class wins ${(worst * 100).toFixed(1)}% (> ${TARGET_MAX_CLASS_WINRATE * 100}%)`);
  if (problems.length) {
    console.error(`\nBALANCE CHECK FAILED: ${problems.join('; ')}`);
    process.exit(1);
  }
  console.log('\nBalance check passed.');
}
