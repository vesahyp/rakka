# Räkkä: dev, checks, screenshots. The game deploys from GitHub Actions on
# every push to main; there is nothing to deploy from here.
#
#   make dev        # vite dev server, reachable on the LAN for a phone
#   make check      # typecheck + build + sim-check, what CI needs green
#   make balance    # bot runs, one line per run (MIN=20 RUNS=2 CHAR=; CHAR=vaino+aino is co-op)
#   make setup      # after a fresh clone: packages, Playwright, infra init, .env.local
#   make shots      # phone screenshots into shots/ (runs shots-setup when Playwright is missing)
#   make shots-en   # the same in English, into shots/en/
#   make pause-check  # the pause screen with a long build: touch scroll, buttons reachable
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

.PHONY: setup store portal portal-check dev build check sim-check balance shots shots-en pause-check shots-setup preview plan apply outputs deploy-pixel analytics

# What a fresh clone needs before the other targets and the nightly
# analytics job work. Safe to rerun: each step runs only when its marker
# is missing. Playwright is not in package.json (shots-setup adds it with
# --no-save), so every target that drives a browser runs shots-setup first
# when node_modules/playwright is missing. .env.local comes from make env:
# the game deploy reads the same values from GitHub, but a local build
# without it has no beacon.
setup: ## after a fresh clone: npm packages, Playwright, infra init, .env.local
	@for t in node npm mise aws terraform docker clavesa; do \
	  command -v $$t >/dev/null || { echo "missing $$t: brew bundle --file ~/Repositories/personal-backup/Brewfile"; exit 1; }; \
	done
	mise install --quiet
	@test -d node_modules || npm ci --no-fund --no-audit
	@$(MAKE) -s node_modules/playwright
	@$(MAKE) -s infra/.terraform
	@test -f .env.local || $(MAKE) -s env

node_modules/playwright:
	$(MAKE) shots-setup

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

shots: | node_modules/playwright
	node scripts/shots.mjs

shots-en: | node_modules/playwright
	node scripts/shots.mjs en

pause-check: | node_modules/playwright
	node scripts/pause-check.mjs

plan:
	$(TF) init -input=false
	$(TF) plan -out=tfplan

apply:
	$(TF) apply tfplan
	$(MAKE) env

# .terraform/ is not in git, so a fresh clone has none and a target
# that reads an output fails with "Backend initialization required".
# Order-only: init runs when the directory is missing, never after.
infra/.terraform:
	$(TF) init -input=false >/dev/null

outputs: | infra/.terraform
	$(TF) output

# The back end for builds on this machine, written from the Terraform
# outputs. Gitignored (*.local): a clone without it builds a game with no
# global records and no beacon, which is what a fork should get. The Pages
# deploy reads the same values from GitHub repository variables.
env: | infra/.terraform
	@{ for o in records_api board_url pixel_url stats_url; do \
	     printf 'VITE_%s=%s\n' "$$(echo $$o | tr a-z A-Z)" "$$($(TF) output -raw $$o)"; done; } > .env.local
	@cat .env.local

.env.local:
	@echo "no .env.local: run 'make env' (needs the AWS profile), or build without a back end on purpose with 'touch .env.local'"; exit 1

deploy-pixel: | infra/.terraform
	$(AWS) s3 cp public/t.gif s3://$$($(TF) output -raw bucket_name)/t.gif --content-type image/gif --cache-control "no-store"

analytics:
	analytics/run-analytics.sh && tail -3 analytics/logs/analytics.log

icon: | node_modules/playwright
	node scripts/icon.mjs

# One zip for both portals, index.html at its root. See docs/portals.md.
portal: .env.local
	npx vite build --mode portal --outDir dist-portal --emptyOutDir
	rm -f rakka-web.zip && cd dist-portal && zip -qr ../rakka-web.zip . -x og.png
	@ls -lh rakka-web.zip | awk '{print $$5, $$9}'

portal-check: | node_modules/playwright
	node scripts/portal-check.mjs

store: | node_modules/playwright
	node scripts/store-shots.mjs
