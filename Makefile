# Räkkä: dev, checks, screenshots. The game deploys from GitHub Actions on
# every push to main; there is nothing to deploy from here.
#
#   make dev        # vite dev server, reachable on the LAN for a phone
#   make check      # typecheck + build + sim-check, what CI needs green
#   make balance    # bot runs, one line per run (MIN=20 RUNS=2 CHAR=; CHAR=vaino+aino is co-op)
#   make shots      # phone screenshots into shots/ (needs make shots-setup)
#   make shots-en   # the same in English, into shots/en/
#   make icon       # render public/icon.svg to the PNG icons
#   make plan/apply # Terraform for the analytics pixel host (infra/)
#   make deploy-pixel  # upload t.gif with no-store to the pixel bucket
#   make analytics  # run the traffic rollup now (the 08:30 cron does it nightly)
#   make portal     # the itch.io / Newgrounds build: dist-portal/ and rakka-web.zip
#   make portal-check  # that build in a cross-origin iframe: runs, leaderboard, no errors
#   make store      # English page images for the portals into store/: screenshots, 630x500 cover
#
# AWS profile: personal by default; PROFILE=name overrides.

PROFILE ?= personal
AWS      = AWS_PROFILE=$(PROFILE) aws
TF       = AWS_PROFILE=$(PROFILE) terraform -chdir=infra

.PHONY: store portal portal-check dev build check sim-check balance shots shots-en shots-setup preview plan apply outputs deploy-pixel analytics

dev:
	npm run dev

build:
	npm run build

preview: build
	npm run preview

check:
	npm run typecheck
	npm run build
	npm run sim-check

MIN ?= 20
RUNS ?= 2
CHAR ?=
balance:
	npm run balance -- $(MIN) $(RUNS) $(CHAR)

shots-setup:
	npm install --no-save playwright && npx playwright install chromium

shots:
	node scripts/shots.mjs

shots-en:
	node scripts/shots.mjs en

plan:
	$(TF) init -input=false
	$(TF) plan -out=tfplan

apply:
	$(TF) apply tfplan
	$(MAKE) env

outputs:
	$(TF) output

# The back end for builds on this machine, written from the Terraform
# outputs. Gitignored (*.local): a clone without it builds a game with no
# global records and no beacon, which is what a fork should get. The Pages
# deploy reads the same values from GitHub repository variables.
env:
	@{ for o in records_api board_url pixel_url stats_url; do \
	     printf 'VITE_%s=%s\n' "$$(echo $$o | tr a-z A-Z)" "$$($(TF) output -raw $$o)"; done; } > .env.local
	@cat .env.local

.env.local:
	@echo "no .env.local: run 'make env' (needs the AWS profile), or build without a back end on purpose with 'touch .env.local'"; exit 1

deploy-pixel:
	$(AWS) s3 cp public/t.gif s3://$$($(TF) output -raw bucket_name)/t.gif --content-type image/gif --cache-control "no-store"

analytics:
	analytics/run-analytics.sh && tail -3 analytics/logs/analytics.log

icon:
	node scripts/icon.mjs

# One zip for both portals, index.html at its root. See docs/portals.md.
portal: .env.local
	npx vite build --mode portal --outDir dist-portal --emptyOutDir
	rm -f rakka-web.zip && cd dist-portal && zip -qr ../rakka-web.zip . -x og.png
	@ls -lh rakka-web.zip | awk '{print $$5, $$9}'

portal-check:
	node scripts/portal-check.mjs

store:
	node scripts/store-shots.mjs
