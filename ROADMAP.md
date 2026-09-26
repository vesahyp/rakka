# Roadmap

Forward-looking only. Shipped items are deleted; git history is the record.

## Next

- Sound: a few effects (hit, level-up, chest, boss) and a loop. Muted by
  default on first visit, remembered.
- Global records: a Lambda + HTTP API table of top runs, per
  `jeeves/practices/serverless`. Local records stay the fallback.
- Meta unlocks between runs: weapons and passives that enter the pool only
  after a first evolution, a first 20-minute run, and so on.
- Tracking pixel on CloudFront (`make apply`), then fill `TRACKER_CONFIG` in
  `index.html`. Same shape as sceggle.

## Later

- A second map: a bog at night with will-o'-the-wisps and a different
  roster.
- Daily seed: the same run for everyone, one table.
- Haptics on level-up and boss arrival where the browser allows.
