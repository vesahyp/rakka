// The icon is the white mosquito drawn by hand in public/icon.svg. This
// renders it to the PNGs the home screen and the title screen need.
// `make icon` runs this; no dev server needed.
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
const svg = await readFile('public/icon.svg', 'utf8');
const b = await chromium.launch();
const p = await b.newPage();
for (const [size, path] of [[512, 'public/icon-512.png'], [180, 'public/apple-touch-icon.png']]) {
  await p.setViewportSize({ width: size, height: size });
  await p.setContent(`<body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`);
  await p.locator('svg').screenshot({ path, omitBackground: true });
}
await b.close();
console.log('icon rendered');
