# ADR 0001: Canvas 2D, no rendering library

Date: 2026-09-26. Status: accepted.

## Context

The game draws a few hundred small sprites, a tiled ground and some
translucent shapes, at 60 fps on a phone. The idea card left the choice
between PixiJS (WebGL, sprite batching) and plain Canvas 2D to the first
frame-rate measurement.

## Decision

Canvas 2D, with every sprite drawn once by code and cached as an image.

## Reasons

- The headless sim step with 500 enemies and six maxed weapons costs 0.4 ms,
  so the frame budget is almost all rendering, and 500 `drawImage` calls of
  cached bitmaps fit in it on a three-year-old phone.
- Zero dependencies for the game view. No WebGL context loss handling when
  Safari backgrounds the tab, no library version to track.
- Procedural art is the plan anyway (there is no artist), and canvas paths
  are the natural tool for it.

## Consequences

- Device pixel ratio is capped at 2 to hold fill rate.
- If a later map wants lighting or thousands of particles, that is the point
  to revisit this with PixiJS. The renderer is one file with a `render(state)`
  entry, so a swap does not touch the sim.
