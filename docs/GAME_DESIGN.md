# Ashen Road — Game Design

> The City is lost. The road north is not.

An online, turn-based, dice-driven board game for 2–4 friends. Everyone starts in the
ruined City (bottom row) and races north to the Safe Zone (top row). First one in wins.
Target length: ~15 rounds, ~30 minutes.

All numbers below are defaults from `src/engine/balance.ts`, which is the source of truth.
Balance is verified by `npm run sim` (1000 four-bot games).

## 1. Map

- 7 columns × 10 rows, square grid, 4-directional movement.
- Row 9 (bottom) is the City: start row, always open. Players start in different columns.
- Row 0 (top) is the Safe Zone. Entering any Safe Zone cell wins the game.
- Rows 4–8 are generated from the seed with the base weights; rows 1–3 ("The Wall", the
  dead crowding the Safe Zone's fences) use heavier weights:

| Cell      | Base | Wall | Notes |
|-----------|-----:|-----:|-------|
| Empty     | 17   | 10   | |
| Loot      | 18   | 8    | first visitor draws items |
| Zombie    | 22   | 28   | walker: difficulty 8, 3 damage |
| Horde     | 14   | 28   | difficulty 11, 4 damage, must be beaten twice |
| Event     | 10   | 4    | one-shot event from the event table |
| Shelter   | 7    | 8    | +3 HP once per player per shelter |
| Blocked   | 12   | 14   | rubble, impassable |

- The generator retries deterministically (`attempt` is part of the hash) until:
  1. a BFS confirms every start cell can reach the Safe Zone, and
  2. every start has a route whose hazard (walker = 1, horde = 2) is at most 5.

## 2. Fog of war

- A player sees cell types in the 4 orthogonally adjacent cells (Manhattan radius 1).
  Scout: radius 2. Flashlight / perks add +1.
- The first player to enter a cell reveals it for everyone; revealed cells stay revealed.
- Fog is presentation only. There is no anti-cheat; the whole map is in every client.

## 3. Round flow

1. **Plan** — every awake player secretly picks one action: `Move(N/E/S/W)`, `Wait`,
   `Use item`, or an Engineer ability. Choices are revealed once all are in. A pending
   perk choice rides along with the action.
2. **Resolve** — players resolve one at a time in *resolution order*: the roster order
   rotated by one every round. When a player enters (or is stuck in) a cell with live
   zombies, resolution pauses until **that player** picks Fight / Flee / Hide.
3. **End of round** — Outbreak Wave, knockout timers, next round.

The round does not finish until every required input exists (real or forced).

## 4. Stamina and rest

- After **3 consecutive moving rounds** a player must rest one round (moves are disabled).
- A successful Flee costs 1 extra stamina (you sprinted).
- Any round spent not moving (Wait, Use, Craft, Winded, exhausted) is a **rest**: stamina
  refills and you recover 1 HP (Medic: 2). Shelters heal on rest too.

## 5. Dice

`2d6 + stat + gear + modifiers ≥ difficulty`.

- **Double 6**: automatic success plus a bonus (an extra loot draw on a fight; a horde
  falls in one blow).
- **Double 1**: automatic failure and +1 damage.
- Stats: **Combat**, **Evasion**, **Scavenging**. Gear does not stack: for each stat only
  the best item counts.
- Every roll is addressed by `(seed, round, playerId, tag)`, so all clients agree.

## 6. Encounters

| Choice | Roll | Success | Failure |
|---|---|---|---|
| **Fight** | Combat vs 8 (walker) / 11 (horde) | Walker: cell cleared, 1 loot draw, a clear, you are **Winded** next round. Horde: first win thins it to a walker (1 draw), you stay engaged | Damage, you stay in the cell, still engaged |
| **Flee** | Evasion vs 10 | You slip past: stay in the cell but may move on next round without a fight (+1 fatigue) | Damage, pushed back to the cell you came from |
| **Hide** | 2d6 vs 5 | Hidden, still engaged; +2 to your next roll in this cell | Damage, still engaged |
| **Fight together** | only if a hidden player is in the cell | Both roll; best total +1. Both get loot and the clear | Damage split (you take the larger half) |

- Armor reduces damage (minimum 1). Outbreak Wave damage ignores armor.
- An *engaged* player (failed fight, hidden) cannot walk away: at their resolve step they
  face the cell again; their plan options are Wait or Use item.
- A player who *slipped past* and then stops in that cell (rest, exhaustion) is noticed
  again: they are engaged at their next resolve step.
- Consumables can be spent with the decision: Molotov (auto-win a fight), Pipe Bomb
  (auto-win vs a walker), Smoke Bomb (auto-flee), Adrenaline (+3).

### Cleared cells — the core tension

Cleared cells are free to cross for everyone and hold no loot. The leader clears the way
and gets loot, clears and perks but loses a round to being Winded after every win.
Followers move fast on cleared cells but arrive weak at The Wall.

## 7. Loot

- Loot cell: draw 1 item, then Scavenging vs 9 for a second (Scavenger: vs 7, plus a
  Scavenging vs 12 roll for a third).
- Inventory: 4 slots. If full, the lowest-rarity item (new item loses ties) is discarded.
- 22 items in `src/engine/data/items.ts`, weighted by rarity (common 6 / uncommon 3 / rare 1).

## 8. Events

One-shot, triggered by the first visitor (`src/engine/data/events.ts`): Radiation Leak,
Abandoned Depot, Ambush, Tunnel Shortcut, Dying Stranger, Collapsed Floor, Radio
Broadcast, Feral Dogs.

## 9. Outbreak Wave

- Covers the bottom row at the end of round 4, then one more row every 3 rounds,
  up to 4 rows.
- Awake players inside it lose 2 HP at the end of each round (armor does not help).
- The Wave bleeds you down to 1 HP but never knocks you out by itself, and skips players
  in the round they wake up. It forces progress without creating knockout loops.

## 10. Knockout (HP 0)

Not elimination. You skip the next 2 rounds, lose 1 random item, and wake with 3 HP in the
same cell. Cell state is preserved. A 40-round hard cap guarantees the game ends: the
player closest to the Safe Zone wins (ties: more HP).

## 11. Classes

| Class | Combat | Evasion | Scav | HP | Passive |
|---|---|---|---|---|---|
| Scout | 0 | 3 | 2 | 9 | Vision range 2 |
| Scavenger | 2 | 2 | 3 | 10 | Starts with a Crowbar; easier second draw; may find a third |
| Guardian | 3 | 0 | 1 | 12 | +1 armor; flee difficulty +1 |
| Medic | 2 | 2 | 1 | 10 | Starts with a First Aid Kit; healing items ×2; rest heals +1; heals partner after a team fight |
| Engineer | 1 | 2 | 2 | 10 | Craft a Pipe Bomb on a rest round (cooldown 6); Open Path: spend a round clearing adjacent rubble for everyone (cooldown 10) |

Each class picks 1 of 2 starting perks in the lobby. Every 3 clears (zombie cells cleared
by fighting) a player chooses 1 of 2 random perks from their class pool (3 perks), padded
with generic perks when the pool runs dry.

## 12. Player interaction

v1 is race + cooperation only: no PvP damage, sabotage or theft. Players can share cells
and fight together. Actions are plain data, so PvP actions can be added later.

## 13. Networking model (summary)

- No server. WebRTC mesh via Trystero; every client holds the full input history.
- The game is a pure function of a grow-only set of inputs. Clients exchange inputs,
  never state. See `DECISIONS.md` for the sync and reconnect protocol.

## 14. Balance snapshot (`npm run sim`, 1000 four-player bot games)

- Average 14.7 rounds (min 10), 2 players ≈ 17, 3 players ≈ 15.5.
- Win rate per class (per appearance; 4 of 5 classes per game, fair share 25%):
  Scout ~25%, Scavenger ~23%, Guardian ~24%, Medic ~24%, Engineer ~29%.
