-- Long format on purpose: (day, site, dim, key, events, sessions).
-- A new event in the app is one more CASE branch here, not one more
-- column downstream; stats_json folds this into nested objects.
-- Humans only: the bot totals live in `daily`.
WITH human AS (SELECT * FROM ev WHERE NOT is_bot),
tagged AS (
  SELECT day, site, sid,
    CASE e
      WHEN 'click'     THEN 'cta_click'
      WHEN 'displayed' THEN 'cta_displayed'
      WHEN 'view'      THEN 'cta_view'
      WHEN 'scroll'    THEN 'scroll'
      WHEN 'crash'     THEN 'crash'
      WHEN 'error'     THEN 'error'
      -- Game events from src/records.ts track(): who was played and how
      -- runs ended. `pick` and `chest` beacons stopped on 2026-10-01 (the
      -- build and the chests now ride in run_end); old days keep them.
      WHEN 'run_start' THEN 'run_start'
      WHEN 'run_end'   THEN 'run_end'
      WHEN 'pick'      THEN 'pick'
      WHEN 'chest'     THEN 'chest'
    END AS dim,
    CASE
      WHEN e IN ('click', 'displayed', 'view') THEN q['sel']
      WHEN e = 'scroll'                        THEN q['depth']
      -- Boundary plus message: two crashes at the same place for
      -- different reasons are two different things to fix.
      WHEN e = 'crash'                         THEN concat(q['at'], ' · ', q['msg'])
      WHEN e = 'error'                         THEN q['msg']
      WHEN e IN ('run_start', 'run_end')       THEN q['character']
      WHEN e = 'pick'                          THEN q['id']
      WHEN e = 'chest'                         THEN q['size']
    END AS key
  FROM human
),
-- Weapon damage per run end: q['w'] is "puukko:12345,kokko:999". One row
-- per weapon with the damage as weight, so events = total damage; and one
-- with weight 1, so events = runs that had the weapon.
weapons AS (
  SELECT day, site, sid, split_part(kv, ':', 1) AS weapon, TRY_CAST(split_part(kv, ':', 2) AS BIGINT) AS dmg
  FROM (SELECT day, site, sid, explode(split(q['w'], ',')) AS kv FROM human WHERE e = 'run_end' AND q['w'] IS NOT NULL AND q['w'] <> '')
  WHERE kv <> ''
),
-- The rest of the build at run end, one "id:level" list per field. The
-- dim is the field, the key the id; events = sum of levels (or ranks),
-- sessions = runs that had it at all.
build AS (
  SELECT day, site, sid, field, split_part(kv, ':', 1) AS id, TRY_CAST(split_part(kv, ':', 2) AS BIGINT) AS lvl
  FROM (
    SELECT day, site, sid, 'weapon_level' AS field, explode(split(q['wl'], ',')) AS kv FROM human WHERE e = 'run_end' AND q['wl'] IS NOT NULL AND q['wl'] <> ''
    UNION ALL
    SELECT day, site, sid, 'passive' AS field, explode(split(q['pas'], ',')) AS kv FROM human WHERE e = 'run_end' AND q['pas'] IS NOT NULL AND q['pas'] <> ''
    UNION ALL
    SELECT day, site, sid, 'taika' AS field, explode(split(q['tai'], ',')) AS kv FROM human WHERE e = 'run_end' AND q['tai'] IS NOT NULL AND q['tai'] <> ''
    UNION ALL
    SELECT day, site, sid, 'altar' AS field, explode(split(q['alt'], ',')) AS kv FROM human WHERE e = 'run_end' AND q['alt'] IS NOT NULL AND q['alt'] <> ''
  )
  WHERE kv <> ''
),
-- The derived multipliers, bucketed, so the board shows how strong the
-- builds that end are: might rounded to a tenth, and so on.
mods AS (
  SELECT day, site, sid, split_part(kv, ':', 1) AS id, TRY_CAST(split_part(kv, ':', 2) AS DOUBLE) AS v
  FROM (SELECT day, site, sid, explode(split(q['st'], ',')) AS kv FROM human WHERE e = 'run_end' AND q['st'] IS NOT NULL AND q['st'] <> '')
  WHERE kv <> ''
),
other AS (
  SELECT day, site, field AS dim, id AS key, sid, COALESCE(lvl, 1) AS w FROM build
  UNION ALL
  SELECT day, site, concat('mod_', id) AS dim, CAST(ROUND(v, 1) AS STRING) AS key, sid, 1 AS w FROM mods WHERE v IS NOT NULL AND id IN ('might', 'area', 'cd', 'amt', 'curse')
  UNION ALL
  SELECT day, site, 'weapon_damage' AS dim, weapon AS key, sid, dmg AS w FROM weapons WHERE dmg IS NOT NULL
  UNION ALL
  SELECT day, site, 'weapon_runs' AS dim, weapon AS key, sid, 1 AS w FROM weapons
  UNION ALL
  -- How a run ended. Before 2026-10-01 only deaths sent run_end.
  SELECT day, site, 'run_how' AS dim, COALESCE(NULLIF(q['how'], ''), 'death') AS key, sid, 1 AS w FROM human WHERE e = 'run_end'
  UNION ALL
  -- Chests by size from the run_end summary "1:2,3:1". Until 2026-10-01
  -- each chest was its own beacon; those rows still come from `tagged`.
  SELECT day, site, 'chest' AS dim, split_part(kv, ':', 1) AS key, sid, COALESCE(TRY_CAST(split_part(kv, ':', 2) AS BIGINT), 0) AS w
  FROM (SELECT day, site, sid, explode(split(q['ch'], ',')) AS kv FROM human WHERE e = 'run_end' AND q['ch'] IS NOT NULL AND q['ch'] <> '')
  WHERE kv <> ''
  UNION ALL
  SELECT day, site, 'top_weapon' AS dim, q['top'] AS key, sid, 1 AS w FROM human WHERE e = 'run_end' AND q['top'] IS NOT NULL AND q['top'] <> ''
  UNION ALL
  SELECT day, site, 'path' AS dim, path AS key, sid, 1 AS w
  FROM human WHERE e = 'session_start' AND path IS NOT NULL AND path <> ''
  UNION ALL
  -- Where the visit came from, one row per session_start, so the dim sums to
  -- the day's sessions.
  --
  -- `direct` is everything that is not a source of visitors: no referrer at
  -- all (a typed URL, a bookmark, an app launch), the literal "null" that a
  -- referrer policy leaves behind, our own pages, and the sign-in hops a
  -- visit walks back in from. Dropping those rows, which is what this did,
  -- leaves a board reading "no referrer data" on a site where most people
  -- arrive directly.
  SELECT day, site, 'referrer' AS dim,
         CASE
           WHEN ref_host IS NULL OR ref_host = '' THEN 'direct'
           WHEN ref_host IN (own_host, concat('www.', own_host)) THEN 'direct'
           WHEN ref_host = 'accounts.google.com' THEN 'direct'
           WHEN ref_host LIKE '%.amazoncognito.com' THEN 'direct'
           ELSE ref_host
         END AS key,
         sid, 1 AS w
  FROM (
    SELECT day, site, sid,
           parse_url(q['ref'], 'HOST') AS ref_host,
           'vesahyp.github.io' AS own_host
    FROM human WHERE e = 'session_start'
  ) AS refs
  UNION ALL
  -- The three-letter airport code, not the individual edge server.
  SELECT day, site, 'edge' AS dim, substr(edge, 1, 3) AS key, sid, 1 AS w
  FROM human WHERE edge IS NOT NULL AND edge <> '-'
  UNION ALL
  SELECT day, site, 'hour' AS dim, CAST(hour AS STRING) AS key, sid, 1 AS w
  FROM human WHERE hour IS NOT NULL
)
SELECT day, site, dim, key, SUM(w) AS events, COUNT(DISTINCT sid) AS sessions
FROM (
  SELECT day, site, dim, key, sid, 1 AS w FROM tagged WHERE dim IS NOT NULL
  UNION ALL SELECT day, site, dim, key, sid, w FROM other
)
WHERE key IS NOT NULL AND key <> ''
GROUP BY day, site, dim, key
