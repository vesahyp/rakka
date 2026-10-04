// The pause screen with a long build, on a phone in portrait and landscape.
// Touch scrolling (a real touch gesture through CDP, not the mouse wheel) must
// move the list, and Continue, Restart and Quit must stay on screen. Run
// `make pause-check` (needs `make shots-setup` once). Exits 1 on a failure.
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const port = 5199;
const server = spawn('npx', ['vite', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
mkdirSync('shots/pause', { recursive: true });
const browser = await chromium.launch();
let failed = 0;
const fail = (m) => { failed++; console.log('FAIL', m); };

try {
  for (const [name, size] of [['portrait', { width: 393, height: 659 }], ['landscape', { width: 659, height: 393 }]]) {
    const ctx = await browser.newContext({ ...devices['iPhone 15'], viewport: size, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto(`http://localhost:${port}/?lang=en`);
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await page.getByRole('button', { name: /Lemminkäinen/ }).click();
    await page.waitForFunction(() => window.__sim);
    // A level 29 build: every taika and every weapon.
    await page.evaluate(async () => {
      const { POWERS } = await import('/src/game/content/powers.ts');
      const { WEAPONS } = await import('/src/game/content/weapons.ts');
      const h = window.__sim.heroes[0];
      h.powers = Object.keys(POWERS).map((id) => ({ id, level: 1 }));
      h.weapons = Object.keys(WEAPONS).slice(0, 6).map((id) => ({ id, level: 3, cooldown: 1, burst: 0, burstTimer: 0, side: 1, active: 0 }));
    });
    await page.locator('.pausebtn').first().click();
    await page.waitForSelector('.overlay h2');
    await page.waitForTimeout(400);
    const ov = page.locator('.overlay');
    const info = () => ov.evaluate((el) => ({ top: el.scrollTop, max: el.scrollHeight - el.clientHeight }));
    const buttonsVisible = () => page.evaluate(() => {
      const h = window.innerHeight;
      return [...document.querySelectorAll('.overlay .row .btn')].map((b) => { const r = b.getBoundingClientRect(); return { t: b.textContent, ok: r.top >= 0 && r.bottom <= h }; });
    });
    const before = await info();
    if (before.max < 50) fail(`${name}: list is not long enough to test (${before.max}px)`);
    await page.screenshot({ path: `shots/pause/${name}-top.png` });
    let bv = await buttonsVisible();
    if (bv.some((b) => !b.ok)) fail(`${name}: buttons off screen at top: ${JSON.stringify(bv)}`);
    const cdp = await ctx.newCDPSession(page);
    const swipe = (yDist) => cdp.send('Input.synthesizeScrollGesture', { x: size.width / 2, y: size.height * 0.6, yDistance: yDist, gestureSourceType: 'touch', speed: 800 });
    await swipe(-400);
    await page.waitForTimeout(400);
    const after = await info();
    if (after.top <= before.top + 20) fail(`${name}: touch swipe did not scroll (${before.top} -> ${after.top})`);
    await swipe(-6000);
    await page.waitForTimeout(600);
    const end = await info();
    if (end.top < end.max - 2) fail(`${name}: cannot reach the end (${end.top} of ${end.max})`);
    bv = await buttonsVisible();
    if (bv.some((b) => !b.ok)) fail(`${name}: buttons off screen at the end: ${JSON.stringify(bv)}`);
    await page.screenshot({ path: `shots/pause/${name}-end.png` });
    await page.getByRole('button', { name: 'Continue' }).click();
    if (await page.locator('.pausebar').count()) fail(`${name}: Continue did not close the pause screen`);
    console.log(`${name}: scrolled ${before.top} -> ${after.top} -> ${end.top} of ${end.max}`);
    await ctx.close();
  }
} finally {
  await browser.close();
  server.kill();
}
console.log(failed ? `${failed} failure(s)` : 'pause-check ok');
process.exit(failed ? 1 : 0);
