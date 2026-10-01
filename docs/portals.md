# itch.io and Newgrounds

The same build goes to both portals. Each one shows it in an iframe on its
own upload host, so the build uses relative paths (`--mode portal`).

## Build and check

```sh
make portal        # dist-portal/ and rakka-web.zip, index.html at the zip's root
make portal-check  # the zip's contents in a cross-origin iframe: a run starts,
                   #   the leaderboard loads, the console stays clean
```

A portal does not update itself. After a change, run `make portal` again and
upload the new zip to both.

## What works in the iframe

- **The leaderboard** is the same one as on GitHub Pages. Players read it
  through CloudFront (`GET /board`, cached a minute), so a portal feature
  does not reach the API; only saved scores do. The records API allows `html-classic.itch.zone`, `html.itch.zone` and
  `uploads.ungrounded.net` (`infra/records.tf`). If a portal moves its upload
  host, scores stop posting from there and the leaderboard shows "did not
  load"; add the new origin.
- **Tracking** works unchanged: the pixel is an absolute URL. The `?stats`
  board shows portal plays under the referrer breakdown, as the portal's own
  host (for example `vesahyp.itch.io`, `www.newgrounds.com`).
- **The language** follows the player's browser, so most portal players get
  English.
- **Not available:** the screen wake lock (the portals' permissions policy
  refuses it, so a phone can dim during a long run) and "add to home screen".
- **Saves** (records, Tapio's Table) live in the portal's storage, apart from
  GitHub Pages. The table code in Tapio's Table moves them.

## itch.io

New project at https://itch.io/game/new:

| Field | Value |
| --- | --- |
| Kind of project | HTML |
| Uploads | `rakka-web.zip`, "This file will be played in the browser" |
| Viewport | 420 × 820, "Mobile friendly" on, orientation portrait |
| Frame options | "Fullscreen button" on, "Automatically start on page load" off |
| Classification | Games |
| Genre | Action |
| Tags | survivors-like, bullet-hell, roguelite, auto-shooter, mobile, local-co-op, folklore, finnish, singleplayer, short |
| Pricing | No payments |
| Languages | English, Finnish |
| Inputs | Touchscreen, Keyboard |
| Community | Comments |

A cover image (630 × 500) and three to five screenshots are needed. `make
store` takes both into `store/`: the cover at twice that size, and English
phone screenshots of a bot run (title, heroes, swarm, boss, minutes 10 and
16, level-up cards, an evolution chest, co-op). Upload `cover.png`, then
`04-boss`, `09-co-op`, `06-minute-16`, `02-heroes` and `07-level-up`.

## Newgrounds

Submit at https://www.newgrounds.com/projects/games: HTML5, upload
`rakka-web.zip`, dimensions 420 × 820, "Mobile friendly" and "Allow
fullscreen" on. The form asks for an icon and a rating: the violence is
cartoon violence against insects and spirits, with no blood.

## Store page text

**Title:** Räkkä

**Short description:** Survive the swarms of a Finnish forest. One thumb,
weapons that fire on their own, heroes from the Kalevala.

**Description:**

> Räkkä is the Finnish word for the weeks of summer when the mosquitoes and
> black flies of Lapland are at their worst. This game is those weeks,
> without end.
>
> Walk with one thumb. Your weapons fire on their own. Collect the berries,
> choose an upgrade at every level, and stay alive as long as you can. A boss
> comes every five minutes. At minute 28, Tuoni, death itself, comes for you.
>
> - 11 heroes from the Kalevala and from Finnish and Sámi folk belief:
>   Väinö, Louhi, Ilmarinen, a Sámi noaidi, a sauna elf and more
> - 13 weapons, each with an evolution, 15 items and 20 charms that change
>   the rules of a run
> - Mosquitoes, black flies, horseflies, ticks, forest spirits, the Näkki and
>   Iku-Turso
> - Two players on one phone: each half of the screen is one player's thumb
> - A global leaderboard: today, this week, this month and all time
> - Tapio's Table: cones you find in the forest buy small permanent upgrades
> - In English and Finnish
>
> **Controls:** touch and drag anywhere to move. On a keyboard, WASD or the
> arrow keys; number keys pick a card; P pauses.
