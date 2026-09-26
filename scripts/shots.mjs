// Phone screenshots of the game, repeatable: title, select, a run at three
// points, the level-up overlay. Run `make shots-setup` once, then `make shots`.
// Needs the dev server: it starts one on port 5198.
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const port = 5198;
const server = spawn('npx', ['vite', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
mkdirSync('shots', { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 15'], hasTouch: true });
const page = await ctx.newPage();
const shot = (name) => page.screenshot({ path: `shots/${name}.png` });

try {
  await page.goto(`http://localhost:${port}/?bot=1&speed=8`);
  await shot('01-title');
  await page.getByRole('button', { name: 'Pelaa' }).click();
  await page.waitForTimeout(300);
  await shot('02-select');
  await page.getByRole('button', { name: /Lemminkäinen/ }).click();
  const at = async (minute, name) => {
    await page.waitForFunction((m) => window.__sim && window.__sim.time >= m * 60, minute, { timeout: 120000 });
    await page.waitForTimeout(200);
    await shot(name);
  };
  await at(0.25, '03-run-start');
  await at(4, '04-run-minute-4');
  await at(10, '05-run-minute-10');
  await at(16, '06-run-minute-16');
  const perf = await page.evaluate(() => window.__perf);
  console.log(`frames ${perf.frames}, avg ${(perf.ms / perf.frames).toFixed(2)} ms, worst ${perf.worst.toFixed(1)} ms (sim+render, headless)`);
} finally {
  await browser.close();
  server.kill();
}
