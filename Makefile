# Räkkä: dev, checks, screenshots. The game deploys from GitHub Actions on
# every push to main; there is nothing to deploy from here.
#
#   make dev        # vite dev server, reachable on the LAN for a phone
#   make check      # typecheck + build + sim-check, what CI needs green
#   make balance    # bot runs, one line per run (MIN=20 RUNS=2 CHAR=)
#   make shots      # phone screenshots into shots/ (needs make shots-setup)
#   make plan/apply # Terraform for the analytics pixel host (infra/)
#   make deploy-pixel  # upload t.gif with no-store to the pixel bucket
#
# AWS profile: personal by default; PROFILE=name overrides.

PROFILE ?= personal
AWS      = AWS_PROFILE=$(PROFILE) aws
TF       = AWS_PROFILE=$(PROFILE) terraform -chdir=infra

.PHONY: dev build check sim-check balance shots shots-setup preview plan apply outputs deploy-pixel

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

plan:
	$(TF) init -input=false
	$(TF) plan -out=tfplan

apply:
	$(TF) apply tfplan
	@echo
	@echo "Pixel endpoint (bake into index.html's TRACKER_CONFIG):"
	@$(TF) output -raw pixel_url; echo

outputs:
	$(TF) output

deploy-pixel:
	$(AWS) s3 cp public/t.gif s3://$$($(TF) output -raw bucket_name)/t.gif --content-type image/gif --cache-control "no-store"
