# CLAUDE.md

Guidance for AI agents working in this repo. `README.md` is the player page:
what the game is and how to play it. Code, architecture and process notes
live here. `ROADMAP.md` is forward-looking only.

## What this is

**Räkkä** is a survivors game (the Vampire Survivors shape) for the browser,
phones first, set in a Finnish forest with Finnish, Karelian and Sámi lore as
the cast. One thumb moves the player. Weapons fire on their own. The player's
decisions are where to walk and which upgrade to take.

Named after räkkä, the weeks of summer when the mosquito and black fly swarms
in Lapland are at their worst.

## Stack

- **Vite + TypeScript + React.** React renders the menus, the HUD and the
  overlays. The game itself never goes through React.
- **Canvas 2D** for the game view. No engine, no WebGL library. Sprites are
  drawn once with canvas paths and cached as images (`src/render/sprites.ts`).
  See `docs/adr/0001-canvas-2d.md`.
- **No physics, no ECS.** Enemies, projectiles and zones are plain arrays of
  objects. A uniform grid (`src/game/grid.ts`) answers "what is near here".
- **Seeded RNG** (`src/game/rng.ts`). One stream per run on the sim state.
  Same seed and same input replay the same run.

## Where things live

```
src/
  game/               the simulation, no DOM anywhere in here
    state.ts          SimState and createState; the XP curve
    sim.ts            step(): player, director, enemies, drops, berries
    weapons.ts        firing patterns, projectile and zone updates
    combat.ts         hurt(), heal, slow, nearest enemy
    upgrades.ts       derived stats, level-up offers, chests, evolutions
    grid.ts           uniform grid over enemies, rebuilt every step
    forest.ts         deterministic features per cell: trees that block, mushrooms
    types.ts          Enemy, Projectile, Zone, Stats and friends
    content/
      characters.ts   who you play and their starting traits
      weapons.ts      12 weapons with 8 levels, 12 evolutions
      passives.ts     14 passive items
      powers.ts       20 taiat: rule-changing perks outside the slots, 8 per run
      enemies.ts      the roster, minute-0 numbers
      waves.ts        what spawns when, swarm events, boss minutes
  render/
    renderer.ts       camera, ground, decorations, everything drawn
    sprites.ts        procedural sprite cache
  input/input.ts      floating thumb stick and keyboard
  ui/                 React: Game (loop + HUD + overlays), Screens, Cards
  records.ts          localStorage records and unlocks
  meta.ts             Tapion pöytä: cones from runs buy small permanent stat ranks
  audio.ts            Web Audio synth: effects, the music loop, the mosquito whine
  version.ts          build id and the newer-build check behind the update banner
  ui/StatsScreen.tsx  the traffic board, opened with ?stats (TRACKING.md)
  api.ts              the global records API client (infra/records.tf)
analytics/            the clavesa workspace that rolls the pixel logs into
                        data/analytics.json; run-analytics.sh is the 08:30 cron
tools/
  sim-check.ts        npm run sim-check: weapon table + assertions
  balance.ts          npm run balance: bot runs, one line per run
  autoplayer.ts       the bot both tools use
```

## Rules

1. **The sim is headless.** Nothing under `src/game/` may touch `window`,
   `document`, React or audio. This is what makes `sim-check` and `balance`
   possible. Sounds are names pushed onto `state.sounds`; the game loop
   drains them into `audio.play`.
2. **Fixed step.** The sim runs at `DT = 1/60`; the render loop accumulates
   real time and calls `step` a whole number of times. Never pass a frame
   delta into `step`.
3. **Content is data.** A new weapon is a `WeaponDef` plus, if needed, a
   pattern in `weapons.ts`. A new enemy is an `EnemyDef` plus a wave entry.
   Balance changes are number changes in `content/`. A taika is a `PowerDef`
   plus its rule, hooked in where the rule lives with `powerLevel(s, id)`.
4. **Every hit goes through `hurt()`.** Damage numbers, knockback, run stats
   and the tick's flash all live there.
5. **Bounded arrays.** Enemies cap at 520, berries at 400 (they merge), damage
   texts at 48. The phone is the budget.
6. **Finnish in the game, English in the code.** UI strings and lore names
   are Finnish. Identifiers, comments and docs are English.

## Workflow

- `make dev` (http://localhost:5173, also on the LAN for a phone).
- **Before committing:** `npm run typecheck`, `npm run build` and
  `npm run sim-check` must pass. `sim-check` prints the weapon table first;
  read it when you touched a weapon or an enemy.
- **Balance with `npm run balance [minutes] [runs] [character]`.** The bot is
  a floor, not a player: it kites and collects but has no plan. A change that
  moves the bot's average survival moves the human's too, in the same
  direction.
- `make plan` and `make apply` for `infra/`: the tracking pixel host and the
  records API (DynamoDB + Lambda + HTTP API). The API URL is baked into
  `src/api.ts`, the pixel URL into `index.html`.
- Deploy is automatic: every push to `main` builds and publishes to GitHub
  Pages (`.github/workflows/deploy.yml`) at https://vesahyp.github.io/rakka/.
- Screenshots come from `make shots` (Playwright, iPhone emulation), never
  from a hand-held browser.
- When a change alters what the player sees or does, update `README.md` in
  player words.

## Lore sources

Kalevala for the heroes and Väinämöinen's kit. Finnish folk belief for the
forest folk (menninkäinen, peikko, hiisi, liekkiö, näkki, ajattara, Tapio and
his court). Sámi tradition for the noaidi and the drum, Stállu, gufihtar,
čáhcerávga, and Horagalles as the thunder god's other name. Insects are the
real Lapland cast: hyttynen, mäkärä, paarma, punkki, hirvikärpänen. All of it
is public domain. None of it should be treated as authoritative folklore; it
is a game.
