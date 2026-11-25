# Ashen Road

*The City is lost. The road north is not.*

An online, turn-based, dice-driven board game for 2–4 friends, played in the browser
(made for phones). A zombie outbreak has swallowed the City. Pick a class, push north
through a branching, fogged hex map of ruined streets, loot, fight, flee or hide, and be the first into the Safe Zone.
A game takes about 15 rounds / 30 minutes.

- **No backend.** A static site on GitHub Pages; players connect peer-to-peer over WebRTC
  ([Trystero](https://github.com/dmotz/trystero), serverless signaling over Nostr by default).
- **Resumable.** Every client stores the full input history. Refresh, close the browser,
  lose signal: open the same link and the game continues.
- **Deterministic engine.** The game state is a pure function of the inputs, so every
  phone computes the same board and the same dice.

Rules: [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md) · Design decisions: [DECISIONS.md](DECISIONS.md)

## Play

1. Open the site, enter a name, **Create a room**.
2. Share the invite link (or the 4-letter code). Friends open it and pick a class.
3. Everyone taps **Ready**; the host taps **Start the run**.

Solo against bots: tap **Solo run against 3 bots**, or open `…/?bots=3`.

## Develop

Requires Node 22+.

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest: determinism, idempotency, forced inputs, map solvability, sync/reconnect
npm run sim        # 1000 bot games, prints rounds / duration / class win rates, fails if off target
npm run build      # typecheck + production build into dist/
```

Useful URL switches (put them before the `#`):

| URL | Effect |
|---|---|
| `/?net=local` | BroadcastChannel transport: every tab is a separate player, no network. Best way to test multiplayer on one machine. |
| `/?net=torrent`, `/?net=mqtt`, `/?net=nostr` | Override the Trystero signaling strategy. |
| `/?bots=3` | Start a solo game against 1–3 bots. |

### Configuration

The game title and app id live in `src/config.ts`. All game numbers live in
`src/engine/balance.ts`. Optional build-time env vars (see `.env.example`):

| Variable | Default | Purpose |
|---|---|---|
| `VITE_TRYSTERO_STRATEGY` | `nostr` | `nostr`, `torrent` or `mqtt` |
| `VITE_TURN_URL` / `VITE_TURN_USERNAME` / `VITE_TURN_CREDENTIAL` | none | TURN relay for players behind strict NAT (some mobile carriers). Google STUN is always used. Note: anything in a static build is public. |
| `VITE_BASE_PATH` | `./` | Asset base path. The relative default works on any Pages URL because routing is hash-based (`#/room/ABCD`). |

## Deploy to GitHub Pages

The workflow `.github/workflows/deploy.yml` tests, simulates, builds and deploys on every
push to `main`. One-time setup in the GitHub repository:

1. **Settings → Pages → Build and deployment → Source: `GitHub Actions`.**
   (Not "Deploy from a branch".)
2. Push to `main` (or run the workflow from the **Actions** tab → *Deploy to GitHub Pages* → *Run workflow*).
3. The site appears at `https://<user>.github.io/<repo>/`.

Optional:

- **Settings → Secrets and variables → Actions → Secrets:** `VITE_TURN_URL`,
  `VITE_TURN_USERNAME`, `VITE_TURN_CREDENTIAL` if you have a TURN server.
- **Settings → Secrets and variables → Actions → Variables:** `VITE_TRYSTERO_STRATEGY`
  (e.g. `torrent`), `VITE_BASE_PATH` (only if you need absolute asset paths).
- If the deploy job says the `github-pages` environment rejects the branch, check
  **Settings → Environments → github-pages → Deployment branches** and allow `main`.
- Private repositories need a paid GitHub plan for Pages.

## Project layout

```
src/engine/    pure TypeScript game engine (no DOM, no network): rules, dice, map, bots
src/net/       transports: TrysteroTransport, LocalTransport, NullTransport, MemoryTransport
src/session/   sync protocol, presence, persistence, reconnect, solo bots
src/ui/        React screens and components
scripts/sim.ts balance simulator
tests/         Vitest suites
```

## Troubleshooting

- **Friends never show up in the lobby:** some public relays are flaky. Try
  `?net=torrent` (everyone must use the same strategy) or configure a TURN server.
- **"No peers" during a game:** your moves are saved. The app retries in the background,
  and reconnects as soon as anyone returns. If a friend has left for good, open **Squad**
  and tap **Skip (count as Wait)** to keep the game moving.
