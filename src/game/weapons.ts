import type { SimState } from './state';
import type { Projectile, ProjectileKind, WeaponState, Zone, ZoneKind } from './types';
import { WEAPONS, weaponNumbers, type WeaponDef, type WeaponNumbers } from './content/weapons';
import { hurt, healPlayer, nearestEnemy, onScreen, slowEnemy } from './combat';

/** Numbers after player stats. */
export function effective(s: SimState, ws: WeaponState): { def: WeaponDef; n: WeaponNumbers } {
  const def = WEAPONS[ws.id];
  const n = weaponNumbers(def, ws.level);
  const st = s.stats;
  n.damage *= st.might;
  n.area *= st.area;
  n.speed *= st.speed;
  n.duration *= st.duration;
  n.cooldown *= st.cooldown;
  if (def.pattern !== 'aura') n.amount += st.amount;
  return { def, n };
}

function proj(s: SimState, kind: ProjectileKind, ws: WeaponState, n: WeaponNumbers, x: number, y: number, vx: number, vy: number, over: Partial<Projectile> = {}): Projectile {
  const p: Projectile = {
    kind,
    weapon: ws.id,
    x,
    y,
    vx,
    vy,
    damage: n.damage,
    radius: n.area,
    life: n.duration,
    maxLife: n.duration,
    pierce: n.pierce,
    knockback: n.knockback,
    hit: new Set(),
    rot: Math.atan2(vy, vx),
    spin: 0,
    gravity: 0,
    grow: 0,
    angle: 0,
    orbitRadius: 0,
    explodeRadius: 0,
    slow: n.slow,
    bounce: false,
    homing: false,
    heal: n.heal,
    tint: WEAPONS[ws.id].tint,
    ...over,
  };
  s.projectiles.push(p);
  return p;
}

function zone(s: SimState, kind: ZoneKind, ws: WeaponState, n: WeaponNumbers, x: number, y: number, over: Partial<Zone> = {}): Zone {
  const z: Zone = {
    kind,
    weapon: ws.id,
    x,
    y,
    radius: n.area,
    life: n.duration,
    maxLife: n.duration,
    damage: n.damage,
    tick: n.interval,
    timer: 0,
    followPlayer: false,
    slow: n.slow,
    knockback: n.knockback,
    heal: n.heal,
    angle: 0,
    halfWidth: 0,
    hit: new Set(),
    tint: WEAPONS[ws.id].tint,
    ...over,
  };
  s.zones.push(z);
  return z;
}

/** One shot of a burst. Returns false when the pattern fires all at once and the burst is done. */
function shoot(s: SimState, ws: WeaponState, def: WeaponDef, n: WeaponNumbers, index: number): void {
  const p = s.player;
  const dirX = p.dirX;
  const dirY = p.dirY;
  switch (def.pattern) {
    case 'throwFacing': {
      // Thrown the way you walk, but a knife finds the nearest enemy inside
      // a cone ahead: one thumb cannot aim and walk at once.
      let a = Math.atan2(dirY, dirX);
      let bd = 320 * 320;
      for (const e of s.enemies) {
        const ex = e.x - p.x;
        const ey = e.y - p.y;
        const d2 = ex * ex + ey * ey;
        if (d2 >= bd || e.hp <= 0) continue;
        const d = Math.sqrt(d2) || 1;
        if ((ex * dirX + ey * dirY) / d < 0.6) continue;
        bd = d2;
        a = Math.atan2(ey, ex);
      }
      // Fan slightly so five knives are five knives, not one.
      a += (index - (n.amount - 1) / 2) * 0.09;
      proj(s, 'blade', ws, n, p.x, p.y, Math.cos(a) * n.speed, Math.sin(a) * n.speed, { life: 1.4, maxLife: 1.4 });
      break;
    }
    case 'sweep': {
      // Alternate sides. A third swing in a burst goes up, a fourth down.
      const side = index % 2 === 0 ? ws.side : -ws.side;
      const dir = index >= 2 ? (index % 2 === 0 ? -Math.PI / 2 : Math.PI / 2) : side > 0 ? Math.atan2(dirY, dirX) : Math.atan2(dirY, dirX) + Math.PI;
      const reach = 62 * n.area;
      zone(s, 'sweep', ws, n, p.x, p.y, {
        radius: reach,
        life: 0.22,
        maxLife: 0.22,
        tick: Infinity,
        followPlayer: false,
        angle: dir,
        halfWidth: 0.95,
      });
      if (index === n.amount - 1) ws.side = -ws.side;
      break;
    }
    case 'zoneAtPlayer': {
      const ox = index === 0 ? 0 : (s.rng.next() - 0.5) * 120;
      const oy = index === 0 ? 0 : (s.rng.next() - 0.5) * 120;
      zone(s, 'fire', ws, n, p.x + ox, p.y + oy);
      break;
    }
    case 'ring': {
      proj(s, 'ring', ws, n, p.x, p.y, 0, 0, {
        radius: 12,
        grow: n.speed,
        life: n.area / n.speed,
        maxLife: n.area / n.speed,
        pierce: Infinity,
      });
      break;
    }
    case 'strike': {
      const targets = s.enemies.filter((e) => e.hp > 0 && onScreen(s, e.x, e.y, 10));
      let x: number;
      let y: number;
      if (targets.length > 0) {
        const e = s.rng.pick(targets);
        x = e.x;
        y = e.y;
      } else {
        x = p.x + (s.rng.next() - 0.5) * s.view.w;
        y = p.y + (s.rng.next() - 0.5) * s.view.h;
      }
      s.effects.push({ kind: 'bolt', x, y: y - 260, x2: x, y2: y, life: 0.25, maxLife: 0.25, color: def.tint, radius: n.area });
      s.grid.query(x, y, n.area, (e) => {
        const dx = e.x - x;
        const dy = e.y - y;
        if (dx * dx + dy * dy <= (n.area + e.def.radius * e.scale) ** 2) {
          const d = Math.hypot(dx, dy) || 1;
          hurt(s, e, n.damage, dx / d, dy / d, n.knockback);
        }
      });
      break;
    }
    case 'aura':
      break; // maintained in updateAuras
    case 'orbit': {
      // All at once, evenly spaced.
      for (let i = 0; i < n.amount; i++) {
        proj(s, 'orbit', ws, n, p.x, p.y, 0, 0, {
          angle: (i / n.amount) * Math.PI * 2,
          orbitRadius: 58 + n.area,
          spin: 3.6 * n.speed,
          life: def.evolved ? 9999 : n.duration,
          maxLife: def.evolved ? 9999 : n.duration,
          pierce: Infinity,
        });
      }
      ws.active = n.amount;
      ws.burst = 0;
      break;
    }
    case 'lob': {
      const side = index % 2 === 0 ? 1 : -1;
      const vx = side * (40 + s.rng.next() * 60) * (dirX !== 0 ? Math.sign(dirX) : 1);
      proj(s, 'axe', ws, n, p.x, p.y, vx, -n.speed, { gravity: 520, spin: 9, life: 2.2, maxLife: 2.2 });
      break;
    }
    case 'nearest': {
      const target = nearestEnemy(s, p.x, p.y, Math.max(s.view.w, s.view.h));
      let a: number;
      if (target) a = Math.atan2(target.y - p.y, target.x - p.x);
      else a = Math.atan2(dirY, dirX);
      a += (index - (n.amount - 1) / 2) * 0.12;
      proj(s, 'arrow', ws, n, p.x, p.y, Math.cos(a) * n.speed, Math.sin(a) * n.speed, { life: 1.6, maxLife: 1.6 });
      break;
    }
    case 'lobExplode': {
      const target = nearestEnemy(s, p.x + (s.rng.next() - 0.5) * 200, p.y + (s.rng.next() - 0.5) * 200, 420);
      const tx = target ? target.x : p.x + (s.rng.next() - 0.5) * 300;
      const ty = target ? target.y : p.y + (s.rng.next() - 0.5) * 300;
      const d = Math.hypot(tx - p.x, ty - p.y) || 1;
      const t = d / n.speed;
      proj(s, 'stone', ws, n, p.x, p.y, ((tx - p.x) / d) * n.speed, ((ty - p.y) / d) * n.speed, {
        radius: 7,
        life: t,
        maxLife: t,
        pierce: 0,
        explode: 'steam',
        explodeRadius: n.area,
        spin: 6,
      });
      break;
    }
    case 'bounce': {
      const a = s.rng.next() * Math.PI * 2;
      proj(s, 'wind', ws, n, p.x, p.y, Math.cos(a) * n.speed, Math.sin(a) * n.speed, { bounce: true, pierce: Infinity });
      break;
    }
    case 'spirit': {
      const a = s.rng.next() * Math.PI * 2;
      proj(s, 'spirit', ws, n, p.x, p.y, Math.cos(a) * n.speed, Math.sin(a) * n.speed, { homing: true, spin: 0 });
      break;
    }
    case 'trap': {
      const ahead = 90 + index * 50;
      const jx = (s.rng.next() - 0.5) * 60;
      const jy = (s.rng.next() - 0.5) * 60;
      zone(s, 'net', ws, n, p.x + dirX * ahead + jx, p.y + dirY * ahead + jy, { tick: n.interval });
      break;
    }
  }
}

export function updateWeapons(s: SimState, dt: number): void {
  for (const ws of s.weapons) {
    const { def, n } = effective(s, ws);
    if (def.pattern === 'aura') {
      maintainAura(s, ws, def, n);
      continue;
    }
    if (def.pattern === 'orbit') {
      // Refire when the orbiters have expired and the cooldown ran.
      const alive = s.projectiles.some((p) => p.weapon === ws.id && p.kind === 'orbit');
      if (alive) continue;
      ws.cooldown -= dt;
      if (ws.cooldown <= 0) {
        shoot(s, ws, def, n, 0);
        ws.cooldown = n.cooldown;
      }
      continue;
    }
    ws.cooldown -= dt;
    ws.burstTimer -= dt;
    if (ws.cooldown <= 0 && ws.burst === 0) {
      ws.burst = Math.max(1, Math.round(n.amount));
      ws.burstTimer = 0;
      ws.cooldown = n.cooldown;
      ws.active = 0;
    }
    while (ws.burst > 0 && ws.burstTimer <= 0) {
      shoot(s, ws, def, n, ws.active);
      ws.active++;
      ws.burst--;
      ws.burstTimer += n.interval;
    }
  }
}

function maintainAura(s: SimState, ws: WeaponState, def: WeaponDef, n: WeaponNumbers): void {
  let z = s.zones.find((z) => z.weapon === ws.id && z.followPlayer);
  if (!z) {
    z = zone(s, def.id === 'juhannuskokko' ? 'fire' : 'aura', ws, n, s.player.x, s.player.y, { followPlayer: true, life: Infinity, maxLife: Infinity });
  }
  z.radius = n.area;
  z.damage = n.damage;
  z.tick = n.cooldown;
  z.knockback = n.knockback;
  z.heal = n.heal;
}

export function updateProjectiles(s: SimState, dt: number): void {
  const ps = s.projectiles;
  const p = s.player;
  for (let i = ps.length - 1; i >= 0; i--) {
    const pr = ps[i];
    pr.life -= dt;
    if (pr.kind === 'orbit') {
      pr.angle += pr.spin * dt;
      pr.x = p.x + Math.cos(pr.angle) * pr.orbitRadius;
      pr.y = p.y + Math.sin(pr.angle) * pr.orbitRadius;
      pr.rot = pr.angle + Math.PI / 2;
      // Orbiters hit the same enemy again after a moment.
      if (pr.hit.size > 0 && Math.floor(pr.life * 4) !== Math.floor((pr.life + dt) * 4)) pr.hit.clear();
    } else if (pr.kind === 'ring') {
      pr.x = p.x;
      pr.y = p.y;
      pr.radius += pr.grow * dt;
    } else {
      if (pr.homing) {
        const t = nearestEnemy(s, pr.x, pr.y, 260, pr.hit);
        if (t) {
          const v = Math.hypot(pr.vx, pr.vy) || 1;
          const want = Math.atan2(t.y - pr.y, t.x - pr.x);
          const cur = Math.atan2(pr.vy, pr.vx);
          let da = want - cur;
          while (da > Math.PI) da -= Math.PI * 2;
          while (da < -Math.PI) da += Math.PI * 2;
          const turn = Math.max(-5 * dt, Math.min(5 * dt, da));
          pr.vx = Math.cos(cur + turn) * v;
          pr.vy = Math.sin(cur + turn) * v;
        }
      }
      pr.vy += pr.gravity * dt;
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.rot += pr.spin * dt;
      if (pr.spin === 0) pr.rot = Math.atan2(pr.vy, pr.vx);
      if (pr.bounce) {
        const hw = s.view.w / 2 - 8;
        const hh = s.view.h / 2 - 8;
        if (pr.x < p.x - hw) {
          pr.x = p.x - hw;
          pr.vx = Math.abs(pr.vx);
          pr.hit.clear();
        } else if (pr.x > p.x + hw) {
          pr.x = p.x + hw;
          pr.vx = -Math.abs(pr.vx);
          pr.hit.clear();
        }
        if (pr.y < p.y - hh) {
          pr.y = p.y - hh;
          pr.vy = Math.abs(pr.vy);
          pr.hit.clear();
        } else if (pr.y > p.y + hh) {
          pr.y = p.y + hh;
          pr.vy = -Math.abs(pr.vy);
          pr.hit.clear();
        }
      }
    }

    // Collisions
    if (pr.pierce > 0) {
      const isRing = pr.kind === 'ring';
      const r = pr.radius;
      s.grid.query(pr.x, pr.y, r + 20, (e) => {
        if (pr.pierce <= 0 || e.hp <= 0 || pr.hit.has(e.id)) return;
        const dx = e.x - pr.x;
        const dy = e.y - pr.y;
        const er = e.def.radius * e.scale;
        const d2 = dx * dx + dy * dy;
        let hitNow: boolean;
        if (isRing) {
          // The ring is a band; enemies inside it get hit as the edge passes.
          const d = Math.sqrt(d2);
          hitNow = d <= r + er && d >= r - 26;
        } else {
          hitNow = d2 <= (r + er) * (r + er);
        }
        if (!hitNow) return;
        const d = Math.sqrt(d2) || 1;
        let kx = dx / d;
        let ky = dy / d;
        if (!isRing && pr.kind !== 'orbit' && (pr.vx !== 0 || pr.vy !== 0)) {
          const v = Math.hypot(pr.vx, pr.vy);
          kx = pr.vx / v;
          ky = pr.vy / v;
        }
        hurt(s, e, pr.damage, kx, ky, pr.knockback);
        if (pr.slow > 0) slowEnemy(e, pr.slow, 1.5);
        if (pr.heal > 0) healPlayer(s, pr.heal);
        pr.hit.add(e.id);
        pr.pierce--;
      });
    }

    const far = Math.abs(pr.x - p.x) > s.view.w * 0.8 || Math.abs(pr.y - p.y) > s.view.h * 0.8;
    if (pr.life <= 0 || pr.pierce <= 0 || (far && pr.kind !== 'orbit')) {
      if (pr.explode) {
        const ws = s.weapons.find((w) => w.id === pr.weapon);
        if (ws) {
          const { n } = effective(s, ws);
          const z = zone(s, pr.explode, ws, n, pr.x, pr.y, { radius: pr.explodeRadius, life: 1.1 * n.duration, maxLife: 1.1 * n.duration, tick: 0.45 });
          z.damage = pr.damage;
        }
        s.effects.push({ kind: 'burst', x: pr.x, y: pr.y, x2: 0, y2: 0, life: 0.3, maxLife: 0.3, color: pr.tint, radius: pr.explodeRadius });
      }
      ps[i] = ps[ps.length - 1];
      ps.pop();
    }
  }
}

export function updateZones(s: SimState, dt: number): void {
  const zs = s.zones;
  const p = s.player;
  for (let i = zs.length - 1; i >= 0; i--) {
    const z = zs[i];
    z.life -= dt;
    z.timer -= dt;
    if (z.followPlayer) {
      z.x = p.x;
      z.y = p.y;
    }
    if (z.timer <= 0) {
      z.timer += z.tick;
      if (z.timer < 0) z.timer = z.tick;
      const r = z.radius;
      s.grid.query(z.x, z.y, r + 20, (e) => {
        if (e.hp <= 0) return;
        const dx = e.x - z.x;
        const dy = e.y - z.y;
        const er = e.def.radius * e.scale;
        const d2 = dx * dx + dy * dy;
        if (d2 > (r + er) * (r + er)) return;
        if (z.kind === 'sweep') {
          if (z.hit.has(e.id)) return;
          let da = Math.atan2(dy, dx) - z.angle;
          while (da > Math.PI) da -= Math.PI * 2;
          while (da < -Math.PI) da += Math.PI * 2;
          if (Math.abs(da) > z.halfWidth) return;
          z.hit.add(e.id);
        }
        const d = Math.sqrt(d2) || 1;
        hurt(s, e, z.damage, dx / d, dy / d, z.knockback);
        if (z.slow > 0) slowEnemy(e, z.slow, z.tick * 2.5);
        if (z.heal > 0) healPlayer(s, z.heal);
      });
    }
    if (z.life <= 0) {
      zs[i] = zs[zs.length - 1];
      zs.pop();
    }
  }
}
