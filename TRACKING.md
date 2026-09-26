# Analytics tracking

Räkkä uses the house tracker: `public/tracker.js` is the clavesa web tracker
(`clavesa-dev/web-tracker/tracker.js`), vendored unmodified. Improvements go
upstream to that directory, never into this copy. The pattern and its
invariants are in `jeeves/practices/web-tracking.md`; this file covers only
what Räkkä does differently.

## Split hosting

The game deploys to GitHub Pages, which keeps no request logs, so the pixel
is served from our own CloudFront (Terraform under `infra/`, the sceggle
shape). The endpoint is an absolute cross-origin URL in `index.html`'s
`TRACKER_CONFIG`. The tracker is disabled on localhost and when the page is
opened with `?bot=1`, which is what `make shots` uses, so screenshot runs and
dev sessions never count as visits.

Beacons go out with `sendBeacon` (POST). The distribution allows only GET and
HEAD, so they answer 403 and still land in the access log with the query
string intact, which is all a pipeline reads.

## Game events

`track(event, data)` in `src/records.ts` wraps `window.__clvtracker.track`.
Wired events: `run_start` (character, seed), `pick` (upgrade id, level,
kind), `chest` (size, items), `run_end` (character, time, level, kills).

## Standing it up

```sh
make plan          # terraform plan (infra/tfplan)
make apply         # buckets + CloudFront; prints pixel_url
make deploy-pixel  # upload public/t.gif with no-store
```

Logs land in `s3://rakka-cloudfront-logs/cloudfront/` with a 90-day
lifecycle. The nightly clavesa rollup and the dashboard are the next slice
(ROADMAP).
