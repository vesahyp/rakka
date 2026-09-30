// The portal build inside an iframe on another origin, the way itch.io and
// Newgrounds show it: the game loads, a run starts, and the leaderboard
// answers across origins. Run `make portal` first; `make portal-check` runs
// this. The game is served on 5199 (an origin the records API allows) and
// the host page on 5200.
import { chromium, devices } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.gif': 'image/gif', '.webmanifest': 'application/manifest+json' };

const game = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  const file = path.endsWith('/') ? path + 'index.html' : path;
  try {
    const body = await readFile(join('dist-portal', file));
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
}).listen(5199);
const host = createServer((_, res) => {
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end('<!doctype html><body style="margin:0;background:#222"><iframe src="http://localhost:5199/" style="width:390px;height:780px;border:0" allow="autoplay; fullscreen"></iframe></body>');
}).listen(5200);

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 15'], hasTouch: true, locale: 'en-US' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
let failed = false;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) failed = true;
};

try {
  await page.goto('http://localhost:5200/');
  const frame = page.frameLocator('iframe');
  await frame.getByRole('button', { name: 'Play', exact: true }).click();
  await frame.getByRole('button', { name: /Väinö/ }).click();
  await page.waitForTimeout(4000);
  check('a run starts in the iframe', (await frame.locator('.hud').count()) === 1);
  await page.goto('http://localhost:5200/');
  await frame.getByRole('button', { name: 'Leaderboard' }).click();
  await frame.locator('table.records, p.small').first().waitFor();
  await page.waitForTimeout(2500);
  const failedLoad = await frame.getByText('The leaderboard did not load.').count();
  check('the leaderboard loads across origins', failedLoad === 0);
  check('no errors in the console', errors.length === 0, errors.join(' | '));
} finally {
  await browser.close();
  game.close();
  host.close();
}
process.exit(failed ? 1 : 0);
