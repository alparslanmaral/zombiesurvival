import { BALANCE } from './balance';
import { EVENTS } from './data/events';
import { makeRng } from './rng';
import type { Cell, CellType, Dir, Pos } from './types';

export const DIRS: readonly Dir[] = ['N', 'E', 'S', 'W'];

export const DIR_DELTA: Record<Dir, Pos> = {
  N: { x: 0, y: -1 },
  E: { x: 1, y: 0 },
  S: { x: 0, y: 1 },
  W: { x: -1, y: 0 },
};

export function step(pos: Pos, dir: Dir): Pos {
  const d = DIR_DELTA[dir];
  return { x: pos.x + d.x, y: pos.y + d.y };
}

export function inBounds(p: Pos, cols: number, rows: number): boolean {
  return p.x >= 0 && p.y >= 0 && p.x < cols && p.y < rows;
}

export function cellIndex(p: Pos, cols: number): number {
  return p.y * cols + p.x;
}

export function cellPos(i: number, cols: number): Pos {
  return { x: i % cols, y: Math.floor(i / cols) };
}

export function dirBetween(a: Pos, b: Pos): Dir | null {
  for (const d of DIRS) {
    const s = step(a, d);
    if (s.x === b.x && s.y === b.y) return d;
  }
  return null;
}

/** Spread start columns across the bottom row. */
export function startColumns(playerCount: number, cols: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < playerCount; i++) {
    out.push(Math.min(cols - 1, Math.floor(((i + 0.5) * cols) / playerCount)));
  }
  return out;
}

/** BFS over non-blocked cells; returns distance to the Safe Zone row from each cell (-1 = unreachable). */
export function distancesToGoal(cells: readonly Cell[], cols: number, rows: number): number[] {
  const dist = new Array<number>(cells.length).fill(-1);
  const queue: number[] = [];
  for (let x = 0; x < cols; x++) {
    const i = cellIndex({ x, y: 0 }, cols);
    if (cells[i]?.type !== 'blocked') {
      dist[i] = 0;
      queue.push(i);
    }
  }
  for (let qi = 0; qi < queue.length; qi++) {
    const cur = queue[qi] as number;
    const p = cellPos(cur, cols);
    for (const d of DIRS) {
      const n = step(p, d);
      if (!inBounds(n, cols, rows)) continue;
      const ni = cellIndex(n, cols);
      if (dist[ni] !== -1 || cells[ni]?.type === 'blocked') continue;
      dist[ni] = (dist[cur] as number) + 1;
      queue.push(ni);
    }
  }
  return dist;
}

export function isSolvable(cells: readonly Cell[], cols: number, rows: number, starts: readonly Pos[]): boolean {
  const dist = distancesToGoal(cells, cols, rows);
  return starts.every((s) => (dist[cellIndex(s, cols)] ?? -1) >= 0);
}

/**
 * Least "hazard" on any route from `from` to the Safe Zone: walkers cost 1, hordes 2,
 * everything else 0 (Dijkstra over a tiny grid). Infinity if unreachable.
 */
export function minHazardToGoal(cells: readonly Cell[], cols: number, rows: number, from: Pos): number {
  const n = cells.length;
  const dist = new Array<number>(n).fill(Infinity);
  const done = new Array<boolean>(n).fill(false);
  const hz = (c: Cell | undefined) => (c?.type === 'horde' ? 2 : c?.type === 'zombie' ? 1 : 0);
  const s = cellIndex(from, cols);
  dist[s] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!done[i] && (dist[i] as number) < Infinity && (u < 0 || (dist[i] as number) < (dist[u] as number))) u = i;
    if (u < 0) return Infinity;
    done[u] = true;
    const up = cellPos(u, cols);
    if (up.y === 0) return dist[u] as number;
    for (const d of DIRS) {
      const q = step(up, d);
      if (!inBounds(q, cols, rows)) continue;
      const v = cellIndex(q, cols);
      const c = cells[v];
      if (c?.type === 'blocked') continue;
      const nd = (dist[u] as number) + hz(c);
      if (nd < (dist[v] as number)) dist[v] = nd;
    }
  }
}

export interface GeneratedMap {
  cells: Cell[];
  attempts: number;
}

/** Generate the map from the seed. Retries deterministically until every start can reach the goal. */
export function generateMap(seed: string, playerCount: number): GeneratedMap {
  const cols = BALANCE.COLS;
  const rows = BALANCE.ROWS;
  const starts = startColumns(playerCount, cols).map((x) => ({ x, y: rows - 1 }));
  const weights = Object.entries(BALANCE.CELL_WEIGHTS) as [CellType, number][];
  const wallWeights = Object.entries(BALANCE.WALL_WEIGHTS) as [CellType, number][];

  for (let attempt = 0; attempt < BALANCE.MAX_MAP_ATTEMPTS; attempt++) {
    const rng = makeRng(seed, 'map', attempt);
    const cells: Cell[] = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        let type: CellType;
        if (y === 0) type = 'safe';
        else if (y === rows - 1) type = 'start';
        else type = rng.weighted(y <= BALANCE.WALL_ROWS ? wallWeights : weights);
        const cell: Cell = { type, cleared: false, revealed: y === 0 || y === rows - 1 };
        if (type === 'event') cell.eventId = rng.pick(EVENTS).id;
        cells.push(cell);
      }
    }
    if (
      isSolvable(cells, cols, rows, starts) &&
      starts.every((st) => minHazardToGoal(cells, cols, rows, st) <= BALANCE.MAX_PATH_HAZARD)
    ) {
      return { cells, attempts: attempt + 1 };
    }
  }
  // Fallback: carve a straight corridor so the game can always be played.
  const rng = makeRng(seed, 'map', 'fallback');
  const cells: Cell[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const type: CellType = y === 0 ? 'safe' : y === rows - 1 ? 'start' : rng.next() < 0.2 ? 'zombie' : 'empty';
      cells.push({ type, cleared: false, revealed: y === 0 || y === rows - 1 });
    }
  }
  return { cells, attempts: BALANCE.MAX_MAP_ATTEMPTS + 1 };
}

export function isZombieCell(cell: Cell | undefined): boolean {
  return !!cell && (cell.type === 'zombie' || cell.type === 'horde') && !cell.cleared;
}
