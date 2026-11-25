export type PlayerId = string;
export type ClassId = 'scout' | 'scavenger' | 'guardian' | 'medic' | 'engineer';
/** Hex directions (pointy-top). North is reached via NE or NW. */
export type Dir = 'NE' | 'E' | 'SE' | 'SW' | 'W' | 'NW';
export type StatId = 'combat' | 'evasion' | 'scavenging';

export type CellType =
  | 'start'
  | 'safe'
  | 'empty'
  | 'loot'
  | 'zombie'
  | 'horde'
  | 'event'
  | 'shelter'
  /** barricade on a street: impassable, an Engineer can open it */
  | 'blocked'
  /** collapsed buildings between streets: impassable, always visible */
  | 'ruin';

export interface Pos {
  x: number;
  y: number;
}

/** Numeric modifiers granted by items, perks and passives. All optional, all additive except where noted. */
export interface Mods {
  combat?: number;
  evasion?: number;
  scavenging?: number;
  armor?: number;
  maxHp?: number;
  vision?: number;
  fleeDiff?: number;
  hideDiff?: number;
  healBonus?: number;
  lootDiff?: number;
  shelterHeal?: number;
  teamBonus?: number;
  waveResist?: number;
  koRounds?: number;
  craftCooldown?: number;
  openPathCooldown?: number;
  slots?: number;
}

// ---------------------------------------------------------------- inputs

export interface RosterEntry {
  id: PlayerId;
  name: string;
  classId: ClassId;
  startPerk: string;
  bot?: boolean;
}

export interface StartPayload {
  seed: string;
  roster: RosterEntry[];
}

export type PlanAction =
  | { kind: 'move'; dir: Dir }
  | { kind: 'wait' }
  | { kind: 'use'; item: string }
  | { kind: 'craft' }
  | { kind: 'openPath'; dir: Dir };

export type ActionPayload = PlanAction & { perk?: string };

export type EncounterChoice = 'fight' | 'flee' | 'hide' | 'team';

export interface EncounterPayload {
  choice: EncounterChoice;
  /** uid of a consumable to spend with this decision */
  item?: string;
}

export interface ForcePayload {
  by: PlayerId;
}

export interface NextPayload {
  room: string;
}

interface InputBase {
  round: number;
  playerId: PlayerId;
  n: number;
}

export type GameInput =
  | (InputBase & { type: 'start'; payload: StartPayload })
  | (InputBase & { type: 'action'; payload: ActionPayload })
  | (InputBase & { type: 'enc'; payload: EncounterPayload })
  | (InputBase & { type: 'force'; payload: ForcePayload })
  | (InputBase & { type: 'next'; payload: NextPayload });

export type InputType = GameInput['type'];

// ---------------------------------------------------------------- state

export interface Item {
  uid: string;
  defId: string;
}

export interface Cell {
  type: CellType;
  /** zombie/horde: cleared by a successful fight. loot/event: spent after first visit. */
  cleared: boolean;
  revealed: boolean;
  /** event cells: which event fires (decided at map generation) */
  eventId?: string;
}

export interface PlayerStats {
  damageTaken: number;
  zombiesCleared: number;
  itemsFound: number;
  cellsMoved: number;
  knockouts: number;
  rollsMade: number;
}

export interface PlayerState {
  id: PlayerId;
  name: string;
  classId: ClassId;
  bot: boolean;
  color: string;
  pos: Pos;
  prevPos: Pos;
  hp: number;
  inventory: Item[];
  perks: string[];
  clears: number;
  /** level-ups already resolved */
  levels: number;
  /** offered perk ids for the next pending level-up, or null */
  perkOffer: string[] | null;
  /** in an uncleared zombie cell and must face it at the next resolve step */
  engaged: boolean;
  hidden: boolean;
  /** succeeded at fleeing this cell: may leave freely */
  slipped: boolean;
  /** consecutive rounds spent moving; at MAX_CONSECUTIVE_MOVES the player must rest */
  fatigue: number;
  /** cannot move through this round (inclusive) after winning a fight */
  windedUntil: number;
  /** round in which the player last woke from a knockout */
  wokeRound: number;
  /** knocked out through this round (inclusive); 0 = awake */
  koUntil: number;
  sheltersUsed: number[];
  adrenaline: number;
  craftReadyRound: number;
  openPathReadyRound: number;
  stats: PlayerStats;
}

export interface RollResult {
  dice: [number, number];
  mod: number;
  total: number;
  difficulty: number;
  success: boolean;
  crit: 'double6' | 'double1' | null;
  auto?: string;
}

export type LogKind = 'info' | 'move' | 'encounter' | 'loot' | 'event' | 'damage' | 'heal' | 'wave' | 'ko' | 'win' | 'round' | 'perk';

export interface LogEntry {
  /** stable id: `${round}:${seq}` within a derivation; deterministic */
  id: string;
  round: number;
  kind: LogKind;
  text: string;
  playerId?: PlayerId;
  roll?: RollResult & { label: string };
}

export type Pending =
  | { type: 'action'; playerId: PlayerId }
  | { type: 'enc'; playerId: PlayerId; cell: number; foe: 'zombie' | 'horde'; partner: PlayerId | null };

export type Phase = 'lobby' | 'plan' | 'resolve' | 'over';

export interface GameState {
  phase: Phase;
  seed: string;
  cols: number;
  rows: number;
  round: number;
  roster: RosterEntry[];
  /** resolution order for the current round */
  order: PlayerId[];
  players: Record<PlayerId, PlayerState>;
  cells: Cell[];
  /** number of bottom rows covered by the Outbreak Wave */
  waveRows: number;
  log: LogEntry[];
  pending: Pending[];
  winner: PlayerId | null;
  winReason: 'safezone' | 'timeout' | null;
  /** actions submitted for the current round once revealed (all in) */
  revealedActions: Record<PlayerId, ActionPayload | 'forced'>;
  /** which players already resolved this round (resolve phase) */
  resolvedThisRound: PlayerId[];
  nextRoom: string | null;
  mapAttempts: number;
}
