/**
 * Hex map. Pointy-top hexes in "odd-r" offset coordinates: (x = column, y = row),
 * odd rows are shifted half a hex to the right. Row 0 is the Safe Zone (north),
 * the last row is the City (south).
 *
 * The map is a street network: a few trunk roads climb north, side streets branch
 * off them, some loop back into another road, some end in dead ends (often with a
 * reward). Everything else is ruins. The street layout is public knowledge (old
 * city maps); what is *on* each street is hidden by fog.
 */
import { BALANCE } from './balance';
import { EVENTS } from './data/events';
import { makeRng, type Rng } from './rng';
import type { Cell, CellType, Dir, Pos } from './types';

export const DIRS: readonly Dir[] = ['NE', 'E', 'SE', 'SW', 'W', 'NW'];
export const NORTH_DIRS: readonly Dir[] = ['NE', 'NW'];

const EVEN_ROW: Record<Dir, Pos> = {
  NE: { x: 0, y: -1 },
  E: { x: 1, y: 0 },
  SE: { x: 0, y: 1 },
  SW: { x: -1, y: 1 },
  W: { x: -1, y: 0 },
  NW: { x: -1, y: -1 },
};
const ODD_ROW: Record<Dir, Pos> = {
  NE: { x: 1, y: -1 },
  E: { x: 1, y: 0 },
  SE: { x: 1, y: 1 },
  SW: { x: 0, y: 1 },
  W: { x: -1, y: 0 },
  NW: { x: 0, y: -1 },
};

export function step(pos: Pos, dir: Dir): Pos {
  const d = (pos.y & 1 ? ODD_ROW : EVEN_ROW)[dir];
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

export function neighbors(p: Pos, cols: number, rows: number): Pos[] {
  return DIRS.map((d) => step(p, d)).filter((q) => inBounds(q, cols, rows));
}

export function dirBetween(a: Pos, b: Pos): Dir | null {
  for (const d of DIRS) {
    const s = step(a, d);
    if (s.x === b.x && s.y === b.y) return d;
  }
  return null;
}

/** Hex distance between two offset positions. */
export function hexDistance(a: Pos, b: Pos): number {
  const aq = a.x - (a.y - (a.y & 1)) / 2;
  const bq = b.x - (b.y - (b.y & 1)) / 2;
  const dq = aq - bq;
  const dr = a.y - b.y;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

/** Spread start columns across the bottom row. */
export function startColumns(playerCount: number, cols: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < playerCount; i++) out.push(Math.min(cols - 1, Math.floor(((i + 0.5) * cols) / playerCount)));
  return out;
}

export function isImpassable(c: Cell | undefined): boolean {
  return !c || c.type === 'blocked' || c.type === 'ruin';
}

/** BFS over passable cells; distance to the Safe Zone row from each cell (-1 = unreachable). */
export function distancesToGoal(cells: readonly Cell[], cols: number, rows: number): number[] {
  const dist = new Array<number>(cells.length).fill(-1);
  const queue: number[] = [];
  for (let x = 0; x < cols; x++) {
    const i = cellIndex({ x, y: 0 }, cols);
    if (!isImpassable(cells[i])) {
      dist[i] = 0;
      queue.push(i);
    }
  }
  for (let qi = 0; qi < queue.length; qi++) {
    const cur = queue[qi] as number;
    for (const n of neighbors(cellPos(cur, cols), cols, rows)) {
      const ni = cellIndex(n, cols);
      if (dist[ni] !== -1 || isImpassable(cells[ni])) continue;
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

/** Least hazard on any route to the Safe Zone: walkers 1, hordes 2 (Dijkstra). */
export function minHazardToGoal(cells: readonly Cell[], cols: number, rows: number, from: Pos): number {
  const n = cells.length;
  const dist = new Array<number>(n).fill(Infinity);
  const done = new Array<boolean>(n).fill(false);
  const hz = (c: Cell | undefined) => (c?.type === 'horde' ? 2 : c?.type === 'zombie' ? 1 : 0);
  dist[cellIndex(from, cols)] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!done[i] && (dist[i] as number) < Infinity && (u < 0 || (dist[i] as number) < (dist[u] as number))) u = i;
    if (u < 0) return Infinity;
    done[u] = true;
    const up = cellPos(u, cols);
    if (up.y === 0) return dist[u] as number;
    for (const q of neighbors(up, cols, rows)) {
      const v = cellIndex(q, cols);
      const c = cells[v];
      if (isImpassable(c)) continue;
      const nd = (dist[u] as number) + hz(c);
      if (nd < (dist[v] as number)) dist[v] = nd;
    }
  }
}

export interface GeneratedMap {
  cells: Cell[];
  attempts: number;
}

// ---------------------------------------------------------------- street network

interface Layout {
  road: boolean[];
  /** dead-end tips of side streets */
  tips: Set<number>;
}

function carveStreets(rng: Rng, cols: number, rows: number): Layout {
  const road = new Array<boolean>(cols * rows).fill(false);
  const tips = new Set<number>();
  const idx = (p: Pos) => cellIndex(p, cols);
  for (let x = 0; x < cols; x++) {
    road[idx({ x, y: 0 })] = true;
    road[idx({ x, y: rows - 1 })] = true;
  }
  const inner = (p: Pos) => inBounds(p, cols, rows) && p.y > 0 && p.y < rows - 1;

  // trunks: wander north from the City to the Safe Zone
  const trunks = BALANCE.MAP_TRUNKS;
  for (let t = 0; t < trunks; t++) {
    const x0 = Math.floor(((t + 0.5) * cols) / trunks) + rng.int(3) - 1;
    let p: Pos = { x: Math.max(0, Math.min(cols - 1, x0)), y: rows - 2 };
    road[idx(p)] = true;
    let lastLateral: Dir | null = null;
    for (let guard = 0; guard < rows * 4 && p.y > 1; guard++) {
      const options: [Dir, number][] = [
        ['NE', 4],
        ['NW', 4],
        ['E', lastLateral === 'W' ? 0 : BALANCE.MAP_TRUNK_LATERAL],
        ['W', lastLateral === 'E' ? 0 : BALANCE.MAP_TRUNK_LATERAL],
      ];
      const valid = options.filter(([d, w]) => w > 0 && inner(step(p, d)));
      if (!valid.length) break;
      const d = rng.weighted(valid);
      p = step(p, d);
      lastLateral = d === 'E' || d === 'W' ? d : null;
      road[idx(p)] = true;
    }
  }

  // side streets: branch off existing roads; loop into another road or dead-end
  const branches = BALANCE.MAP_BRANCHES_MIN + rng.int(BALANCE.MAP_BRANCHES_MAX - BALANCE.MAP_BRANCHES_MIN + 1);
  for (let b = 0; b < branches; b++) {
    const candidates: number[] = [];
    road.forEach((r, i) => {
      const y = Math.floor(i / cols);
      if (r && y > 1 && y < rows - 2) candidates.push(i);
    });
    if (!candidates.length) break;
    let p = cellPos(rng.pick(candidates), cols);
    const len = 2 + rng.int(4);
    let dir = rng.pick(DIRS);
    const carved: number[] = [];
    for (let k = 0; k < len; k++) {
      // mostly keep heading, sometimes turn (never straight back south)
      if (rng.next() < 0.35) dir = rng.pick(DIRS.filter((d) => d !== 'SE' && d !== 'SW'));
      const q = step(p, dir);
      if (!inner(q)) break;
      const qi = idx(q);
      if (road[qi] && k > 0) break; // joined another road: a loop
      road[qi] = true;
      carved.push(qi);
      p = q;
    }
  }

  // spurs: short alleys that dead-end in the ruins (rewards for a detour)
  const links = (p: Pos) => neighbors(p, cols, rows).filter((q) => road[idx(q)]).length;
  for (let s = 0; s < BALANCE.MAP_SPURS; s++) {
    const candidates: number[] = [];
    road.forEach((r, i) => {
      const y = Math.floor(i / cols);
      if (r && y > 1 && y < rows - 2) candidates.push(i);
    });
    for (let tries = 0; tries < 12 && candidates.length; tries++) {
      const from = cellPos(rng.pick(candidates), cols);
      const d = rng.pick(DIRS);
      const q = step(from, d);
      if (!inner(q) || road[idx(q)] || links(q) !== 1) continue;
      road[idx(q)] = true;
      let tip = q;
      const q2 = step(q, d);
      if (rng.next() < 0.5 && inner(q2) && !road[idx(q2)] && links(q2) === 1) {
        road[idx(q2)] = true;
        tip = q2;
      }
      tips.add(idx(tip));
      break;
    }
  }
  // a tip only counts while it is still a dead end
  for (const t of [...tips]) if (links(cellPos(t, cols)) !== 1) tips.delete(t);
  return { road, tips };
}

function pickContent(rng: Rng, y: number, isTip: boolean): CellType {
  if (isTip) return rng.weighted(Object.entries(BALANCE.DEAD_END_WEIGHTS) as [CellType, number][]);
  const weights = y <= BALANCE.WALL_ROWS ? BALANCE.WALL_WEIGHTS : BALANCE.CELL_WEIGHTS;
  return rng.weighted(Object.entries(weights) as [CellType, number][]);
}

function roadShare(road: boolean[], cols: number, rows: number): number {
  let n = 0;
  for (let y = 1; y < rows - 1; y++) for (let x = 0; x < cols; x++) if (road[y * cols + x]) n++;
  return n / (cols * (rows - 2));
}

/** Generate the map from the seed. Retries deterministically until it is playable. */
export function generateMap(seed: string, playerCount: number): GeneratedMap {
  const cols = BALANCE.COLS;
  const rows = BALANCE.ROWS;
  const starts = startColumns(playerCount, cols).map((x) => ({ x, y: rows - 1 }));

  for (let attempt = 0; attempt < BALANCE.MAX_MAP_ATTEMPTS; attempt++) {
    const rng = makeRng(seed, 'map', attempt);
    const { road, tips } = carveStreets(rng, cols, rows);
    const share = roadShare(road, cols, rows);
    if (share < BALANCE.MAP_ROAD_SHARE_MIN || share > BALANCE.MAP_ROAD_SHARE_MAX) continue;

    const cells: Cell[] = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        let type: CellType;
        if (y === 0) type = 'safe';
        else if (y === rows - 1) type = 'start';
        else if (!road[i]) type = 'ruin';
        else type = pickContent(rng, y, tips.has(i));
        const cell: Cell = { type, cleared: false, revealed: y === 0 || y === rows - 1 || type === 'ruin' };
        if (type === 'event') cell.eventId = rng.pick(EVENTS).id;
        cells.push(cell);
      }
    }
    const entrances = Array.from({ length: cols }, (_, x) => cells[cellIndex({ x, y: 1 }, cols)]).filter((c) => !isImpassable(c)).length;
    if (entrances < 2) continue;
    if (!isSolvable(cells, cols, rows, starts)) continue;
    if (!starts.every((st) => minHazardToGoal(cells, cols, rows, st) <= BALANCE.MAX_PATH_HAZARD)) continue;
    return { cells, attempts: attempt + 1 };
  }

  // Fallback: an open field so the game can always be played.
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
