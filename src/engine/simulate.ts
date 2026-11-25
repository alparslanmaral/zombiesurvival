/** Headless game runner: bots play every seat. Used by the simulator and tests. */
import { botInput } from './bot';
import { classDef } from './data/classes';
import { deriveState } from './engine';
import { InputSet } from './inputs';
import type { ClassId, GameInput, GameState, RosterEntry } from './types';

export function makeStartInput(seed: string, roster: RosterEntry[], hostId = roster[0]?.id ?? 'host'): GameInput {
  return { round: 0, playerId: hostId, type: 'start', n: 0, payload: { seed, roster } };
}

export function botRoster(classes: ClassId[], startPerkIndex = 0): RosterEntry[] {
  return classes.map((classId, i) => ({
    id: `bot${i + 1}`,
    name: `Bot ${i + 1}`,
    classId,
    startPerk: classDef(classId).startPerks[startPerkIndex % 2] as string,
    bot: true,
  }));
}

export interface SimResult {
  state: GameState;
  inputs: GameInput[];
  steps: number;
}

/** Play a full game with bots for every seat. */
export function simulateGame(seed: string, roster: RosterEntry[], maxSteps = 2000): SimResult {
  const set = new InputSet([makeStartInput(seed, roster)]);
  let state = deriveState(set);
  let steps = 0;
  while (state.phase !== 'over' && steps < maxSteps) {
    steps++;
    let progressed = false;
    for (const pend of state.pending) {
      const inp = botInput(state, pend.playerId);
      if (inp && set.add(inp)) progressed = true;
    }
    if (!progressed) break;
    state = deriveState(set);
  }
  return { state, inputs: set.values(), steps };
}
