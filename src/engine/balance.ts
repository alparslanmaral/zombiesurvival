/**
 * Every tunable number in the game. Tweak here, then run `npm run sim`.
 */
export const BALANCE = {
  // map
  COLS: 7,
  ROWS: 10,
  /** relative weights for generated cells (rows 1..ROWS-2) */
  CELL_WEIGHTS: {
    empty: 17,
    loot: 18,
    zombie: 22,
    horde: 14,
    event: 10,
    shelter: 7,
    blocked: 12,
  },
  /** "The Wall": the rows just below the Safe Zone use these heavier weights */
  WALL_ROWS: 3,
  WALL_WEIGHTS: {
    empty: 10,
    loot: 8,
    zombie: 28,
    horde: 28,
    event: 4,
    shelter: 8,
    blocked: 14,
  },
  /** every start must have a route whose hazard (walker 1, horde 2) is at most this */
  MAX_PATH_HAZARD: 5,
  MAX_MAP_ATTEMPTS: 50,

  // fog
  VISION: 1,

  // players
  MAX_PLAYERS: 4,
  MIN_PLAYERS: 2,
  BASE_SLOTS: 4,

  // dice
  CRIT_SUCCESS_BONUS_DRAWS: 1,
  CRIT_FAIL_EXTRA_DAMAGE: 1,

  // encounters
  ZOMBIE_DIFFICULTY: 8,
  ZOMBIE_DAMAGE: 3,
  HORDE_DIFFICULTY: 11,
  HORDE_DAMAGE: 4,
  FLEE_DIFFICULTY: 10,
  /** extra stamina spent by a successful flee (sprinting) */
  FLEE_FATIGUE: 1,
  HIDE_DIFFICULTY: 5,
  HIDE_AMBUSH_BONUS: 2,
  TEAM_BONUS: 1,
  MIN_DAMAGE: 1,
  /** rounds a player cannot move after winning a fight (catching breath, searching the bodies) */
  FIGHT_WIN_REST_ROUNDS: 1,
  /** a horde must be beaten this many times; each win but the last thins it to a single walker */
  HORDE_HITS: 2,
  ZOMBIE_LOOT_DRAWS: 1,
  HORDE_LOOT_DRAWS: 2,

  // loot
  SECOND_DRAW_DIFFICULTY: 9,
  RARITY_WEIGHT: { common: 6, uncommon: 3, rare: 1 },
  RARITY_VALUE: { common: 1, uncommon: 2, rare: 3 },

  // stamina: after this many consecutive moving rounds a player must rest one round
  MAX_CONSECUTIVE_MOVES: 3,
  /** HP recovered on a round spent resting (wait, use, craft, winded, exhausted) */
  REST_HEAL: 1,

  // shelter
  SHELTER_HEAL: 3,

  // outbreak wave
  WAVE_START_ROUND: 4,
  WAVE_ADVANCE_EVERY: 3,
  WAVE_DAMAGE: 2,
  /** the Wave never covers more than this many bottom rows */
  WAVE_MAX_ROWS: 4,

  // knockout
  KO_SKIP_ROUNDS: 2,
  KO_WAKE_HP: 3,

  // progression
  CLEARS_PER_PERK: 3,
  PERK_OFFER_SIZE: 2,

  // game length safety net
  MAX_ROUNDS: 40,

  // class specifics
  SCOUT_VISION: 2,
  SCAVENGER_SECOND_DRAW_BONUS: 2,
  SCAVENGER_THIRD_DRAW_DIFFICULTY: 12,
  GUARDIAN_FLEE_PENALTY: 1,
  GUARDIAN_ARMOR: 1,
  /** Guardians are not winded after beating a single walker */
  GUARDIAN_NO_WIND_VS_WALKER: false,
  MEDIC_HEAL_MULTIPLIER: 2,
  MEDIC_TEAM_HEAL: 2,
  MEDIC_REST_HEAL_BONUS: 1,
  ENGINEER_CRAFT_FIRST_ROUND: 1,
  ENGINEER_CRAFT_COOLDOWN: 6,
  ENGINEER_OPEN_PATH_FIRST_ROUND: 1,
  ENGINEER_OPEN_PATH_COOLDOWN: 10,

  // consumables
  ADRENALINE_BONUS: 3,
} as const;

export type Balance = typeof BALANCE;
