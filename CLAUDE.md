# CLAUDE.md

## Communication
- Talk to the user in **Turkish only** (chat, questions, progress notes, reports).
- Everything in the repo is **English**: code, comments, UI text, docs, commit messages. No Turkish in any file.
- In-game text tone: dry, grim, terse (Fallout/Metro style).

## Commands
- `npm run dev` – Vite dev server. Multi-tab local test: `http://localhost:5173/?net=local`. Solo vs bots: `?bots=3`.
- `npm test` – Vitest (engine determinism, sync merge, map solvability…).
- `npm run sim` – 1000 bot games; fails if balance targets are missed.
- `npm run build` – typecheck + production build to `dist/`.

## Architecture rules
- `src/engine/` is pure TypeScript: no DOM, no network, no `Math.random`, no `Date`. State = `deriveState(inputs)`.
- Inputs are a grow-only map keyed `${round}:${playerId}:${type}:${n}`. Same key twice → deterministic tie-break (smallest canonical JSON). Never depend on arrival order.
- Replay always uses canonical order (rotating player order per round), never arrival order.
- Dice: `rng(seed, round, playerId, tag)`; never a sequential/global counter.
- A `force` input for (round, player) beats that player's real inputs for that round (counts as Wait / Hide).
- All tunable numbers live in `src/engine/balance.ts`. Content lives in `src/engine/data/`.
- `src/net/` holds transports (`TrysteroTransport`, `LocalTransport`) behind the `Transport` interface; `src/session/` does sync, presence, persistence, reconnect. UI (`src/ui/`) only reads derived state and submits inputs through the session.
- Title/app id: `src/config.ts`. Record non-obvious decisions in `DECISIONS.md`.
