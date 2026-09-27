// The icon is the game's own mosquito, drawn by src/render/sprites.ts on the
// forest ground, rendered through the dev server (needs `make dev` on 5173
// or the port below). `make icon` runs this.
import { chromium } from 'playwright';
const port = process.argv[2] ?? '5173';
const b = await chromium.launch(); const p = await b.newPage();
await p.setViewportSize({ width: 512, height: 512 });
await p.goto(`http://localhost:${port}/`);
await p.evaluate(async () => {
  const m = await import('/src/render/sprites.ts');
  m.setSpriteResolution(24);
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 512; cv.id = 'icon';
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(256, 200, 40, 256, 256, 340); g.addColorStop(0, '#2f6a3a'); g.addColorStop(1, '#11301a');
  c.fillStyle = g; c.fillRect(0, 0, 512, 512);
  const put = (key, x, y, s) => { const sp = m.sprite(key); c.drawImage(sp.img, x - sp.ox * s, y - sp.oy * s, sp.w * s, sp.h * s); };
  put('tuft', 90, 420, 5); put('tuft', 420, 120, 4); put('gem1', 110, 130, 5); put('gem2', 400, 400, 5); put('mushroom', 90, 250, 5); put('bush', 430, 300, 4);
  put('mosquito', 256, 256, 22);
  document.body.innerHTML = ''; document.body.style.margin = '0'; document.body.appendChild(cv);
});
const el = p.locator('#icon');
await el.screenshot({ path: 'public/icon-512.png' });
await p.evaluate(() => { const cv = document.getElementById('icon'); cv.style.width = '180px'; cv.style.height = '180px'; });
await el.screenshot({ path: 'public/apple-touch-icon.png' });
await b.close();
console.log('icon rendered');
