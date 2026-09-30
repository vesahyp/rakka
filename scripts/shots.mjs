// Phone screenshots of the game, repeatable: title, select, a run at three
// points, the level-up overlay. Run `make shots-setup` once, then `make shots`.
// Needs the dev server: it starts one on port 5198. `node scripts/shots.mjs en`
// takes the English set into shots/en/ (make shots-en).
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const port = 5198;
const server = spawn('npx', ['vite', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const lang = process.argv[2] === 'en' ? 'en' : 'fi';
const dir = lang === 'en' ? 'shots/en' : 'shots';
const say = (fi, en) => (lang === 'en' ? en : fi);
mkdirSync(dir, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 15'], hasTouch: true });
const page = await ctx.newPage();
const shot = (name) => page.screenshot({ path: `${dir}/${name}.png` });

try {
  await page.goto(`http://localhost:${port}/?bot=1&speed=8&lang=${lang}`);
  await shot('01-title');
  await page.getByRole('button', { name: say('Pelaa', 'Play'), exact: true }).click();
  await page.waitForTimeout(300);
  await shot('02-select');
  await page.getByRole('button', { name: /Lemminkäinen/ }).click();
  // Returns false once the bot has died; the death screen is the last shot.
  const at = async (minute, name) => {
    await page.waitForFunction((m) => window.__sim && (window.__sim.time >= m * 60 || window.__sim.gameOver), minute, { timeout: 300000 });
    await page.waitForTimeout(200);
    const over = await page.evaluate(() => window.__sim.gameOver);
    if (over) {
      await page.waitForSelector('.screen');
      await page.waitForTimeout(300);
      await shot('09-death');
      return false;
    }
    await shot(name);
    return true;
  };
  for (const [m, name] of [[0.25, '03-run-start'], [4, '04-run-minute-4'], [10, '05-run-minute-10'], [16, '06-run-minute-16'], [24, '07-run-minute-24']]) {
    if (!(await at(m, name))) break;
  }
  // Co-op, landscape: two heroes, two sticks' worth of HUD.
  await page.setViewportSize({ width: 659, height: 393 });
  await page.goto(`http://localhost:${port}/?bot=1&speed=8&lang=${lang}`);
  await page.getByRole('button', { name: say('Kaksin', 'Two players'), exact: true }).click();
  await page.getByRole('button', { name: /Väinö/ }).click();
  await page.getByRole('button', { name: /Aino/ }).click();
  await page.waitForFunction(() => window.__sim && (window.__sim.time >= 180 || window.__sim.gameOver), null, { timeout: 300000 });
  await page.waitForTimeout(200);
  await shot('10-coop');
  const perf = await page.evaluate(() => window.__perf);
  console.log(`frames ${perf.frames}, avg ${(perf.ms / perf.frames).toFixed(2)} ms, worst ${perf.worst.toFixed(1)} ms (sim+render, headless)`);
} finally {
  await browser.close();
  server.kill();
}
