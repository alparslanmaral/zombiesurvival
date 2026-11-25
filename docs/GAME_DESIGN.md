# Ashen Road — Game Design

> The City is lost. The road north is not.

An online, turn-based, dice-driven board game for 2–4 friends. Everyone starts in the
ruined City (bottom row) and races north to the Safe Zone (top row). First one in wins.
Target length: ~15 rounds, ~30 minutes.

All numbers below are defaults from `src/engine/balance.ts`, which is the source of truth.
Balance is verified by `npm run sim` (1000 four-bot games).

## 1. Map

- **Hex grid**, 8 columns × 11 rows of pointy-top hexes (odd rows shifted half a hex).
  Six directions: NE, E, SE, SW, W, NW. North is reached via NE or NW.
- Bottom row: the City (start row, always open). Players start in different columns.
- Top row: the Safe Zone. Entering any Safe Zone hex wins the game.
- The rows in between are a **street network**, not an open field:
  - 3 *trunk roads* wander north from the City to the Safe Zone,
  - 4–7 *side streets* branch off them; some loop back into another road (alternative
    routes), some just stop,
  - 4 *spurs*: short alleys that dead-end in the ruins, usually holding loot, a shelter or
    an event (worth the detour, or not),
  - everything else is **ruins**: impassable and always visible.
  - Streets make up 35–55% of the inner hexes; maps outside that range are regenerated.
- Street hexes get content by weight (rows 1–3 are "The Wall", the dead crowding the fences):

| Street content | Base | Wall | Dead end |
|---|---:|---:|---:|
| Empty     | 20 | 12 | – |
| Loot      | 18 | 8  | 50 |
| Zombie    | 24 | 30 | 10 |
| Horde     | 14 | 30 | – |
| Event     | 10 | 4  | 15 |
| Shelter   | 7  | 8  | 25 |
| Barricade | 7  | 8  | – |

- The generator retries deterministically until (1) a BFS confirms every start can reach
  the Safe Zone, (2) every start has a route with hazard ≤ 5 (walker 1, horde 2), and
  (3) at least two streets enter the top row.

## 2. Fog of war

- The **street layout is public** (old city maps): everyone sees where the roads, forks and
  dead ends are. What is *on* a street is hidden.
- A player sees street contents within hex distance 1 (Scout: 2; Flashlight and perks +1).
- The first player to enter a hex reveals it for everyone; revealed hexes stay revealed.
- Fog is presentation only. There is no anti-cheat.

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
| Engineer | 1 | 2 | 2 | 10 | Craft a Pipe Bomb on a rest round (cooldown 6); Open Path: spend a round tearing open an adjacent barricade or ruin, creating a new street for everyone (cooldown 10) |

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

- Average 14.8 rounds (min 10), 2 players ≈ 17, 3 players ≈ 15.8.
- Win rate per class (per appearance; 4 of 5 classes per game, fair share 25%):
  Scout ~23%, Scavenger ~24%, Guardian ~26%, Medic ~25%, Engineer ~27%.

## 15. Look and feel

- Ember-and-blood palette: warm near-black backgrounds, ember orange for interaction,
  blood red for danger, a cold teal for the Safe Zone and healing. Saturated colour is kept
  to small glowing details so long sessions stay comfortable.
- SVG everything: the hex board and a hand-drawn icon set (cells, classes, all items,
  events, UI). No emoji.
- Motion: drifting embers and film grain, hexes popping in as they are revealed, pulsing
  zombie hexes, a marching Outbreak Wave front, tokens sliding between hexes with trails,
  floating damage/heal numbers, screen flash and shake when you are hit, a dice tumble,
  and a glitching title. Everything respects `prefers-reduced-motion`.
