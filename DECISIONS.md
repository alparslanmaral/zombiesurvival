# Decisions

Non-obvious choices made while building Ashen Road, with the reason for each.

## Architecture

1. **Engine = `deriveState(inputs)`, replayed from scratch.** No incremental state, no
   snapshots. A full game is a few hundred tiny inputs, so a full replay costs well under
   a millisecond; the sim runs 1000 games in about 3 seconds. Correctness and simplicity beat caching.
2. **Encounter pauses use an exception (`Blocked`) inside the replayer.** Resolution is
   sequential; when a player owes an encounter decision, the replay stops there and the
   partially resolved round becomes the visible state. When the decision arrives, the
   whole history is replayed again.
3. **Same key, different payload → smallest canonical JSON wins.** The spec says duplicate
   keys are ignored, but "first one wins" depends on arrival order and could diverge if one
   player submits from two tabs. A total order on payloads keeps every client identical.
4. **Forced input has its own key (`round:pid:force:0`)** and overrides that player's whole
   round: action → Wait, any encounter → Hide, pending perk → first offer. That makes
   "forced beats real" independent of arrival order. The UI offers the skip only for
   players who are both pending and disconnected.
5. **Perk choices ride inside the next `action` input** instead of being separate inputs.
   A free-standing perk input could arrive after its round resolved and rewrite history.
6. **Dice tags name the purpose of a roll** (`enc`, `loot2:<cell>`, `team:<pid>`, …) and
   include the cell index where a player could roll the same thing twice in one round
   (tunnel chains). No counters anywhere.
7. **Bots are an input source, not part of the engine.** Bots read the derived state and
   submit ordinary inputs. Solo games persist and resume exactly like online games.
8. **`next` input for "Play again".** The winner screen's "Play again" creates a new room
   and records it as a synced input, so every client (even one that reconnects later)
   gets a "Join the next run" button.

## Networking

9. **Trystero 0.27 strategies are separate packages** (`@trystero-p2p/nostr|torrent|mqtt`);
   the `trystero` meta-package only re-exports Nostr. We depend on the three packages
   directly and load the chosen one with a dynamic `import()`, so unused strategies (the
   MQTT one is ~330 kB) never load. Default: Nostr. Override with `VITE_TRYSTERO_STRATEGY`
   or `?net=torrent|mqtt`. All three were verified end to end with two browser contexts.
10. **`identity: 'none'` in Trystero.** Player identity is our own persistent `playerId`;
    Trystero's identity would merge same-profile tabs into one user.
11. **`rtcConfig.iceServers`** = Google STUN (+ TURN from env). In Trystero 0.27 this replaces
    its default ICE list, which is what the brief asked for.
12. **Join/leave are serialized globally** in `TrysteroTransport`. React StrictMode remounts
    and fast rejoins otherwise overlap, and Trystero refuses a second join of a live room.
13. **Sync protocol** (`src/session/session.ts`):
    - `hello {playerId, keys[]}` on join and on every new peer; the receiver sends the inputs
      the sender lacks and, if it lacks some itself, replies with its own `hello` (flagged
      `reply` so it never ping-pongs).
    - New inputs are broadcast; inputs learned from a peer are gossiped once to the other
      peers, so a partial mesh still converges.
    - Anti-entropy: every 10 s a `sum {count, hash}` digest; a mismatch triggers `hello`.
    - Presence (`name, class, perk, ready, host, since`) is broadcast every 5 s and doubles as
      the heartbeat. A player counts as connected while they have a live peer connection and
      were heard from in the last 30 s.
    - Reconnect: on `visibilitychange`, `pageshow`, `online` and every 5 s, if we expect
      peers but have none, leave and rejoin, with exponential backoff (2 s → 60 s).
14. **Lobby host.** The creator (stored in room metadata) starts the game. If no creator is
    connected, the earliest connected player gets the Start button, so a lobby never gets stuck.
15. **LocalTransport identity is per tab** (`sessionStorage`) under `?net=local`, so several
    tabs can be different players. Normal play uses `localStorage`.
16. **Persistence = localStorage**, one JSON array per room, merged on write (grow-only).
    A full game is ~50 kB at most. IndexedDB wasn't needed.

## Rules and balance (deviations from the brief, all in `balance.ts`)

The brief's numbers produced ~9.6-round games (the minimum path is 9 moves) and the
Guardian won 39%. Pure number tweaks could not get past ~12 rounds: with 4 players, the
winner is whoever found the cleanest lane (a minimum over 4 noisy runs). These rules were
added to reach the 14–18 target while keeping the core tension:

17. **Stamina: at most 3 consecutive moving rounds, then rest** (+1 HP). This adds steady,
    predictable friction that hits the lucky clean-lane runner hardest and reduces variance.
    It also makes Wait/Use rounds meaningful.
18. **Winded: winning a fight costs your next move.** This makes the brief's "leader gets
    stronger but slower" real; before it, a won fight cost no time at all.
19. **Hordes must be beaten twice** (first win thins them to a walker). A double six still
    drops a horde in one blow.
20. **The Wall:** the 3 rows below the Safe Zone are denser with zombies, so followers who
    "arrive weak" really feel it. A map-quality check (hazard ≤ 5 on some route from every
    start) removes unwinnable horde walls.
21. **Flee costs stamina, and stopping in a cell you slipped through re-engages you.** Without
    this, Evasion was strictly the best stat and Scouts dominated.
22. **Fog uses orthogonal adjacency** (Manhattan radius), which matches 4-directional movement
    and "adjacent" in the brief.
23. **Wave cap and mercy:** the Wave covers at most 4 rows, never knocks anyone out by itself
    (stops at 1 HP) and skips players on the round they wake. Without this, late games could
    trap players in an endless knockout loop.
24. **Engineer Open Path clears adjacent rubble (for everyone) and takes the round**; it no
    longer lets the Engineer walk through zombies. The original version alone added ~14
    percentage points of win rate.
25. **Class tweaks:** Scavenger 2/2/3 + starting Crowbar, Medic 2/2/1 + starting First Aid Kit
    and +1 rest healing, Scout starting perks are Low Profile (hide −2) / Rooftop Eyes (+1 vision).
26. **Win-rate metric:** wins ÷ games played as that class, in 4-player games with 4 distinct
    random classes (fair share 25%). Two-player win rates are naturally ~50%, so the 35%
    ceiling is only meaningful at a fixed table size.
27. **Hard cap of 40 rounds** (closest to the Safe Zone wins) guarantees termination. About
    1 in 1000 bot games reaches it.
28. **Duration estimate** in the sim uses a simple table-time model (45 s per plan phase,
    12 s per encounter decision, 2.5 s per dice animation) and gives ~15 minutes for bots.
    Humans talking over voice chat will be slower; ~25–30 min is realistic.

## UI

29. **Tap-to-move plus a d-pad.** Adjacent legal cells light up on the map; the d-pad, Wait,
    items and Confirm sit in the lower half of the screen for one-handed play. The cell size
    is computed so the 10-row map and the action panel fit on an ~844 px tall phone.
30. **Dice animation only for new rolls.** Rolls present on mount (resume) are not replayed;
    after a long absence only the last 4 are shown. Tap to skip.
31. **Plan choices stay hidden until everyone is in.** The data is technically visible to
    any client (no anti-cheat), but the UI only shows actions from the resolve phase on.
