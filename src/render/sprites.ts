/**
 * Procedural sprite cache. Every sprite is drawn once with canvas paths at
 * the render resolution and reused as an image. Nothing here is loaded from
 * a file, so the game has no asset pipeline and no artist to wait for.
 *
 * Coordinates inside a draw function are world units centred on (0,0); the
 * cache scales them by `res` (device pixels per world unit).
 */
export interface Sprite {
  img: HTMLCanvasElement | OffscreenCanvas;
  /** world units */
  w: number;
  h: number;
  /** anchor offset in world units from top-left to the origin */
  ox: number;
  oy: number;
}

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type Draw = (c: Ctx) => void;

interface Def {
  /** half extents in world units */
  hw: number;
  hh: number;
  draw: Draw;
}

const OUT = '#12130f';

function ell(c: Ctx, x: number, y: number, rx: number, ry: number, fill: string, stroke = OUT, lw = 0.8) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.lineWidth = lw;
    c.strokeStyle = stroke;
    c.stroke();
  }
}
function eye(c: Ctx, x: number, y: number, r: number, color = '#ffffff', pupil = '#111') {
  ell(c, x, y, r, r, color, '', 0);
  ell(c, x + r * 0.2, y, r * 0.5, r * 0.5, pupil, '', 0);
}
function wing(c: Ctx, x: number, y: number, rx: number, ry: number, rot: number) {
  c.save();
  c.translate(x, y);
  c.rotate(rot);
  c.beginPath();
  c.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  c.fillStyle = 'rgba(220,235,255,0.55)';
  c.fill();
  c.lineWidth = 0.5;
  c.strokeStyle = 'rgba(40,50,60,0.6)';
  c.stroke();
  c.restore();
}
function legs(c: Ctx, x: number, y: number, n: number, len: number, spread: number, color = OUT) {
  c.strokeStyle = color;
  c.lineWidth = 0.9;
  c.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1) - 0.5;
    for (const side of [-1, 1]) {
      c.beginPath();
      c.moveTo(x, y + t * spread);
      c.lineTo(x + side * len * 0.6, y + t * spread + len * 0.4);
      c.lineTo(x + side * len, y + t * spread + len * 0.9);
      c.stroke();
    }
  }
}
function line(c: Ctx, x1: number, y1: number, x2: number, y2: number, color: string, lw: number) {
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(x2, y2);
  c.strokeStyle = color;
  c.lineWidth = lw;
  c.lineCap = 'round';
  c.stroke();
}
function poly(c: Ctx, pts: number[], fill: string, stroke = OUT, lw = 0.8) {
  c.beginPath();
  c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = lw;
    c.stroke();
  }
}

/** A standing figure: used for gnomes, hiisi, the player. */
function figure(c: Ctx, o: { skin: string; cloth: string; hair: string; accent: string; h: number; hat?: 'point' | 'horns' | 'none'; beard?: boolean }) {
  const h = o.h;
  const w = h * 0.42;
  // body
  poly(c, [-w, h * 0.5, w, h * 0.5, w * 0.8, -h * 0.05, -w * 0.8, -h * 0.05], o.cloth);
  // legs
  line(c, -w * 0.4, h * 0.5, -w * 0.4, h * 0.62, OUT, 1.6);
  line(c, w * 0.4, h * 0.5, w * 0.4, h * 0.62, OUT, 1.6);
  // head
  ell(c, 0, -h * 0.22, w * 0.62, w * 0.62, o.skin);
  // hair
  c.beginPath();
  c.arc(0, -h * 0.24, w * 0.64, Math.PI, Math.PI * 2);
  c.fillStyle = o.hair;
  c.fill();
  if (o.beard) {
    poly(c, [-w * 0.5, -h * 0.14, w * 0.5, -h * 0.14, 0, h * 0.12], o.hair, '', 0);
  }
  eye(c, w * 0.22, -h * 0.24, w * 0.14);
  if (o.hat === 'point') poly(c, [-w * 0.7, -h * 0.36, w * 0.7, -h * 0.36, 0, -h * 0.75], o.accent);
  if (o.hat === 'horns') {
    line(c, -w * 0.4, -h * 0.5, -w * 0.9, -h * 0.75, o.accent, 1.6);
    line(c, w * 0.4, -h * 0.5, w * 0.9, -h * 0.75, o.accent, 1.6);
  }
  // belt
  line(c, -w * 0.8, h * 0.18, w * 0.8, h * 0.18, o.accent, 1.2);
}

const DEFS: Record<string, Def> = {
  mosquito: {
    hw: 9,
    hh: 8,
    draw: (c) => {
      wing(c, -3, -3.5, 5.5, 2.4, -0.6);
      wing(c, 3, -3.5, 5.5, 2.4, 0.6);
      legs(c, 0, 1.5, 2, 4.5, 2, '#2a2a2a');
      ell(c, 0.5, 0, 3.6, 2.4, '#4a4e58', OUT, 1);
      line(c, -1, -1.5, 3, -1.5, '#8a8e98', 0.8);
      ell(c, -3.8, 0.4, 2, 2, '#3a3e48', OUT, 1);
      line(c, -5.2, 0.8, -9.5, 2, OUT, 1);
      eye(c, -4, -0.2, 0.9, '#ff4040', '#300');
    },
  },
  blackfly: {
    hw: 7,
    hh: 6,
    draw: (c) => {
      wing(c, -2, -2.5, 3.5, 1.6, -0.5);
      wing(c, 2, -2.5, 3.5, 1.6, 0.5);
      ell(c, 0, 0, 2.6, 2.2, '#2a2a30');
      ell(c, -2.6, 0, 1.4, 1.4, '#1a1a1e');
      eye(c, -2.8, -0.2, 0.6, '#ff8080', '#300');
    },
  },
  tick: {
    hw: 10,
    hh: 9,
    draw: (c) => {
      legs(c, 0, 0, 4, 4.5, 6, '#3a2a1a');
      ell(c, 0.5, 0, 6.5, 5, '#7a3b1e');
      ell(c, -5, 0, 2.2, 1.8, '#3a1f10');
      ell(c, 1.5, -0.5, 3.6, 2.4, '#9a5230', '', 0);
    },
  },
  horsefly: {
    hw: 11,
    hh: 9,
    draw: (c) => {
      wing(c, -3, -4, 6.5, 2.4, -0.4);
      wing(c, 3, -4, 6.5, 2.4, 0.4);
      ell(c, 0, 0, 6, 3.6, '#5a4a2a');
      line(c, -3, -2, -3, 2, '#c9a440', 1.1);
      line(c, 0, -2.5, 0, 2.5, '#c9a440', 1.1);
      ell(c, -6, 0, 2.6, 2.4, '#3a3020');
      eye(c, -6.2, -0.5, 1.2, '#4be08a', '#0a3');
      legs(c, 0, 2, 3, 3.5, 4, '#2a2a2a');
    },
  },
  moosefly: {
    hw: 9,
    hh: 8,
    draw: (c) => {
      wing(c, -2, -3, 5, 2, -0.5);
      wing(c, 2, -3, 5, 2, 0.5);
      ell(c, 0, 0, 4.4, 3, '#4a3a2a');
      ell(c, -4.2, 0, 1.8, 1.6, '#2a201a');
      legs(c, 0, 1, 3, 3.5, 4, '#2a2a2a');
      eye(c, -4.4, -0.3, 0.8, '#ffd27a', '#530');
    },
  },
  ant: {
    hw: 9,
    hh: 7,
    draw: (c) => {
      legs(c, -1, 0, 3, 4, 5, '#3a1a0a');
      ell(c, 3.5, 0, 3.4, 2.4, '#7a2a10');
      ell(c, -1, 0, 2, 1.7, '#5a1a08');
      ell(c, -5, 0, 2.2, 2, '#5a1a08');
      line(c, -6, -1.5, -8, -4, OUT, 0.7);
      line(c, -5, -1.5, -6, -4.5, OUT, 0.7);
    },
  },
  gnome: {
    hw: 10,
    hh: 14,
    draw: (c) => figure(c, { skin: '#c9a882', cloth: '#5a6b3a', hair: '#8a7a5a', accent: '#8a2a2a', h: 20, hat: 'point', beard: true }),
  },
  gufihtar: {
    hw: 10,
    hh: 13,
    draw: (c) => figure(c, { skin: '#d8c8b8', cloth: '#2a3a5a', hair: '#3a3a3a', accent: '#d84a2a', h: 18, hat: 'point' }),
  },
  troll: {
    hw: 14,
    hh: 16,
    draw: (c) => {
      ell(c, 0, 2, 12, 10, '#5d7a4a');
      ell(c, 0, -6, 8, 7, '#6d8a5a');
      poly(c, [-8, -10, -11, -16, -4, -12], '#6d8a5a');
      poly(c, [8, -10, 11, -16, 4, -12], '#6d8a5a');
      eye(c, -3, -7, 1.8, '#ffe066', '#111');
      eye(c, 3, -7, 1.8, '#ffe066', '#111');
      line(c, -4, -2, 4, -2, OUT, 1.2);
      line(c, -2.5, -2, -2.5, -4.5, '#f0f0e0', 1.4);
      line(c, 2.5, -2, 2.5, -4.5, '#f0f0e0', 1.4);
      ell(c, -9, 8, 3.5, 2.5, '#5d7a4a');
      ell(c, 9, 8, 3.5, 2.5, '#5d7a4a');
    },
  },
  hiisi: {
    hw: 11,
    hh: 15,
    draw: (c) => figure(c, { skin: '#6a6a8a', cloth: '#2a2a3a', hair: '#1a1a2a', accent: '#c8b090', h: 22, hat: 'horns' }),
  },
  wisp: {
    hw: 9,
    hh: 11,
    draw: (c) => {
      const g = c.createRadialGradient(0, 0, 1, 0, 0, 9);
      g.addColorStop(0, 'rgba(180,240,255,0.95)');
      g.addColorStop(1, 'rgba(90,160,255,0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(0, 0, 9, 0, Math.PI * 2);
      c.fill();
      poly(c, [-4, 2, 4, 2, 0, -9], '#c8f4ff', '', 0);
      eye(c, -1.5, -1, 1, '#0a3050', '#0a3050');
      eye(c, 1.5, -1, 1, '#0a3050', '#0a3050');
    },
  },
  wasp: {
    hw: 10,
    hh: 8,
    draw: (c) => {
      wing(c, -2, -4, 6, 2.2, -0.3);
      wing(c, 2, -4, 6, 2.2, 0.3);
      ell(c, 3.5, 0, 4.5, 2.8, '#f0c030');
      line(c, 2, -2.5, 2, 2.5, OUT, 1.4);
      line(c, 5, -2, 5, 2, OUT, 1.4);
      ell(c, -2.5, 0, 2, 2, '#f0c030');
      ell(c, -5.5, 0, 2, 1.8, '#2a2a2a');
      line(c, 8, 0, 10, 0, OUT, 1);
      legs(c, 0, 1, 2, 3, 3, '#2a2a2a');
    },
  },
  viper: {
    hw: 12,
    hh: 8,
    draw: (c) => {
      c.beginPath();
      c.moveTo(-11, 3);
      c.bezierCurveTo(-6, -6, -2, 8, 3, 0);
      c.bezierCurveTo(6, -4, 9, 0, 11, -1);
      c.strokeStyle = OUT;
      c.lineWidth = 5.2;
      c.stroke();
      c.strokeStyle = '#6a6a5a';
      c.lineWidth = 4;
      c.stroke();
      c.setLineDash([2, 2.5]);
      c.strokeStyle = '#2a2a2a';
      c.lineWidth = 1.8;
      c.stroke();
      c.setLineDash([]);
      ell(c, -11, 3, 2.8, 2.2, '#6a6a5a');
      eye(c, -12, 2.5, 0.8, '#ff9040', '#300');
    },
  },
  ravga: {
    hw: 12,
    hh: 14,
    draw: (c) => {
      ell(c, 0, 4, 10, 8, '#2f6f7a');
      ell(c, 0, -5, 7, 6.5, '#3f8a96');
      for (let i = -2; i <= 2; i++) line(c, i * 3, 10, i * 3.4, 14, '#2f6f7a', 2);
      eye(c, -2.5, -6, 1.8, '#dfffff', '#0a3a4a');
      eye(c, 2.5, -6, 1.8, '#dfffff', '#0a3a4a');
      line(c, -6, -11, -3, -8, '#1f4a52', 1.5);
      line(c, 6, -11, 3, -8, '#1f4a52', 1.5);
    },
  },
  bear: {
    hw: 26,
    hh: 22,
    draw: (c) => {
      ell(c, 2, 4, 22, 15, '#5a3a22');
      ell(c, -16, -4, 10, 9, '#6a4a2e');
      ell(c, -22, -10, 3.5, 3.5, '#6a4a2e');
      ell(c, -11, -11, 3.5, 3.5, '#6a4a2e');
      ell(c, -23, -1, 4, 3, '#3a2210');
      eye(c, -17, -6, 1.6, '#ffe0a0', '#111');
      eye(c, -12, -6, 1.6, '#ffe0a0', '#111');
      for (const x of [-8, 0, 10, 18]) ell(c, x, 17, 4, 3, '#4a2e1a');
      for (const x of [-8, 0, 10, 18]) for (let k = -1; k <= 1; k++) line(c, x + k * 2.2, 18.5, x + k * 2.2, 20.5, '#e8e0d0', 0.9);
    },
  },
  nakki: {
    hw: 18,
    hh: 22,
    draw: (c) => {
      ell(c, 0, 10, 16, 8, 'rgba(60,130,150,0.6)', '', 0);
      poly(c, [-12, 12, 12, 12, 9, -8, -9, -8], '#2a5a6a');
      ell(c, 0, -12, 9, 9, '#3a7a8a');
      for (let i = 0; i < 7; i++) {
        const x = -9 + i * 3;
        line(c, x, -18, x + (i % 2 ? 2 : -2), -26 - (i % 3) * 2, '#1e4652', 1.6);
      }
      eye(c, -3.5, -13, 2.2, '#e0ffff', '#0a2a3a');
      eye(c, 3.5, -13, 2.2, '#e0ffff', '#0a2a3a');
      poly(c, [-4, -6, 4, -6, 0, -3], '#0a2a3a', '', 0);
    },
  },
  ajattara: {
    hw: 18,
    hh: 24,
    draw: (c) => {
      poly(c, [-14, 18, 14, 18, 8, -8, -8, -8], '#3a1f3a');
      ell(c, 0, -13, 8, 9, '#c8a8b8');
      c.beginPath();
      c.arc(0, -14, 9, Math.PI, Math.PI * 2);
      c.fillStyle = '#1a0a1a';
      c.fill();
      for (let i = -3; i <= 3; i++) line(c, i * 3, -14, i * 4, 6, '#1a0a1a', 1.6);
      eye(c, -3, -13, 1.8, '#ff6a6a', '#300');
      eye(c, 3, -13, 1.8, '#ff6a6a', '#300');
      line(c, -14, 0, -22, -14, '#3a1f3a', 3);
      line(c, 14, 0, 22, -14, '#3a1f3a', 3);
    },
  },
  stallu: {
    hw: 22,
    hh: 26,
    draw: (c) => {
      poly(c, [-18, 22, 18, 22, 14, -6, -14, -6], '#4a3a3a');
      ell(c, 0, -12, 11, 11, '#a08878');
      c.beginPath();
      c.arc(0, -14, 12, Math.PI, Math.PI * 2);
      c.fillStyle = '#e8e8e8';
      c.fill();
      poly(c, [-9, -6, 9, -6, 0, 6], '#e8e8e8', '', 0);
      eye(c, -4, -13, 2, '#fff', '#111');
      eye(c, 4, -13, 2, '#fff', '#111');
      line(c, -18, 0, -26, 18, '#4a3a3a', 5);
      line(c, 18, 0, 26, 18, '#4a3a3a', 5);
      line(c, 26, 18, 26, -8, '#8a6a3a', 3);
    },
  },
  turso: {
    hw: 28,
    hh: 28,
    draw: (c) => {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        c.beginPath();
        c.moveTo(Math.cos(a) * 10, Math.sin(a) * 10);
        c.quadraticCurveTo(Math.cos(a + 0.5) * 22, Math.sin(a + 0.5) * 22, Math.cos(a + 0.2) * 28, Math.sin(a + 0.2) * 28);
        c.strokeStyle = OUT;
        c.lineWidth = 6;
        c.stroke();
        c.strokeStyle = '#2a4a5a';
        c.lineWidth = 4.5;
        c.stroke();
      }
      ell(c, 0, 0, 14, 14, '#3a6a7a');
      eye(c, -5, -3, 3, '#ffe066', '#111');
      eye(c, 5, -3, 3, '#ffe066', '#111');
      poly(c, [-6, 6, 6, 6, 0, 10], '#0a2a3a', '', 0);
    },
  },
  tuoni: {
    hw: 18,
    hh: 26,
    draw: (c) => {
      poly(c, [-14, 22, 14, 22, 10, -10, 0, -16, -10, -10], '#141018', '#000', 1);
      c.beginPath();
      c.arc(0, -14, 8, Math.PI, Math.PI * 2);
      c.fillStyle = '#141018';
      c.fill();
      ell(c, 0, -11, 5, 4, '#0a080c', '', 0);
      eye(c, -2.5, -12, 1.2, '#b0f0ff', '#b0f0ff');
      eye(c, 2.5, -12, 1.2, '#b0f0ff', '#b0f0ff');
      line(c, 12, 20, 16, -24, '#5a4a3a', 2.2);
      c.beginPath();
      c.moveTo(16, -24);
      c.quadraticCurveTo(4, -34, -10, -26);
      c.quadraticCurveTo(2, -26, 16, -20);
      c.closePath();
      c.fillStyle = '#c8d0d8';
      c.fill();
      c.strokeStyle = OUT;
      c.lineWidth = 0.8;
      c.stroke();
    },
  },
  // pickups and gems
  gem1: { hw: 5, hh: 5, draw: (c) => { ell(c, 0, 0, 3.4, 3.4, '#3a5ad8'); ell(c, -1, -1, 1, 1, '#c8d8ff', '', 0); } },
  gem2: { hw: 5, hh: 5, draw: (c) => { ell(c, 0, 0, 3.6, 3.6, '#d83a4a'); ell(c, -1, -1, 1, 1, '#ffd0d0', '', 0); } },
  gem3: { hw: 6, hh: 6, draw: (c) => { ell(c, 0, 0, 4.2, 4.2, '#f0a030'); ell(c, -1.2, -1.2, 1.2, 1.2, '#fff0c0', '', 0); } },
  kanttarelli: {
    hw: 9,
    hh: 9,
    draw: (c) => {
      poly(c, [-2.5, 6, 2.5, 6, 3, -1, -3, -1], '#e0a020');
      poly(c, [-8, -1, 8, -1, 4, -7, -4, -7], '#f0b830');
    },
  },
  lakka: {
    hw: 8,
    hh: 8,
    draw: (c) => {
      for (const [x, y] of [[-3, -2], [3, -2], [0, 2], [0, -4], [-3, 2], [3, 2]]) ell(c, x, y, 2.6, 2.6, '#f0a030', OUT, 0.6);
      line(c, 0, -6, 0, -9, '#4a7a30', 1.4);
    },
  },
  kekale: {
    hw: 8,
    hh: 8,
    draw: (c) => {
      ell(c, 0, 1, 6, 4, '#2a1a10');
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 7);
      g.addColorStop(0, 'rgba(255,200,80,0.9)');
      g.addColorStop(1, 'rgba(255,100,20,0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(0, 0, 7, 0, Math.PI * 2);
      c.fill();
    },
  },
  kapy: {
    hw: 7,
    hh: 9,
    draw: (c) => {
      ell(c, 0, 1, 4.5, 6.5, '#7a4a22');
      for (let r = -4; r <= 4; r += 2.2) {
        for (let k = -1; k <= 1; k++) {
          ell(c, k * 2.4, r, 1.5, 1.1, '#a0683a', '#4a2a10', 0.5);
        }
      }
      line(c, 0, -6, 0, -8.5, '#4a7a30', 1.2);
    },
  },
  arkku: {
    hw: 12,
    hh: 10,
    draw: (c) => {
      poly(c, [-10, 8, 10, 8, 10, -2, -10, -2], '#6a4020');
      poly(c, [-10, -2, 10, -2, 8, -7, -8, -7], '#8a5a30');
      line(c, -10, 2, 10, 2, '#c9a040', 1.4);
      ell(c, 0, 1, 2, 2.4, '#e8c060');
    },
  },
  // decorations
  stump: {
    hw: 12,
    hh: 10,
    draw: (c) => {
      poly(c, [-8, 6, 8, 6, 8, -2, -8, -2], '#4a3320');
      ell(c, 0, -2, 8, 4, '#a08050');
      ell(c, 0, -2, 5, 2.5, '#8a6a40', '', 0);
      ell(c, 0, -2, 2, 1, '#6a4a30', '', 0);
    },
  },
  stone: {
    hw: 10,
    hh: 7,
    draw: (c) => {
      poly(c, [-8, 4, 8, 4, 6, -3, 0, -5, -6, -2], '#6a6e6a');
      poly(c, [-3, -3, 4, -4, 5, -1], '#8a8e8a', '', 0);
    },
  },
  bush: {
    hw: 12,
    hh: 9,
    draw: (c) => {
      ell(c, -4, 2, 6, 4, '#2f5a30', '#1a3a1a', 0.6);
      ell(c, 4, 1, 6, 4.5, '#356535', '#1a3a1a', 0.6);
      for (const [x, y] of [[-6, 0], [-1, -1], [4, -2], [7, 2]]) ell(c, x, y, 1.3, 1.3, '#d83a4a', '', 0);
    },
  },
  log: {
    hw: 18,
    hh: 6,
    draw: (c) => {
      poly(c, [-16, 4, 16, 4, 16, -3, -16, -3], '#5a4028');
      ell(c, 16, 0.5, 2, 3.5, '#a08050');
      line(c, -12, 0, 10, 0.5, '#4a3020', 0.8);
    },
  },
  tuft: {
    hw: 7,
    hh: 7,
    draw: (c) => {
      for (let i = -2; i <= 2; i++) line(c, i * 1.6, 4, i * 2.4, -4 - Math.abs(i), '#4f7a3a', 1.2);
    },
  },
  mushroom: {
    hw: 6,
    hh: 7,
    draw: (c) => {
      poly(c, [-1.5, 5, 1.5, 5, 1.5, 0, -1.5, 0], '#e8e0d0', OUT, 0.6);
      ell(c, 0, -1, 5, 3, '#c83030', OUT, 0.6);
      ell(c, -2, -2, 0.8, 0.8, '#fff', '', 0);
      ell(c, 2, -1, 0.7, 0.7, '#fff', '', 0);
    },
  },
};

export function characterSprite(key: string, colors: { skin: string; cloth: string; hair: string; accent: string }): void {
  if (DEFS[key]) return;
  DEFS[key] = { hw: 10, hh: 14, draw: (c) => figure(c, { ...colors, h: 22 }) };
}

const cache = new Map<string, Sprite>();
let RES = 2;

export function setSpriteResolution(res: number): void {
  const r = Math.min(4, Math.max(1, res));
  if (r !== RES) {
    RES = r;
    cache.clear();
  }
}

function makeCanvas(w: number, h: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function sprite(key: string, flash = false): Sprite {
  const ck = flash ? key + '#' : key;
  const hit = cache.get(ck);
  if (hit) return hit;
  const def = DEFS[key] ?? DEFS.stone;
  const w = def.hw * 2 + 4;
  const h = def.hh * 2 + 4;
  const cv = makeCanvas(Math.ceil(w * RES), Math.ceil(h * RES));
  const c = cv.getContext('2d') as Ctx;
  c.scale(RES, RES);
  c.translate(w / 2, h / 2);
  def.draw(c);
  if (flash) {
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = '#ffffff';
    c.fillRect(-w, -h, w * 2, h * 2);
  }
  const sp: Sprite = { img: cv, w, h, ox: w / 2, oy: h / 2 };
  cache.set(ck, sp);
  return sp;
}
