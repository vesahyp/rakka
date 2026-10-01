#!/usr/bin/env python3
"""Count the scores saved before the histograms existed (no `h` attribute)
into the histogram items, then mark them, so running it twice counts
nothing twice. One-off for 2026-10-01; safe to rerun.

  AWS_PROFILE=personal python3 scripts/backfill-hist.py
"""
import json, subprocess, collections

TABLE = "rakka-scores"
REGION = "eu-north-1"


def aws(*args):
    out = subprocess.run(["aws", "dynamodb", *args, "--region", REGION, "--output", "json"], check=True, capture_output=True, text=True).stdout
    return json.loads(out) if out.strip() else {}


items, start = [], None
while True:
    args = ["scan", "--table-name", TABLE, "--filter-expression", "attribute_exists(#t) AND attribute_not_exists(h)",
            "--expression-attribute-names", '{"#t":"time"}']
    if start:
        args += ["--starting-token", start]
    page = aws(*args)
    items += page.get("Items", [])
    start = page.get("NextToken")
    if not start:
        break

counts = collections.Counter()
for it in items:
    t = int(float(it["time"]["N"]))
    for period in ("day", "week", "month", "all"):
        counts[(f"hist#{period}#{it[period]['S']}", f"s{t}")] += 1

for (hid, sec), n in counts.items():
    aws("update-item", "--table-name", TABLE, "--key", json.dumps({"id": {"S": hid}}),
        "--update-expression", "ADD #s :n", "--expression-attribute-names", json.dumps({"#s": sec}),
        "--expression-attribute-values", json.dumps({":n": {"N": str(n)}}))
for it in items:
    aws("update-item", "--table-name", TABLE, "--key", json.dumps({"id": it["id"]}), "--update-expression", "SET h = :one",
        "--expression-attribute-values", '{":one":{"N":"1"}}')
print(f"{len(items)} scores counted into {len({h for h, _ in counts})} histograms")
