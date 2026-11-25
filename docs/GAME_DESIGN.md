# Ashen Road — Game Design

> The City is lost. The road north is not.

An online, turn-based, dice-driven board game for 2–4 friends. Everyone starts in the
ruined City (bottom row) and races north to the Safe Zone (top row). First one in wins.
Target length: ~15 rounds, ~30 minutes.

All numbers below are defaults from `src/engine/balance.ts`; that file is the source of truth.

## 1. Map

- 7 columns × 10 rows, square grid, 4-directional movement.
- Row 9 (bottom) is the City: start row, always open. Players start in different columns.
- Row 0 (top) is the Safe Zone. Entering any Safe Zone cell wins the game.
- Rows 1–8 are generated from the seed with these weights:

| Cell      | Weight | Notes |
|-----------|-------:|-------|
| Empty     | 23%    | includes the "remainder" |
| Loot      | 18%    | first visitor draws items |
| Zombie    | 20%    | single walker, difficulty 7, 2 damage |
| Horde     | 12%    | difficulty 10, 3 damage |
| Event     | 10%    | one-shot event from the event table |
| Shelter   | 7%     | +3 HP once per player per shelter |
| Blocked   | 10%    | rubble, impassable |

- The generator retries (deterministically, `attempt` is part of the hash) until a BFS
  confirms every start cell can reach the Safe Zone.

## 2. Fog of war

- A player sees cell types in the 3×3 square around them (Scout: 5×5).
- The first player to enter a cell reveals it for everyone; revealed cells stay revealed.
- Fog is a presentation rule. There is no anti-cheat; the whole map is in every client.

## 3. Round flow

1. **Plan** — every awake player secretly picks one action:
   `Move(N/E/S/W)`, `Wait`, `Use item`, or a class ability. Choices are revealed when
   all are in. If a level-up is pending, the perk choice rides along with the action.
2. **Resolve** — players resolve one at a time in *resolution order*. The order is the
   roster order rotated by one every round. When a player enters (or is stuck in) a cell
   with live zombies, resolution pauses until **that player** picks Fight / Flee / Hide.
3. **End of round** — Outbreak Wave damage, status cleanup, knockout timers, next round.

The round does not finish until every required input exists (real or forced).

## 4. Dice

`2d6 + stat + gear + modifiers ≥ difficulty`.

- **Double 6**: automatic success plus a bonus (extra loot draw on a fight, extra effect elsewhere).
- **Double 1**: automatic failure and +1 damage.
- Stats: **Combat**, **Evasion**, **Scavenging**. Gear does not stack: for each stat only
  the best item counts.

## 5. Encounters

Entering an uncleared zombie or horde cell forces a decision:

| Choice | Roll | Success | Failure |
|---|---|---|---|
| **Fight** | Combat vs 7 (zombie) / 10 (horde) | Cell cleared, loot to you (1 draw / 2 for a horde), counts as a clear | Damage, you stay in the cell, still engaged |
| **Flee** | Evasion vs 9 | You slip past. You stay in the cell but may move on next round without a fight | Damage, pushed back to the cell you came from |
| **Hide** | 2d6 vs 5 | Hidden. Still engaged next round, but your next roll in this cell gets +2 (ambush) | Damage, still engaged |
| **Fight together** | only if a hidden player is in the cell | Both roll; best total +1 team bonus. Both get loot and the clear | Damage split (you take the larger half) |

- Damage is reduced by armor (minimum 1). Outbreak Wave damage ignores armor.
- A player who is *engaged* (failed fight, hidden) cannot just walk away: at their resolve
  step they face the cell again. Their plan options are Wait or Use item.
- Consumables can be spent as part of the decision: Molotov (auto-win a fight),
  Smoke Bomb (auto-flee), Adrenaline (+3), Pipe Bomb (auto-win vs a single zombie).

### Cleared cells — the core tension

Cleared cells are free to cross for everyone and hold no loot. The leader clears the way
and gets loot, clears and perks, but is slowed down. Followers move fast but arrive weak.

## 6. Loot

- Loot cell: draw 1 item. Then Scavenging vs 9: success draws a second.
- Inventory: 4 slots. If full, the lowest-value item (new item loses ties) is discarded.
- ~20 items in `src/engine/data/items.ts`, weighted by rarity (common 6 / uncommon 3 / rare 1).

## 7. Events

One-shot, triggered by the first visitor. See `src/engine/data/events.ts`
(Radiation Leak, Abandoned Depot, Ambush, Tunnel Shortcut, Dying Stranger, Collapsed
Floor, Radio Broadcast, Feral Dogs).

## 8. Shelter

Each player may heal +3 HP once per shelter (applied when entering or waiting in it).

## 9. Outbreak Wave

- Starts at the end of round 4 covering the bottom row; advances one row every 3 rounds.
- Any awake player inside it takes 2 damage at the end of the round. Armor does not help.
- Never covers the Safe Zone.

## 10. Knockout (HP 0)

Not elimination. You skip the next 2 rounds, lose 1 random item, and wake with 3 HP in the
same cell. Cell state is preserved. Knocked-out players take no wave damage.

A hard cap (`MAX_ROUNDS`) guarantees the game ends: the player closest to the Safe Zone wins.

## 11. Classes

| Class | Combat | Evasion | Scav | HP | Passive |
|---|---|---|---|---|---|
| Scout | 0 | 3 | 2 | 9 | Vision range 2 |
| Scavenger | 1 | 1 | 3 | 10 | Easier second loot draw; may find a third |
| Guardian | 3 | 0 | 1 | 12 | +1 armor; flee difficulty +1 |
| Medic | 1 | 1 | 2 | 10 | Healing items ×2; heals partner in team fights |
| Engineer | 1 | 2 | 2 | 10 | Abilities: Craft (pipe bomb) and Open Path |

Each class picks 1 of 2 starting perks in the lobby. Every 3 clears (zombie cells cleared
by fighting) a player chooses 1 of 2 random perks from their class pool (3 perks), padded
with generic perks when the pool runs dry.

**Engineer abilities**
- *Craft*: spend the round building a Pipe Bomb (needs a free slot; cooldown).
- *Open Path*: move in a direction ignoring obstacles for one round: rubble becomes an
  open cell, zombies are slipped past without a roll. Long cooldown.

## 12. Player interaction

v1 is race + cooperation only: no PvP damage, sabotage or theft. Players can share cells.
The engine keeps actions as data so PvP actions can be added later.

## 13. Networking model (summary)

- No server. WebRTC mesh via Trystero; any player's client holds the full history.
- The game is a pure function of a grow-only set of inputs. Clients exchange inputs, never
  state. See `DECISIONS.md` for the sync and reconnect protocol.
