/**
 * The deterministic game engine.
 *
 * GameState = deriveState(inputs). Inputs are replayed in canonical order
 * (round by round, players in the rotating resolution order), never in arrival
 * order, so every client that holds the same input set computes the same state.
 */
import { BALANCE } from './balance';
import { classDef, GENERIC_PERKS, isKnownPerk, PLAYER_COLORS } from './data/classes';
import { eventDef } from './data/events';
import { itemDef, LOOT_TABLE } from './data/items';
import { inputKey, InputSet } from './inputs';
import { cellIndex, generateMap, inBounds, isZombieCell, startColumns, step } from './map';
import { gameRng, roll2d6 } from './rng';
import * as S from './stats';
import type {
  ActionPayload,
  Dir,
  EncounterPayload,
  GameInput,
  GameState,
  LogEntry,
  LogKind,
  PlayerId,
  PlayerState,
  Pos,
  RollResult,
  RosterEntry,
  StartPayload,
  StatId,
} from './types';

export function emptyLobbyState(): GameState {
  return {
    phase: 'lobby',
    seed: '',
    cols: BALANCE.COLS,
    rows: BALANCE.ROWS,
    round: 0,
    roster: [],
    order: [],
    players: {},
    cells: [],
    waveRows: 0,
    log: [],
    pending: [],
    winner: null,
    winReason: null,
    revealedActions: {},
    resolvedThisRound: [],
    nextRoom: null,
    mapAttempts: 0,
  };
}

export function waveRowsFor(round: number): number {
  if (round < BALANCE.WAVE_START_ROUND) return 0;
  const n = 1 + Math.floor((round - BALANCE.WAVE_START_ROUND) / BALANCE.WAVE_ADVANCE_EVERY);
  return Math.min(BALANCE.ROWS - 1, BALANCE.WAVE_MAX_ROWS, n);
}

export function orderForRound(roster: readonly RosterEntry[], round: number): PlayerId[] {
  const ids = roster.map((r) => r.id);
  if (ids.length === 0) return ids;
  const k = (((round - 1) % ids.length) + ids.length) % ids.length;
  return [...ids.slice(k), ...ids.slice(0, k)];
}

export function isKnockedOut(p: PlayerState, round: number): boolean {
  return p.koUntil >= round && p.koUntil > 0;
}

/** Pick the canonical start input: the valid one with the smallest key. */
function findStart(inputs: GameInput[]): (GameInput & { type: 'start' }) | null {
  let best: (GameInput & { type: 'start' }) | null = null;
  for (const i of inputs) {
    if (i.type !== 'start' || i.round !== 0) continue;
    const ids = new Set(i.payload.roster.map((r) => r.id));
    if (ids.size !== i.payload.roster.length || i.payload.roster.length > BALANCE.MAX_PLAYERS) continue;
    if (!best || inputKey(i) < inputKey(best)) best = i;
  }
  return best;
}

class Blocked {
  constructor(readonly pending: GameState['pending'][number]) {}
}

class Replayer {
  readonly s: GameState;
  private seq = 0;

  constructor(
    start: StartPayload,
    private readonly byKey: Map<string, GameInput>,
  ) {
    const roster = start.roster.map((r) => {
      const cls = classDef(r.classId);
      return { ...r, startPerk: cls.startPerks.includes(r.startPerk) ? r.startPerk : cls.startPerks[0] };
    });
    const map = generateMap(start.seed, roster.length);
    const cols = BALANCE.COLS;
    const rows = BALANCE.ROWS;
    const startCols = startColumns(roster.length, cols);
    const players: Record<PlayerId, PlayerState> = {};
    roster.forEach((r, idx) => {
      const cls = classDef(r.classId);
      const pos = { x: startCols[idx] ?? 0, y: rows - 1 };
      const p: PlayerState = {
        id: r.id,
        name: r.name,
        classId: r.classId,
        bot: !!r.bot,
        color: PLAYER_COLORS[idx % PLAYER_COLORS.length] ?? '#ccc',
        pos,
        prevPos: { ...pos },
        hp: cls.hp,
        inventory: [],
        perks: [r.startPerk],
        clears: 0,
        levels: 0,
        perkOffer: null,
        engaged: false,
        hidden: false,
        slipped: false,
        koUntil: 0,
        windedUntil: 0,
        fatigue: 0,
        wokeRound: 0,
        sheltersUsed: [],
        adrenaline: 0,
        craftReadyRound: BALANCE.ENGINEER_CRAFT_FIRST_ROUND,
        openPathReadyRound: BALANCE.ENGINEER_OPEN_PATH_FIRST_ROUND,
        stats: { damageTaken: 0, zombiesCleared: 0, itemsFound: 0, cellsMoved: 0, knockouts: 0, rollsMade: 0 },
      };
      p.hp = S.maxHp(p);
      cls.startItems.forEach((id, k) => p.inventory.push({ uid: `start-${r.id}-${k}`, defId: id }));
      players[r.id] = p;
    });
    this.s = {
      ...emptyLobbyState(),
      phase: 'plan',
      seed: start.seed,
      cols,
      rows,
      round: 1,
      roster,
      order: orderForRound(roster, 1),
      players,
      cells: map.cells,
      mapAttempts: map.attempts,
    };
    this.log('round', 'The sirens stopped an hour ago. The City is quiet in the wrong way. Go north.');
    for (const p of Object.values(players)) this.revealAround(p.pos, 0);
  }

  // ------------------------------------------------------------ helpers

  private get round(): number {
    return this.s.round;
  }

  private input<T extends GameInput['type']>(round: number, pid: PlayerId, type: T, n = 0): Extract<GameInput, { type: T }> | undefined {
    return this.byKey.get(`${round}:${pid}:${type}:${n}`) as Extract<GameInput, { type: T }> | undefined;
  }

  private forced(pid: PlayerId): boolean {
    return this.byKey.has(`${this.round}:${pid}:force:0`);
  }

  private p(pid: PlayerId): PlayerState {
    const p = this.s.players[pid];
    if (!p) throw new Error(`no player ${pid}`);
    return p;
  }

  private log(kind: LogKind, text: string, playerId?: PlayerId, roll?: LogEntry['roll']): void {
    const e: LogEntry = { id: `${this.round}:${this.seq++}`, round: this.round, kind, text };
    if (playerId) e.playerId = playerId;
    if (roll) e.roll = roll;
    this.s.log.push(e);
  }

  private idx(pos: Pos): number {
    return cellIndex(pos, this.s.cols);
  }

  private reveal(i: number): void {
    const c = this.s.cells[i];
    if (c) c.revealed = true;
  }

  private revealAround(pos: Pos, radius: number): void {
    for (let dy = -radius; dy <= radius; dy++)
      for (let dx = -radius; dx <= radius; dx++) {
        const q = { x: pos.x + dx, y: pos.y + dy };
        if (inBounds(q, this.s.cols, this.s.rows)) this.reveal(this.idx(q));
      }
  }

  private roll(pid: PlayerId, tag: string, label: string, mod: number, difficulty: number, auto?: string): RollResult {
    const p = this.p(pid);
    const dice = roll2d6(this.s.seed, this.round, pid, tag);
    const [a, b] = dice;
    let crit: RollResult['crit'] = null;
    let success: boolean;
    if (auto) success = true;
    else if (a === 6 && b === 6) {
      crit = 'double6';
      success = true;
    } else if (a === 1 && b === 1) {
      crit = 'double1';
      success = false;
    } else success = a + b + mod >= difficulty;
    const r: RollResult = { dice, mod, total: a + b + mod, difficulty, success, crit };
    if (auto) r.auto = auto;
    p.stats.rollsMade++;
    const verdict = auto ? auto : crit === 'double6' ? 'Double six.' : crit === 'double1' ? 'Snake eyes.' : success ? 'Success.' : 'Failure.';
    this.log('encounter', `${p.name} — ${label}: ${verdict}`, pid, { ...r, label });
    return r;
  }

  /** Consume a pending adrenaline buff, returning the bonus. */
  private takeAdrenaline(p: PlayerState): number {
    const b = p.adrenaline;
    p.adrenaline = 0;
    return b;
  }

  private damage(p: PlayerState, amount: number, opts: { armor: boolean; why: string }): void {
    let dmg = amount;
    if (opts.armor && dmg > 0) dmg = Math.max(BALANCE.MIN_DAMAGE, dmg - S.armor(p));
    if (dmg <= 0) return;
    p.hp -= dmg;
    p.stats.damageTaken += dmg;
    this.log('damage', `${p.name} takes ${dmg} damage. ${opts.why}`, p.id);
    if (p.hp <= 0) this.knockout(p);
  }

  private heal(p: PlayerState, amount: number, why: string): void {
    const before = p.hp;
    p.hp = Math.min(S.maxHp(p), p.hp + amount);
    const gained = p.hp - before;
    this.log('heal', `${p.name} recovers ${gained} HP. ${why}`, p.id);
  }

  private knockout(p: PlayerState): void {
    p.hp = 0;
    p.koUntil = this.round + S.koRounds(p);
    p.hidden = false;
    p.adrenaline = 0;
    p.stats.knockouts++;
    let lost = '';
    if (p.inventory.length > 0) {
      const r = gameRng(this.s.seed, this.round, p.id, 'ko');
      const i = r.int(p.inventory.length);
      const [it] = p.inventory.splice(i, 1);
      if (it) lost = ` ${itemDef(it.defId).name} is gone when you wake.`;
    }
    this.log('ko', `${p.name} goes down. The world goes grey for a while.${lost}`, p.id);
  }

  private giveItem(p: PlayerState, defId: string, uid: string, why: string): void {
    const def = itemDef(defId);
    p.inventory.push({ uid, defId });
    p.stats.itemsFound++;
    this.log('loot', `${p.name} finds ${def.name}. ${why}`.trim(), p.id);
    const cap = S.slots(p);
    while (p.inventory.length > cap) {
      // drop the lowest-value item; among ties, the newest goes
      let worst = p.inventory.length - 1;
      for (let i = p.inventory.length - 1; i >= 0; i--) {
        const v = BALANCE.RARITY_VALUE[itemDef((p.inventory[i] as { defId: string }).defId).rarity];
        const w = BALANCE.RARITY_VALUE[itemDef((p.inventory[worst] as { defId: string }).defId).rarity];
        if (v < w) worst = i;
      }
      const [dropped] = p.inventory.splice(worst, 1);
      if (dropped) this.log('loot', `No room. ${p.name} leaves ${itemDef(dropped.defId).name} behind.`, p.id);
    }
  }

  private drawLoot(p: PlayerState, count: number, tag: string): void {
    const table = LOOT_TABLE.map((d) => [d.id, BALANCE.RARITY_WEIGHT[d.rarity]] as const);
    for (let k = 0; k < count; k++) {
      const r = gameRng(this.s.seed, this.round, p.id, `${tag}:${k}`);
      this.giveItem(p, r.weighted(table), `${this.round}-${p.id}-${tag}-${k}`, '');
    }
  }

  private gainClear(p: PlayerState): void {
    p.clears++;
    p.stats.zombiesCleared++;
    this.offerPerk(p);
  }

  private offerPerk(p: PlayerState): void {
    if (p.perkOffer) return;
    const earned = Math.floor(p.clears / BALANCE.CLEARS_PER_PERK);
    if (earned <= p.levels) return;
    const cls = classDef(p.classId);
    const r = gameRng(this.s.seed, this.round, p.id, `perkoffer:${p.levels}`);
    const fromClass = r.shuffle(cls.pool.filter((id) => !p.perks.includes(id)));
    const fromGeneric = r.shuffle(GENERIC_PERKS.filter((id) => !p.perks.includes(id)));
    const offer = [...fromClass, ...fromGeneric].slice(0, BALANCE.PERK_OFFER_SIZE);
    if (offer.length === 0) {
      p.levels = earned;
      return;
    }
    p.perkOffer = offer;
    this.log('perk', `${p.name} has learned something about staying alive. Choose a perk.`, p.id);
  }

  private applyPerkChoice(p: PlayerState, choice: string | undefined): void {
    const offer = p.perkOffer;
    if (!offer) return;
    const pick = choice && offer.includes(choice) && isKnownPerk(choice) ? choice : (offer[0] as string);
    const before = S.maxHp(p);
    p.perks.push(pick);
    p.levels++;
    p.perkOffer = null;
    const gain = S.maxHp(p) - before;
    if (gain > 0) p.hp += gain;
    this.log('perk', `${p.name} takes the perk ${pick.replace(/_/g, ' ')}.`, p.id);
    this.offerPerk(p);
  }

  private shelter(p: PlayerState): void {
    const i = this.idx(p.pos);
    const c = this.s.cells[i];
    if (c?.type !== 'shelter' || p.sheltersUsed.includes(i) || p.hp >= S.maxHp(p)) return;
    p.sheltersUsed.push(i);
    this.heal(p, S.shelterHeal(p), 'Four walls and a door that locks. You sleep an hour.');
  }

  // ------------------------------------------------------------ round loop

  run(): GameState {
    const s = this.s;
    for (;;) {
      if (s.round > BALANCE.MAX_ROUNDS) {
        this.endByTimeout();
        return s;
      }
      this.beginRound();
      const awake = s.order.filter((pid) => !isKnockedOut(this.p(pid), s.round));
      const missing = awake.filter((pid) => !this.forced(pid) && !this.input(s.round, pid, 'action'));
      if (missing.length > 0) {
        s.phase = 'plan';
        s.pending = missing.map((playerId) => ({ type: 'action', playerId }));
        return s;
      }
      s.phase = 'resolve';
      s.revealedActions = {};
      for (const pid of awake) {
        const a = this.input(s.round, pid, 'action');
        s.revealedActions[pid] = this.forced(pid) || !a ? 'forced' : a.payload;
      }
      for (const pid of s.order) {
        if (isKnockedOut(this.p(pid), s.round)) continue;
        try {
          this.resolvePlayer(pid);
        } catch (e) {
          if (e instanceof Blocked) {
            s.pending = [e.pending];
            return s;
          }
          throw e;
        }
        s.resolvedThisRound.push(pid);
        if (s.winner) {
          s.phase = 'over';
          s.pending = [];
          this.applyNext();
          return s;
        }
      }
      this.endRound();
      s.round++;
    }
  }

  private beginRound(): void {
    const s = this.s;
    s.order = orderForRound(s.roster, s.round);
    s.pending = [];
    s.resolvedThisRound = [];
    s.revealedActions = {};
    s.waveRows = waveRowsFor(s.round - 1);
    for (const pid of s.order) {
      const p = this.p(pid);
      if (p.koUntil > 0 && p.koUntil < s.round) {
        p.koUntil = 0;
        p.hp = Math.min(S.maxHp(p), BALANCE.KO_WAKE_HP);
        p.fatigue = 0;
        p.wokeRound = s.round;
        p.engaged = isZombieCell(s.cells[this.idx(p.pos)]) && !p.slipped;
        this.log('ko', `${p.name} wakes up. Still here. Still breathing.`, pid);
      }
    }
    this.log('round', `Round ${s.round}.`);
  }

  private endRound(): void {
    const s = this.s;
    const before = s.waveRows;
    s.waveRows = waveRowsFor(s.round);
    if (s.waveRows > before) {
      this.log(
        'wave',
        before === 0
          ? 'The Outbreak Wave rolls out of the City. The bottom streets are gone.'
          : 'The Wave pushes north. Another street goes under.',
      );
    }
    if (s.waveRows > 0) {
      const edge = s.rows - s.waveRows;
      for (const pid of s.order) {
        const p = this.p(pid);
        // the fallen and the just-woken are passed over
        if (isKnockedOut(p, s.round) || p.pos.y < edge || p.wokeRound === s.round) continue;
        // the Wave bleeds you down to 1 HP but never knocks you out by itself
        const dmg = Math.min(p.hp - 1, Math.max(0, BALANCE.WAVE_DAMAGE - S.waveResist(p)));
        if (dmg > 0) this.damage(p, dmg, { armor: false, why: 'The Wave is all teeth.' });
      }
    }
  }

  private endByTimeout(): void {
    const s = this.s;
    const ranked = s.roster
      .map((r, i) => ({ p: this.p(r.id), i }))
      .sort((a, b) => a.p.pos.y - b.p.pos.y || b.p.hp - a.p.hp || a.i - b.i);
    const best = ranked[0];
    s.round = BALANCE.MAX_ROUNDS;
    s.phase = 'over';
    s.pending = [];
    s.winner = best ? best.p.id : null;
    s.winReason = 'timeout';
    this.log('win', `The radio goes silent. ${best?.p.name ?? 'Nobody'} got the closest. It will have to be enough.`);
    this.applyNext();
  }

  private applyNext(): void {
    const s = this.s;
    let best: GameInput | undefined;
    for (const i of this.byKey.values()) if (i.type === 'next' && (!best || inputKey(i) < inputKey(best))) best = i;
    if (best && best.type === 'next') s.nextRoom = best.payload.room;
  }

  // ------------------------------------------------------------ player resolution

  private resolvePlayer(pid: PlayerId): void {
    const s = this.s;
    const p = this.p(pid);
    const forced = this.forced(pid);
    const action: ActionPayload = forced ? { kind: 'wait' } : (this.input(s.round, pid, 'action')?.payload ?? { kind: 'wait' });

    if (p.perkOffer) this.applyPerkChoice(p, forced ? undefined : action.perk);
    if (forced) this.log('info', `${p.name} is lost in the static. They wait.`, pid);

    const here = this.idx(p.pos);
    const cell = s.cells[here];

    const moving = action.kind === 'move';
    const canMove = moving && p.windedUntil < s.round && p.fatigue < BALANCE.MAX_CONSECUTIVE_MOVES;
    if (p.slipped && !canMove && isZombieCell(cell)) {
      // you cannot rest among the dead: they notice you again
      p.slipped = false;
      p.engaged = true;
      this.log('encounter', `${p.name} stops moving. The dead turn around.`, pid);
    }

    if (p.engaged && isZombieCell(cell)) {
      p.fatigue = 0;
      if (action.kind === 'use') this.useItem(p, action.item);
      this.encounter(p, here);
      return;
    }
    if (p.engaged || p.hidden) {
      p.engaged = false;
      p.hidden = false;
    }

    if (moving && p.windedUntil >= s.round) {
      this.log('move', `${p.name} is still catching their breath.`, pid);
      this.rest(p);
      return;
    }
    if (moving && p.fatigue >= BALANCE.MAX_CONSECUTIVE_MOVES) {
      this.log('move', `${p.name}'s legs give out. They have to rest.`, pid);
      this.rest(p);
      return;
    }

    switch (action.kind) {
      case 'wait':
        this.log('move', `${p.name} holds position and rests.`, pid);
        this.rest(p);
        return;
      case 'use':
        this.useItem(p, action.item);
        this.rest(p);
        return;
      case 'craft':
        this.craft(p);
        this.rest(p);
        return;
      case 'openPath':
        if (p.classId === 'engineer' && s.round >= p.openPathReadyRound) {
          this.openPath(p, action.dir);
          return;
        }
        this.log('info', `${p.name} is not ready to open another path.`, pid);
        this.rest(p);
        return;
      case 'move':
        p.fatigue++;
        this.tryMove(p, step(p.pos, action.dir));
        return;
    }
  }

  /** A round spent not moving: stamina recovers, a little HP comes back, shelters work. */
  private rest(p: PlayerState): void {
    p.fatigue = 0;
    const amount = BALANCE.REST_HEAL + (p.classId === 'medic' ? BALANCE.MEDIC_REST_HEAL_BONUS : 0);
    if (amount > 0 && p.hp < S.maxHp(p)) p.hp = Math.min(S.maxHp(p), p.hp + amount);
    this.shelter(p);
  }

  private useItem(p: PlayerState, uid: string): void {
    const it = p.inventory.find((i) => i.uid === uid);
    const def = it ? itemDef(it.defId) : null;
    if (!it || !def?.effect || (def.effect.kind !== 'heal' && def.effect.kind !== 'adrenaline')) {
      this.log('info', `${p.name} fumbles through the pack. Nothing useful.`, p.id);
      return;
    }
    p.inventory = p.inventory.filter((i) => i !== it);
    if (def.effect.kind === 'heal') this.heal(p, S.healAmount(p, def.effect.amount), `${def.name}.`);
    else {
      p.adrenaline = BALANCE.ADRENALINE_BONUS;
      this.log('info', `${p.name} jams the needle in. Next roll +${BALANCE.ADRENALINE_BONUS}.`, p.id);
    }
  }

  private craft(p: PlayerState): void {
    if (p.classId !== 'engineer' || this.round < p.craftReadyRound || p.inventory.length >= S.slots(p)) {
      this.log('info', `${p.name} turns scrap over in their hands. Nothing comes of it.`, p.id);
      return;
    }
    p.craftReadyRound = this.round + S.craftCooldown(p);
    this.giveItem(p, 'pipebomb', `${this.round}-${p.id}-craft`, 'Wire, powder, a length of pipe.');
  }

  /** Engineer: open an adjacent barricade (or breach ruins) for everyone. Takes the round; the Engineer stays put. */
  private openPath(p: PlayerState, dir: Dir): void {
    const s = this.s;
    const target = step(p.pos, dir);
    const c = inBounds(target, s.cols, s.rows) ? s.cells[this.idx(target)] : undefined;
    if (c?.type !== 'blocked' && !(c?.type === 'ruin' && BALANCE.ENGINEER_OPEN_RUINS)) {
      this.log('info', `${p.name} looks for something to pry open. There is nothing there.`, p.id);
      return;
    }
    p.openPathReadyRound = this.round + S.openPathCooldown(p);
    c.type = 'empty';
    c.cleared = true;
    c.revealed = true;
    this.log('move', `${p.name} jacks the rubble apart. A new way through, for anyone.`, p.id);
  }

  private tryMove(p: PlayerState, target: Pos): void {
    const s = this.s;
    if (!inBounds(target, s.cols, s.rows)) {
      this.log('move', `${p.name} walks into the edge of the world and turns back.`, p.id);
      this.shelter(p);
      return;
    }
    const c = s.cells[this.idx(target)];
    if (c?.type === 'blocked' || c?.type === 'ruin') {
      this.reveal(this.idx(target));
      this.log('move', c.type === 'ruin' ? `${p.name} climbs the ruins and finds no way down.` : `${p.name} hits a barricade. No way through.`, p.id);
      this.shelter(p);
      return;
    }
    this.moveTo(p, target);
  }

  private moveTo(p: PlayerState, target: Pos): void {
    const s = this.s;
    p.prevPos = { ...p.pos };
    p.pos = { ...target };
    p.slipped = false;
    p.hidden = false;
    p.engaged = false;
    p.stats.cellsMoved++;
    const i = this.idx(target);
    this.reveal(i);
    const c = s.cells[i];
    if (isZombieCell(c)) {
      this.log('move', `${p.name} moves into ${c?.type === 'horde' ? 'a horde' : 'a walker'}.`, p.id);
      this.encounter(p, i);
      return;
    }
    this.log('move', `${p.name} moves on.`, p.id);
    this.enterCell(p, 0);
  }

  /** Effects of standing in a newly entered, zombie-free cell. */
  private enterCell(p: PlayerState, depth: number): void {
    const s = this.s;
    const i = this.idx(p.pos);
    const c = s.cells[i];
    if (!c) return;
    switch (c.type) {
      case 'safe':
        if (!s.winner) {
          s.winner = p.id;
          s.winReason = 'safezone';
          this.log('win', `${p.name} reaches the Safe Zone. The gate shuts behind them. It does not open again.`, p.id);
        }
        return;
      case 'loot':
        if (c.cleared) return;
        c.cleared = true;
        this.lootCell(p, i);
        return;
      case 'event':
        if (c.cleared) return;
        c.cleared = true;
        this.event(p, i, depth);
        return;
      case 'shelter':
        this.shelter(p);
        return;
      default:
        return;
    }
  }

  private lootCell(p: PlayerState, i: number): void {
    this.log('loot', `${p.name} searches the ruins.`, p.id);
    this.drawLoot(p, 1, `loot:${i}`);
    const r = this.roll(p.id, `loot2:${i}`, 'Search deeper (Scavenging)', S.stat(p, 'scavenging'), S.secondDrawDifficulty(p));
    if (r.success) this.drawLoot(p, r.crit === 'double6' ? 2 : 1, `loot2:${i}`);
    if (p.classId === 'scavenger') {
      const r3 = this.roll(p.id, `loot3:${i}`, 'Keen Eye (Scavenging)', S.stat(p, 'scavenging'), BALANCE.SCAVENGER_THIRD_DRAW_DIFFICULTY);
      if (r3.success) this.drawLoot(p, 1, `loot3:${i}`);
    }
  }

  private event(p: PlayerState, i: number, depth: number): void {
    const s = this.s;
    const def = eventDef(s.cells[i]?.eventId ?? 'depot');
    this.log('event', `${def.name}. ${def.text}`, p.id);
    const e = def.effect;
    switch (e.kind) {
      case 'radiation':
        if (S.hasFlag(p, 'gasmask')) this.log('event', def.success ?? '', p.id);
        else this.damage(p, e.damage, { armor: false, why: def.failure ?? '' });
        return;
      case 'freeLoot': {
        this.drawLoot(p, e.draws, `ev:${i}`);
        const r = this.roll(p.id, `ev:${i}`, 'Dig through the back (Scavenging)', S.stat(p, 'scavenging'), e.bonusDifficulty);
        if (r.success) this.drawLoot(p, 1, `ev2:${i}`);
        return;
      }
      case 'check': {
        const mod = S.stat(p, e.stat) + this.takeAdrenaline(p);
        const r = this.roll(p.id, `ev:${i}`, `${def.name} (${statLabel(e.stat)})`, mod, e.difficulty);
        if (r.success) {
          this.log('event', def.success ?? '', p.id);
          if (e.rewardDraws > 0) this.drawLoot(p, e.rewardDraws, `ev:${i}`);
        } else {
          this.damage(p, e.damage + (r.crit === 'double1' ? BALANCE.CRIT_FAIL_EXTRA_DAMAGE : 0), { armor: true, why: def.failure ?? '' });
        }
        return;
      }
      case 'giveItem':
        this.giveItem(p, e.item, `${this.round}-${p.id}-ev-${i}`, '');
        return;
      case 'reveal':
        for (let dy = 1; dy <= e.rowsAhead; dy++)
          for (let dx = -e.halfWidth; dx <= e.halfWidth; dx++) {
            const q = { x: p.pos.x + dx, y: p.pos.y - dy };
            if (inBounds(q, s.cols, s.rows)) this.reveal(this.idx(q));
          }
        return;
      case 'tunnel': {
        const target = { x: p.pos.x, y: p.pos.y - e.rows };
        const tc = inBounds(target, s.cols, s.rows) ? s.cells[this.idx(target)] : undefined;
        if (!tc || tc.type === 'blocked' || tc.type === 'ruin' || depth > 3) {
          this.log('event', 'The tunnel ends in a wall of wet concrete.', p.id);
          return;
        }
        p.prevPos = { ...p.pos };
        p.pos = target;
        p.stats.cellsMoved++;
        this.reveal(this.idx(target));
        if (isZombieCell(tc)) {
          p.engaged = true;
          this.log('event', `${p.name} surfaces right among them.`, p.id);
          return;
        }
        this.log('event', `${p.name} comes up a street further north.`, p.id);
        this.enterCell(p, depth + 1);
        return;
      }
    }
  }

  // ------------------------------------------------------------ encounters

  private findPartner(p: PlayerState, i: number): PlayerState | null {
    for (const r of this.s.roster) {
      const o = this.p(r.id);
      if (o.id !== p.id && o.hidden && !isKnockedOut(o, this.round) && this.idx(o.pos) === i) return o;
    }
    return null;
  }

  private encounter(p: PlayerState, i: number): void {
    const s = this.s;
    const c = s.cells[i];
    if (!c || !isZombieCell(c)) return;
    const foe = c.type === 'horde' ? 'horde' : 'zombie';
    const partner = this.findPartner(p, i);
    let decision: EncounterPayload;
    if (this.forced(p.id)) decision = { choice: 'hide' };
    else {
      const inp = this.input(s.round, p.id, 'enc');
      if (!inp) throw new Blocked({ type: 'enc', playerId: p.id, cell: i, foe, partner: partner?.id ?? null });
      decision = inp.payload;
    }
    let choice = decision.choice;
    if (choice === 'team' && !partner) choice = 'fight';

    const diff = foe === 'horde' ? BALANCE.HORDE_DIFFICULTY : BALANCE.ZOMBIE_DIFFICULTY;
    const baseDmg = foe === 'horde' ? BALANCE.HORDE_DAMAGE : BALANCE.ZOMBIE_DAMAGE;
    const item = decision.item ? p.inventory.find((x) => x.uid === decision.item) : undefined;
    const eff = item ? itemDef(item.defId).effect : undefined;
    let auto: string | undefined;
    let itemBonus = 0;
    const spend = () => {
      if (item) p.inventory = p.inventory.filter((x) => x !== item);
    };
    if (eff && item) {
      const name = itemDef(item.defId).name;
      if (eff.kind === 'autoFight' && (choice === 'fight' || choice === 'team') && (eff.hordeToo || foe === 'zombie')) {
        auto = `${name}. Automatic success.`;
        spend();
      } else if (eff.kind === 'autoFlee' && choice === 'flee') {
        auto = `${name}. Automatic escape.`;
        spend();
      } else if (eff.kind === 'adrenaline') {
        itemBonus = BALANCE.ADRENALINE_BONUS;
        spend();
      }
    }
    const ambush = p.hidden ? BALANCE.HIDE_AMBUSH_BONUS : 0;
    const boost = this.takeAdrenaline(p) + itemBonus;
    const foeName = foe === 'horde' ? 'horde' : 'walker';

    if (choice === 'fight') {
      const r = this.roll(p.id, 'enc', `Fight the ${foeName} (Combat)`, S.stat(p, 'combat') + ambush + boost, diff, auto);
      if (r.success && foe === 'horde' && BALANCE.HORDE_HITS > 1 && !auto && r.crit !== 'double6') {
        // the horde thins to a single walker; you are still in it
        c.type = 'zombie';
        p.engaged = true;
        p.hidden = false;
        this.log('encounter', `The horde thins. One of them is still standing.`, p.id);
        this.drawLoot(p, 1, `thin:${i}`);
      } else if (r.success) this.winFight(p, i, foe, r.crit === 'double6', 'fight');
      else {
        p.engaged = true;
        p.hidden = false;
        this.damage(p, baseDmg + (r.crit === 'double1' ? BALANCE.CRIT_FAIL_EXTRA_DAMAGE : 0), {
          armor: true,
          why: 'They do not go down. You are still in it.',
        });
      }
      return;
    }

    if (choice === 'flee') {
      const r = this.roll(p.id, 'enc', `Flee the ${foeName} (Evasion)`, S.stat(p, 'evasion') + ambush + boost, S.fleeDifficulty(p), auto);
      if (r.success) {
        p.slipped = true;
        p.engaged = false;
        p.hidden = false;
        p.fatigue += BALANCE.FLEE_FATIGUE;
        this.log('encounter', `${p.name} slips past, lungs burning. They will not get a second look.`, p.id);
      } else {
        p.hidden = false;
        p.slipped = false;
        const back = p.prevPos;
        p.pos = { ...back };
        p.engaged = isZombieCell(s.cells[this.idx(back)]);
        this.damage(p, baseDmg + (r.crit === 'double1' ? BALANCE.CRIT_FAIL_EXTRA_DAMAGE : 0), {
          armor: true,
          why: 'Driven back the way you came.',
        });
      }
      return;
    }

    if (choice === 'hide') {
      const r = this.roll(p.id, 'enc', 'Hide', boost, S.hideDifficulty(p));
      p.engaged = true;
      if (r.success) {
        p.hidden = true;
        this.log('encounter', `${p.name} goes still under a car. Waiting. Watching.`, p.id);
      } else {
        p.hidden = false;
        this.damage(p, baseDmg + (r.crit === 'double1' ? BALANCE.CRIT_FAIL_EXTRA_DAMAGE : 0), {
          armor: true,
          why: 'They smell you anyway.',
        });
      }
      return;
    }

    // team fight
    const a = partner as PlayerState;
    this.log('encounter', `${p.name} and ${a.name} fight together.`, p.id);
    const rb = this.roll(p.id, 'enc', `Team fight (Combat)`, S.stat(p, 'combat') + boost, diff, auto);
    const ra = this.roll(a.id, `team:${p.id}`, `Team fight (Combat)`, S.stat(a, 'combat') + BALANCE.HIDE_AMBUSH_BONUS + this.takeAdrenaline(a), diff, auto);
    const bonus = BALANCE.TEAM_BONUS + S.teamBonus(p) + S.teamBonus(a);
    const best = Math.max(rb.total, ra.total) + bonus;
    const anyCrit6 = rb.crit === 'double6' || ra.crit === 'double6';
    const bothCrit1 = rb.crit === 'double1' && ra.crit === 'double1';
    const success = !!auto || anyCrit6 || (!bothCrit1 && best >= diff);
    this.log('encounter', `Best total ${best} vs ${diff} (team bonus +${bonus}). ${success ? 'They fall.' : 'Not enough.'}`, p.id);
    if (success) {
      this.winFight(p, i, foe, anyCrit6, 'fight');
      this.winFight(a, i, foe, false, `team:${p.id}`);
    } else {
      const dmg = baseDmg + (bothCrit1 ? BALANCE.CRIT_FAIL_EXTRA_DAMAGE : 0);
      p.engaged = true;
      a.engaged = true;
      a.hidden = false;
      this.damage(p, Math.ceil(dmg / 2), { armor: true, why: 'Shared pain is still pain.' });
      this.damage(a, Math.floor(dmg / 2), { armor: true, why: 'Shared pain is still pain.' });
    }
    if (p.classId === 'medic' && a.hp > 0) this.heal(a, BALANCE.MEDIC_TEAM_HEAL + S.perkMod(p, 'healBonus'), `${p.name} patches them up.`);
    if (a.classId === 'medic' && p.hp > 0) this.heal(p, BALANCE.MEDIC_TEAM_HEAL + S.perkMod(a, 'healBonus'), `${a.name} patches them up.`);
  }

  private winFight(p: PlayerState, i: number, foe: 'zombie' | 'horde', crit: boolean, tag: string): void {
    const c = this.s.cells[i];
    if (c) c.cleared = true;
    p.engaged = false;
    p.hidden = false;
    p.slipped = false;
    this.log('encounter', foe === 'horde' ? `The horde is down. ${p.name} stands in what is left.` : `The walker stops walking.`, p.id);
    const shrugs = p.classId === 'guardian' && foe === 'zombie' && BALANCE.GUARDIAN_NO_WIND_VS_WALKER;
    if (BALANCE.FIGHT_WIN_REST_ROUNDS > 0 && !shrugs) p.windedUntil = this.round + BALANCE.FIGHT_WIN_REST_ROUNDS;
    const draws = (foe === 'horde' ? BALANCE.HORDE_LOOT_DRAWS : BALANCE.ZOMBIE_LOOT_DRAWS) + (crit ? BALANCE.CRIT_SUCCESS_BONUS_DRAWS : 0);
    this.drawLoot(p, draws, `kill:${tag}:${i}`);
    this.gainClear(p);
  }
}

function statLabel(s: StatId): string {
  return s === 'combat' ? 'Combat' : s === 'evasion' ? 'Evasion' : 'Scavenging';
}

/** Derive the full game state from a set of inputs. Pure and deterministic. */
export function deriveState(inputs: InputSet | Iterable<GameInput>): GameState {
  const set = inputs instanceof InputSet ? inputs : new InputSet(inputs);
  const all = set.values();
  const start = findStart(all);
  if (!start) {
    const s = emptyLobbyState();
    const next = all.filter((i) => i.type === 'next').sort((a, b) => (inputKey(a) < inputKey(b) ? -1 : 1))[0];
    if (next && next.type === 'next') s.nextRoom = next.payload.room;
    return s;
  }
  const byKey = new Map<string, GameInput>();
  for (const i of all) byKey.set(inputKey(i), i);
  return new Replayer(start.payload, byKey).run();
}
