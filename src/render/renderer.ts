import type { SimState } from '../game/state';
import { hash2 } from '../game/rng';
import { sprite, setSpriteResolution, characterSprite } from './sprites';
import { WEAPONS } from '../game/content/weapons';
import { featuresInCell, cellKey, CELL, CANOPY_R, TREE_R } from '../game/forest';

/**
 * Canvas 2D renderer. The camera sits on the player. World units are chosen
 * so the visible area is about 420 by 800 units in portrait; the scale is
 * derived from the canvas size so the same amount of forest is visible on a
 * phone and a laptop (see ADR 0001).
 */
export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private cssW = 1;
  private cssH = 1;
  /** device pixels per world unit */
  private scale = 1;
  private ground: HTMLCanvasElement | null = null;
  private t = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.resize();
  }

  resize(): void {
    const c = this.canvas;
    this.cssW = c.clientWidth || window.innerWidth;
    this.cssH = c.clientHeight || window.innerHeight;
    // Cap device pixels: fill rate on a 3x phone is the budget that matters.
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(this.cssW * this.dpr);
    c.height = Math.round(this.cssH * this.dpr);
    // Visible area stays close to 336k square units whatever the aspect.
    const cssScale = Math.max(0.8, Math.sqrt((this.cssW * this.cssH) / 336000));
    this.scale = cssScale * this.dpr;
    setSpriteResolution(this.scale);
    this.ground = null;
  }

  /** World units visible, for the sim's spawn ring. */
  view(): { w: number; h: number } {
    return { w: this.canvas.width / this.scale, h: this.canvas.height / this.scale };
  }

  private groundTile(): HTMLCanvasElement {
    if (this.ground) return this.ground;
    const size = 256;
    const cv = document.createElement('canvas');
    const px = Math.ceil(size * this.scale);
    cv.width = px;
    cv.height = px;
    const c = cv.getContext('2d')!;
    c.scale(this.scale, this.scale);
    c.fillStyle = '#1d3a22';
    c.fillRect(0, 0, size, size);
    // moss and needles
    for (let i = 0; i < 260; i++) {
      const x = hash2(i, 1) * size;
      const y = hash2(i, 2) * size;
      const r = 3 + hash2(i, 3) * 9;
      c.fillStyle = hash2(i, 4) < 0.5 ? 'rgba(46,92,50,0.55)' : 'rgba(30,64,36,0.6)';
      c.beginPath();
      c.ellipse(x, y, r, r * 0.6, hash2(i, 5) * 3, 0, Math.PI * 2);
      c.fill();
    }
    for (let i = 0; i < 140; i++) {
      const x = hash2(i, 6) * size;
      const y = hash2(i, 7) * size;
      c.strokeStyle = 'rgba(90,140,70,0.5)';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + (hash2(i, 8) - 0.5) * 6, y - 3 - hash2(i, 9) * 4);
      c.stroke();
    }
    for (let i = 0; i < 40; i++) {
      c.fillStyle = 'rgba(120,90,50,0.35)';
      c.beginPath();
      c.arc(hash2(i, 10) * size, hash2(i, 11) * size, 1 + hash2(i, 12) * 1.5, 0, Math.PI * 2);
      c.fill();
    }
    this.ground = cv;
    return cv;
  }

  /** True when the canvas element's size no longer matches the buffer. */
  needsResize(): boolean {
    const c = this.canvas;
    const w = c.clientWidth || window.innerWidth;
    const h = c.clientHeight || window.innerHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    return w !== this.cssW || h !== this.cssH || dpr !== this.dpr;
  }

  render(s: SimState, dt: number): void {
    this.t += dt;
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const sc = this.scale;
    const p = s.player;
    const shake = s.shake > 0 ? Math.min(1, s.shake) * 6 : 0;
    // Kärpässieni: the world sways and the colours swim.
    const trip = s.trip > 0 ? Math.min(1, s.trip / 2) : 0;
    const swayX = trip ? Math.sin(this.t * 2.1) * 18 * trip : 0;
    const swayY = trip ? Math.cos(this.t * 1.6) * 12 * trip : 0;
    this.canvas.style.filter = trip ? `hue-rotate(${Math.round(Math.sin(this.t * 1.3) * 90 * trip)}deg) saturate(${1 + trip}) contrast(${1 + 0.15 * trip})` : '';
    const camX = p.x + (shake ? (Math.random() - 0.5) * shake : 0) + swayX;
    const camY = p.y + (shake ? (Math.random() - 0.5) * shake : 0) + swayY;
    const viewW = W / sc;
    const viewH = H / sc;
    const left = camX - viewW / 2;
    const top = camY - viewH / 2;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = true;

    // Ground: tile in world space.
    const tile = this.groundTile();
    const ts = 256;
    ctx.setTransform(sc, 0, 0, sc, -left * sc, -top * sc);
    const tx0 = Math.floor(left / ts) * ts;
    const ty0 = Math.floor(top / ts) * ts;
    for (let y = ty0; y < top + viewH; y += ts) {
      for (let x = tx0; x < left + viewW; x += ts) ctx.drawImage(tile, x, y, ts, ts);
    }

    // The forest: ground features and trunks now, canopies after the actors.
    const cx0 = Math.floor(left / CELL) - 1;
    const cx1 = Math.floor((left + viewW) / CELL) + 1;
    const cy0 = Math.floor(top / CELL) - 1;
    const cy1 = Math.floor((top + viewH) / CELL) + 1;
    const trees: { x: number; y: number }[] = [];
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        for (const f of featuresInCell(cx, cy)) {
          if (f.kind === 'tree') {
            trees.push(f);
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath();
            ctx.ellipse(f.x + 4, f.y + 6, TREE_R + 4, TREE_R * 0.6, 0, 0, Math.PI * 2);
            ctx.fill();
            this.blit('trunk', f.x, f.y, 1, 1, 0);
            continue;
          }
          if (f.kind === 'mushroom' && s.eaten.has(cellKey(cx, cy))) continue;
          this.blit(f.kind, f.x, f.y, 1, 1, 0);
        }
      }
    }

    // Zones
    for (const z of s.zones) this.drawZone(z.kind, z.x, z.y, z.radius, z.life, z.maxLife, z.angle, z.halfWidth, z.tint);

    // Gems
    for (const g of s.gems) {
      const key = g.value >= 20 ? 'gem3' : g.value >= 5 ? 'gem2' : 'gem1';
      this.blit(key, g.x, g.y, 1, 1, 0);
    }
    // Pickups
    for (const k of s.pickups) {
      const bob = Math.sin(this.t * 4 + k.x) * 2;
      if (k.kind === 'arkku' || k.kind === 'kapy') {
        ctx.fillStyle = k.kind === 'kapy' ? 'rgba(200,160,90,0.22)' : 'rgba(255,220,120,0.25)';
        ctx.beginPath();
        ctx.arc(k.x, k.y, 16 + Math.sin(this.t * 5) * 2, 0, Math.PI * 2);
        ctx.fill();
      }
      this.blit(k.kind, k.x, k.y + bob, 1, 1, 0);
    }

    // Enemies: shadows first, then bodies.
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    for (const e of s.enemies) {
      const r = e.def.radius * e.scale;
      ctx.beginPath();
      ctx.ellipse(e.x, e.y + r * 0.8, r * 0.9, r * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const e of s.enemies) {
      if (e.elite || e.boss) {
        ctx.strokeStyle = e.boss ? 'rgba(255,80,80,0.8)' : 'rgba(255,215,0,0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.def.radius * e.scale + 3, 0, Math.PI * 2);
        ctx.stroke();
      }
      const bob = e.def.behaviour === 'swarm' || e.def.behaviour === 'phase' ? Math.sin(e.wobble) * 2.5 : Math.abs(Math.sin(e.wobble * 0.8)) * 1.2;
      const slowTint = e.slow > 0;
      // On a trip every creature looks like another one.
      const spriteKey = trip ? TRIP_SPRITES[e.id % TRIP_SPRITES.length] : e.def.sprite;
      this.blit(spriteKey, e.x, e.y - bob, e.scale, e.facing, 0, e.flash > 0);
      if (slowTint) {
        ctx.fillStyle = 'rgba(150,220,255,0.35)';
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.def.radius * e.scale, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Player
    if (p.alive || s.gameOver) {
      const cs = s.character;
      const key = 'char:' + cs.id;
      characterSprite(key, cs.colors);
      const bob = p.moving ? Math.abs(Math.sin(this.t * 14)) * 2 : 0;
      const blink = p.invuln > 0 && Math.floor(this.t * 12) % 2 === 0;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 12, 9, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      if (!blink) {
        if (s.gameOver) {
          ctx.save();
          ctx.translate(p.x, p.y + 6);
          ctx.rotate(Math.min(Math.PI / 2, p.deadTime * 3));
          ctx.translate(-p.x, -p.y - 6);
        }
        this.blit(key, p.x, p.y - bob, 1, p.facing, 0, p.hurtFlash > 0);
        if (s.gameOver) ctx.restore();
      }
    }

    // Projectiles
    for (const pr of s.projectiles) this.drawProjectile(pr.kind, pr.x, pr.y, pr.radius, pr.rot, pr.tint, pr.life, pr.maxLife, pr.orbitRadius, pr.vx, pr.vy);

    // Canopies over everything on the ground; thin where the player stands.
    for (const t of trees) {
      const under = Math.hypot(t.x - p.x, t.y - p.y) < CANOPY_R + 10;
      ctx.globalAlpha = under ? 0.45 : 0.92;
      this.blit('canopy', t.x, t.y - 22, 0.8, 1, 0);
    }
    ctx.globalAlpha = 1;

    // Effects
    for (const e of s.effects) {
      const k = e.life / e.maxLife;
      if (e.kind === 'bolt') {
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 3 * k + 1;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        const segs = 6;
        for (let i = 1; i <= segs; i++) {
          const t = i / segs;
          const jx = i === segs ? 0 : (hash2(i, Math.floor(e.x), 3) - 0.5) * 30;
          ctx.lineTo(e.x + (e.x2 - e.x) * t + jx, e.y + (e.y2 - e.y) * t);
        }
        ctx.stroke();
        ctx.fillStyle = `rgba(200,235,255,${0.5 * k})`;
        ctx.beginPath();
        ctx.arc(e.x2, e.y2, e.radius, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.kind === 'puff') {
        ctx.fillStyle = e.color;
        ctx.globalAlpha = k * 0.7;
        const r = e.radius * (1.2 - k);
        for (let i = 0; i < 4; i++) {
          const a = i * 1.57 + e.x * 0.1;
          ctx.beginPath();
          ctx.arc(e.x + Math.cos(a) * r * 0.6, e.y + Math.sin(a) * r * 0.6, r * 0.45, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      } else if (e.kind === 'levelup') {
        ctx.strokeStyle = e.color;
        ctx.globalAlpha = k;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius * (1 - k) + 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (e.kind === 'burst' || e.kind === 'revive') {
        ctx.strokeStyle = e.color;
        ctx.globalAlpha = k;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius * (1 - k), 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // Floating texts
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of s.texts) {
      ctx.globalAlpha = Math.min(1, t.life * 2.5);
      ctx.font = `${t.big ? 'bold 13px' : 'bold 9px'} system-ui, sans-serif`;
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;

    // Screen-space: hurt vignette
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (p.hurtFlash > 0) {
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
      g.addColorStop(0, 'rgba(180,0,0,0)');
      g.addColorStop(1, `rgba(180,0,0,${Math.min(0.6, p.hurtFlash * 4)})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    if (p.hp < s.stats.maxHp * 0.3 && p.alive) {
      const a = 0.12 + Math.sin(this.t * 5) * 0.08;
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.8);
      g.addColorStop(0, 'rgba(160,0,0,0)');
      g.addColorStop(1, `rgba(160,0,0,${a})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  }

  private blit(key: string, x: number, y: number, scale: number, facing: number, rot: number, flash = false): void {
    const sp = sprite(key, flash);
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    ctx.scale(scale * (facing < 0 ? -1 : 1), scale);
    ctx.drawImage(sp.img as CanvasImageSource, -sp.ox, -sp.oy, sp.w, sp.h);
    ctx.restore();
  }

  private drawZone(kind: string, x: number, y: number, r: number, life: number, maxLife: number, angle: number, halfWidth: number, tint: string): void {
    const ctx = this.ctx;
    const k = maxLife === Infinity ? 1 : Math.min(1, life / maxLife);
    switch (kind) {
      case 'fire': {
        const fl = 0.85 + Math.sin(this.t * 17 + x) * 0.15;
        const g = ctx.createRadialGradient(x, y, r * 0.1, x, y, r * fl);
        g.addColorStop(0, `rgba(255,230,120,${0.7 * Math.min(1, k * 3)})`);
        g.addColorStop(0.5, `rgba(255,120,30,${0.5 * Math.min(1, k * 3)})`);
        g.addColorStop(1, 'rgba(255,60,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r * fl, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'aura': {
        ctx.fillStyle = 'rgba(120,200,150,0.14)';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(180,240,200,0.5)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 6]);
        ctx.lineDashOffset = -this.t * 30;
        ctx.stroke();
        ctx.setLineDash([]);
        break;
      }
      case 'steam': {
        ctx.fillStyle = `rgba(240,240,255,${0.45 * k})`;
        for (let i = 0; i < 5; i++) {
          const a = i * 1.26 + this.t * 2;
          ctx.beginPath();
          ctx.arc(x + Math.cos(a) * r * 0.4, y + Math.sin(a) * r * 0.4, r * 0.55, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'net': {
        ctx.fillStyle = `rgba(80,160,190,${0.12 * Math.min(1, k * 2)})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(140,210,230,${0.22 * Math.min(1, k * 2)})`;
        ctx.lineWidth = 0.8;
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.clip();
        for (let i = -r; i <= r; i += 16) {
          ctx.beginPath();
          ctx.moveTo(x + i, y - r);
          ctx.lineTo(x + i, y + r);
          ctx.moveTo(x - r, y + i);
          ctx.lineTo(x + r, y + i);
          ctx.stroke();
        }
        ctx.restore();
        ctx.strokeStyle = `rgba(140,210,230,${0.5 * Math.min(1, k * 2)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'sweep': {
        ctx.fillStyle = `rgba(160,240,140,${0.55 * k})`;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.arc(x, y, r, angle - halfWidth, angle + halfWidth);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = tint;
        ctx.lineWidth = 3 * k;
        ctx.beginPath();
        ctx.arc(x, y, r * (0.7 + 0.3 * (1 - k)), angle - halfWidth, angle + halfWidth);
        ctx.stroke();
        break;
      }
      default:
        break;
    }
  }

  private drawProjectile(kind: string, x: number, y: number, r: number, rot: number, tint: string, life: number, maxLife: number, orbitR: number, vx: number, vy: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    switch (kind) {
      case 'blade':
        ctx.rotate(rot);
        ctx.fillStyle = tint;
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(0, -2.5);
        ctx.lineTo(-6, -2);
        ctx.lineTo(-6, 2);
        ctx.lineTo(0, 2.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#6a4a2a';
        ctx.fillRect(-9, -1.6, 4, 3.2);
        break;
      case 'arrow':
        ctx.rotate(rot);
        ctx.strokeStyle = '#8a6a3a';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-9, 0);
        ctx.lineTo(7, 0);
        ctx.stroke();
        ctx.fillStyle = tint === '#ffb070' ? '#ff8040' : '#d0d0d8';
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(5, -2.5);
        ctx.lineTo(5, 2.5);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#e8e8e8';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-9, 0);
        ctx.lineTo(-11, -2.5);
        ctx.moveTo(-9, 0);
        ctx.lineTo(-11, 2.5);
        ctx.stroke();
        break;
      case 'axe':
        ctx.rotate(rot);
        ctx.strokeStyle = '#5a3a1a';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(-r * 0.9, r * 0.4);
        ctx.lineTo(r * 0.5, -r * 0.5);
        ctx.stroke();
        ctx.fillStyle = tint;
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(r * 0.3, -r * 0.7);
        ctx.quadraticCurveTo(r * 1.2, -r * 0.3, r * 0.9, r * 0.5);
        ctx.lineTo(r * 0.2, -r * 0.1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      case 'stone': {
        ctx.fillStyle = '#3a3a3a';
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.6);
        g.addColorStop(0, 'rgba(255,120,60,0.8)');
        g.addColorStop(1, 'rgba(255,120,60,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.6, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'wind': {
        const a = Math.atan2(vy, vx);
        ctx.rotate(a);
        ctx.strokeStyle = tint;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        for (let i = -1; i <= 1; i++) {
          ctx.globalAlpha = 0.8 - Math.abs(i) * 0.3;
          ctx.beginPath();
          ctx.moveTo(-22, i * 4);
          ctx.quadraticCurveTo(-8, i * 4 + Math.sin(this.t * 20 + i) * 3, 6, i * 3);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        break;
      }
      case 'ring':
        ctx.strokeStyle = tint;
        ctx.globalAlpha = Math.max(0.15, life / maxLife);
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#fff';
        ctx.beginPath();
        ctx.arc(0, 0, r - 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        break;
      case 'orbit':
        ctx.rotate(rot);
        ctx.strokeStyle = tint;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, r);
        ctx.lineTo(0, -r);
        ctx.moveTo(0, -r * 0.2);
        ctx.lineTo(-r * 0.7, -r * 0.9);
        ctx.moveTo(0, -r * 0.6);
        ctx.lineTo(r * 0.6, -r * 1.2);
        ctx.moveTo(0, r * 0.3);
        ctx.lineTo(r * 0.6, -r * 0.2);
        ctx.stroke();
        void orbitR;
        break;
      case 'spirit': {
        const a = Math.atan2(vy, vx);
        ctx.rotate(a);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.8);
        g.addColorStop(0, 'rgba(255,255,255,0.9)');
        g.addColorStop(0.4, tint);
        g.addColorStop(1, 'rgba(200,150,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(-r * 0.4, 0, r * 2.2, r * 1.1, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(r * 0.6, 0, r * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#3a1a5a';
        ctx.beginPath();
        ctx.arc(r * 0.75, -r * 0.1, r * 0.15, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      default:
        ctx.fillStyle = tint;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
  }
}

const TRIP_SPRITES = ['bear', 'gnome', 'mushroom', 'kanttarelli', 'troll', 'wisp', 'bush', 'kapy', 'nakki', 'viper', 'lakka', 'stump'];

export function weaponTint(id: string): string {
  return WEAPONS[id]?.tint ?? '#fff';
}
