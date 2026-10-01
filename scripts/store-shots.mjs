// The itch.io and Newgrounds page images, in English: phone screenshots of a
// long run, the level-up cards, an evolution chest, co-op, and the 630 x 500
// cover. `make store` runs this into store/. It starts a dev server on 5197.
//
// The runs are the balance bot playing the real game. Its health is topped
// up from outside so it lives long enough to reach the late minutes; the
// build, the enemies and the waves are what the game gives it.
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const port = 5197;
const base = `http://localhost:${port}/?lang=en`;
const server = spawn('npx', ['vite', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
mkdirSync('store', { recursive: true });

const browser = await chromium.launch();
const phone = { ...devices['iPhone 15'], hasTouch: true, locale: 'en-US' };

/** Keep every hero at full health, so the bot sees the late game. */
const immortal = (page) =>
  page.evaluate(() => {
    setInterval(() => {
      for (const h of window.__sim?.heroes ?? []) {
        h.player.hp = h.stats.maxHp;
        h.player.alive = true;
      }
    }, 50);
  });
// Late minutes are slow to render headless, so the bot runs at speed 24 and
// the waits are long.
const fast = `${base}&bot=1&speed=24`;
const until = (page, seconds) => page.waitForFunction((t) => window.__sim && window.__sim.time >= t, seconds, { timeout: 1800000 });
const done = (name) => console.log(`store/${name}.png`);

/** A hero's build from outside, through the game's own applyOffer. */
const give = (page, items) =>
  page.evaluate(async (items) => {
    const up = await import('/src/game/upgrades.ts');
    const s = window.__sim;
    const h = s.heroes[0];
    for (const [kind, id, n] of items) for (let i = 0; i < n; i++) up.applyOffer(s, h, { kind, id, name: '', desc: '', levelText: '', level: 0, maxLevel: 0, isNew: false, icon: '' });
  }, items);

try {
  // Title and hero select.
  {
    const ctx = await browser.newContext(phone);
    const page = await ctx.newPage();
    await page.goto(base);
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'store/01-title.png' });
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'store/02-heroes.png' });
    await ctx.close();
  }

  // One long bot run: the swarm early, the first boss, the late forest.
  {
    const ctx = await browser.newContext(phone);
    const page = await ctx.newPage();
    await page.goto(fast);
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await page.getByRole('button', { name: /Louhi/ }).click();
    await page.waitForFunction(() => window.__sim);
    await immortal(page);
    // The boss shot waits for Otso to be close to the hero, so it is in frame.
    const bossNear = () =>
      page.waitForFunction(() => {
        const s = window.__sim;
        const b = s?.enemies.find((e) => e.boss);
        return b && Math.hypot(b.x - s.cam.x, b.y - s.cam.y) < 110;
      }, null, { timeout: 1800000 });
    for (const [t, name] of [[115, '03-swarm'], [300, '04-boss'], [600, '05-minute-10'], [960, '06-minute-16']]) {
      await until(page, t);
      if (name === '04-boss') await bossNear();
      await page.waitForTimeout(150);
      await page.screenshot({ path: `store/${name}.png` });
      done(name);
    }
    await ctx.close();
  }

  // The level-up cards and an evolution chest, in a run the player drives.
  {
    const ctx = await browser.newContext(phone);
    const page = await ctx.newPage();
    await page.goto(base);
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await page.getByRole('button', { name: /Lemminkäinen/ }).click();
    await page.waitForFunction(() => window.__sim && window.__sim.time > 1);
    await immortal(page);
    await give(page, [['weapon', 'puukko', 7], ['weapon', 'kokko', 3], ['weapon', 'jousi', 2], ['passive', 'tuohikontti', 1], ['passive', 'villasukat', 2], ['power', 'noidansilma', 1]]);
    await page.evaluate(() => {
      const h = window.__sim.heroes[0];
      h.player.level = 14;
      h.pendingLevelUps = 1;
    });
    await page.waitForSelector('.overlay .cards');
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'store/07-level-up.png' });
    await page.locator('.overlay .card').first().click();
    await page.evaluate(() => window.__sim.pendingChests.push(0));
    await page.waitForSelector('.overlay .chest');
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'store/08-evolution.png' });
    await ctx.close();
  }

  // Co-op, a phone on its side.
  {
    const ctx = await browser.newContext({ ...phone, viewport: { width: 852, height: 393 } });
    const page = await ctx.newPage();
    await page.goto(fast);
    await page.getByRole('button', { name: 'Two players', exact: true }).click();
    await page.getByRole('button', { name: /Väinö/ }).click();
    await page.getByRole('button', { name: /Aino/ }).click();
    await page.waitForFunction(() => window.__sim);
    await immortal(page);
    await until(page, 240);
    await page.waitForTimeout(150);
    await page.screenshot({ path: 'store/09-co-op.png' });
    await ctx.close();
  }

  // The cover: the forest at 630 x 500 with the HUD hidden and the name on it.
  {
    const ctx = await browser.newContext({ viewport: { width: 630, height: 500 }, deviceScaleFactor: 2, locale: 'en-US' });
    const page = await ctx.newPage();
    await page.goto(fast);
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await page.getByRole('button', { name: /Ilmarinen/ }).click();
    await page.waitForFunction(() => window.__sim);
    await immortal(page);
    await until(page, 130);
    await page.addStyleTag({
      content: `.hud, .hpbar, .pausebtn, .stick, .banner, .bossbar, .update { display: none !important; }
        .cover { position: fixed; left: 0; right: 0; bottom: 34px; text-align: center; pointer-events: none; }
        .cover h1 { font-size: 84px; }
        .cover p { margin: 6px 0 0; font-size: 18px; font-weight: 700; color: #e8f0e0; text-shadow: 0 2px 8px rgba(0,0,0,0.9); }`,
    });
    await page.evaluate(() => {
      const d = document.createElement('div');
      d.className = 'cover';
      d.innerHTML = '<h1 class="logo">RÄKKÄ</h1><p>Survive the swarms of a Finnish forest</p>';
      document.body.appendChild(d);
    });
    await page.waitForTimeout(150);
    await page.screenshot({ path: 'store/cover.png' });
    await ctx.close();
  }
} finally {
  await browser.close();
  server.kill();
}
console.log('store images in store/');
