# Räkkä

A Vampire Survivors clone for the browser, phones first, set in a Finnish
forest with Finnish mythology as the cast. Idea recorded 2026-09-26. No repo
yet.

## What it does

One run is ten to fifteen minutes. The player walks a forest clearing. Waves
of enemies come from every edge and grow with the clock. Weapons fire on their
own; the only inputs are where to walk and which upgrade to take at each
level. Death ends the run. The score, the unlocks and the run length carry to
the next run.

That input model is why the genre fits a phone. One thumb moves, one tap picks
an upgrade, nothing else is asked of the hand.

## Theme

The forest supplies both the enemies and the arms.

| Role | Cast |
|------|------|
| Swarm fodder, from minute one | mosquitoes (hyttynen), black flies (mäkärä), horse flies (paarma) |
| Slow, sticky, they attach and drain | ticks (punkki), moose flies (hirvikärpänen) |
| Mid-tier, from the woods | menninkäinen, peikko, hiisi |
| Elites and bosses | Ajattara, Näkki from the lake edge, Otso the bear, Hiisi's host |
| Weapons | puukko, vihta (sauna whisk, sweeps in an arc), kokko (bonfire, area burn), kantele (a sound wave that pushes), Ukonvasara (lightning from Ukko), Tapio's antlers, mosquito coil (kärpäspaperi, a slow aura) |
| Passive items | tar (terva), pakuri, a compass, wool socks, the Sampo as the late-run economy item |
| Ground | Tapion pöytä (a stump altar that heals), ant hills, a lake edge that spawns Näkki |

The mythology is public domain. Vampire Survivors owns its name, art, sound
and text; the mechanics are open. Ship nothing that resembles their assets.

The pests are the point of the theme. A wave of two hundred mosquitoes reads
as a Finnish July at once, and it costs the renderer nothing: one sprite, one
behaviour, tinted.

## Scaffolding and publishing: copy sceggle

Same repo shape as [`projects/sceggle.md`](../projects/sceggle.md), because
that shape is already proven on a game with no domain:

- Vite + TypeScript. `npm run build` is `tsc --noEmit && vite build`.
- Deploy on every push to the default branch to GitHub Pages, from
  `sceggle/.github/workflows/deploy.yml`. Use `main` here. `master` in sceggle
  is the exception, not the rule.
- Tracking pixel on its own CloudFront, because Pages has no request logs.
  Copy `sceggle/infra/` and `sceggle/TRACKING.md`, then run
  `/new-site-tracking`.
- `CLAUDE.md` for code and architecture, `README.md` for players,
  `ROADMAP.md` forward-looking only. Same split, same reasons.
- Miniplex for the ECS and rot.js for the seeded RNG, lifted from sceggle.
  Same seed reproduces the same run, and a headless `sim-check` drives the
  real tick with no canvas.
- A Makefile as the entrypoint. A Playwright script for screenshots on an
  emulated phone, per the house rule.

What changes from sceggle:

- **2D, so no three.js.** A survivors game is a few hundred sprites on a flat
  plane. Render with PixiJS (WebGL, sprite batching, a maintained library) or
  a plain `<canvas>` if PixiJS proves heavier than needed. The decision goes
  in ADR 0001 once the first frame-rate measurement exists.
- **Authored content, small.** Sceggle rolls weapons from point budgets. A
  survivors game lives on a fixed roster that the player learns, so the roster
  is authored and short. Randomness is in what the level-up offers and where
  the waves come from.
- **Phone first.** Portrait, one virtual stick under the left or right thumb,
  `touch-action: none`, the safe-area insets respected, a wake lock during a
  run, installable as a PWA so the browser chrome goes away. Desktop gets WASD
  for free.

## v0, the thing to prove

Two questions decide whether this is worth more time:

1. **Does it hold 60 fps on a mid-range phone** with 300 enemies, 4 weapons
   firing and damage numbers on screen?
2. **Is a ten-minute run fun** with one map, one character, 4 weapons, 3
   passive items and 5 enemy types including one boss?

In scope for v0: that roster, the virtual stick, level-up picks, one
persisted number (best time), deploy to Pages, the pixel.

Out of scope: accounts, sound beyond a few effects, meta unlocks, multiple
maps, monetisation, a domain.

## Risks

1. **The genre is full.** Hundreds of clones exist, several free in the
   browser. What this one has is the theme and a phone-first web build that
   needs no store. That is enough for a portfolio piece and a game friends
   play; treat income as unlikely.
2. **Mobile browser performance is the real unknown.** Safari on a three-year
   old iPhone is the target that decides the renderer. Measure in week one,
   before any content work.
3. **Touch input decides the feel.** A bad virtual stick kills the game on
   the first try. Build the stick before the enemies and test it on a phone
   in hand.

## Name

**Räkkä** is the Lapland word for the weeks in summer when the mosquito and
black fly swarms are at their worst. It names the game's fodder wave, it is
one word, and it is a real Finnish term with no product on it that a search
found.

Repo and domain need ASCII. `rakka` also means a boulder field in Finnish, so
the plain spelling holds a second forest meaning. Not verified from this
session: whether `rakka.fi`, `rakka.dev` or `rakka.app` are free. Check before
buying. A domain is not in v0 at all; Pages is enough until the game earns
one.

Backup name: **Korpi**, the deep wet spruce forest.

## Open questions

- PixiJS or plain canvas. Answered by the first frame-rate measurement.
- Finnish or English UI. The theme argues Finnish. A game on Pages reaches an
  English-reading audience. Both, with Finnish default, costs about twenty
  strings in v0.

## Next step

A one-week spike, in this order: repo from the sceggle shape, a canvas with
the virtual stick on a real phone, then 300 tinted mosquitoes at 60 fps, then
the first weapon. Content after the frame rate is known.
