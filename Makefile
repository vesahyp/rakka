# Räkkä: dev, checks, screenshots. The game deploys from GitHub Actions on
# every push to main; there is nothing to deploy from here.
#
#   make dev        # vite dev server, reachable on the LAN for a phone
#   make check      # typecheck + build + sim-check, what CI needs green
#   make balance    # bot runs, one line per run (MIN=20 RUNS=2 CHAR=)
#   make shots      # phone screenshots into shots/ (needs make shots-setup)

.PHONY: dev build check sim-check balance shots shots-setup preview

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
