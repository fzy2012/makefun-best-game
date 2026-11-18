// The autopilot that stages screenshots and play-tests the game: it steers the ship
// toward what it should shoot, leads moving targets the way a bullet's flight time
// demands, chases pickups it can reach, sidesteps bullets it can see coming, and
// spends a bomb when it is about to die. Pure logic over the world state, no browser
// in it, so the same pilot can run a whole run in Node to prove the game is winnable.

import { FIELD, PLAYER } from './config.js';

const HOME_Y = FIELD.height - 90;
const OFFSETS = [-170, -120, -80, -45, -20, 0, 20, 45, 80, 120, 170];
const BULLET_SPEED = 800;

/** Seconds until a bullet comes within 30px of (x, y); Infinity when it never does. */
function dangerAt(state, x, y, horizon) {
  let worst = Infinity;
  for (const b of state.enemyBullets) {
    if (!b.active) continue;
    // Too far to arrive inside the horizon: a bullet covers ~145px in 0.55s.
    if (Math.abs(b.x - x) > 200 || Math.abs(b.y - y) > 200) continue;
    const dx = x - b.x;
    const dy = y - b.y;
    const vx = -b.vx;
    const vy = -b.vy;
    const vv = vx * vx + vy * vy;
    let t = 0;
    if (vv > 0) t = Math.max(0, -(dx * vx + dy * vy) / vv);
    if (t > horizon) continue;
    const cx = b.x + b.vx * t;
    const cy = b.y + b.vy * t;
    if (Math.hypot(cx - x, cy - y) < 32 && t < worst) worst = t;
  }
  for (const e of state.enemies) {
    if (!e.active || e.kind === 'boss') continue;
    if (Math.abs(e.x - x) < 42 && e.y < y && e.y + 260 > y && 0.25 < worst) worst = 0.25;
  }
  return worst;
}

export function createAutopilot() {
  // Last seen position of each enemy, for leading its movement.
  const seen = new Map();
  // The enemy the pilot is working on, kept until it dies or 0.6s pass: without
  // this the pilot retargets every step and the bullets spray everywhere.
  let target = null;
  let targetUntil = 0;

  function leadX(enemy, now, playerY) {
    const prev = seen.get(enemy);
    let vx = 0;
    if (prev && now > prev.t) vx = (enemy.x - prev.x) / (now - prev.t);
    seen.set(enemy, { x: enemy.x, t: now });
    const flight = Math.max(0.05, (playerY - enemy.y) / BULLET_SPEED);
    // Lead only part of the flight: a weaver reverses its sway mid-flight, and a
    // full lead would chase it past the turning point it lingers on.
    return enemy.x + vx * flight * 0.4;
  }

  /**
   * Steer for one step: where the ship should go, as -1..1 on each axis, and whether
   * to spend a bomb. The ship holds its home line, slides sideways to shoot and dodge,
   * and climbs a little when the home line itself is a bullet lane.
   */
  function steer(state) {
    const player = state.player;
    const now = state.elapsed;
    // Aim at the boss when there is one; else the enemy whose led position is
    // closest to the ship's line, so the most bullets land. The target sticks
    // until it dies or its time runs out.
    let targetX = FIELD.width / 2;
    if (state.boss) {
      target = state.boss;
      targetX = leadX(state.boss, now, player.y);
    } else {
      if (target && !target.active) target = null;
    if (target === null || now > targetUntil || (target && Math.abs(leadX(target, now, player.y) - player.x) > 240)) {
        target = null;
        let bestScore = Infinity;
        for (const e of state.enemies) {
          if (!e.active) continue;
          const lx = leadX(e, now, player.y);
          const score = Math.abs(lx - player.x) + 0.12 * (player.y - e.y);
          if (score < bestScore) {
            bestScore = score;
            target = e;
          }
        }
        targetUntil = now + 0.4;
      }
      if (target) targetX = leadX(target, now, player.y);
    }
    // A pickup worth chasing: repair when hurt, spread and shield always, a star
    // when it is close. It only wins over the aim when it is near and reachable.
    for (const p of state.pickups) {
      if (!p.active) continue;
      const want =
        (p.kind === 'repair' && player.hull < PLAYER.hull) ||
        p.kind === 'spread' ||
        p.kind === 'shield' ||
        (p.kind === 'star' && Math.abs(p.x - player.x) < 150);
      if (!want) continue;
      if (p.y > player.y - 340 && Math.abs(p.x - player.x) < 280) {
        targetX = p.x;
        break;
      }
    }
    // Of the sideways steps on two heights, keep the safest; among safe ones, the
    // closest to the aim.
    let bestX = player.x;
    let bestY = HOME_Y;
    let bestDanger = -1;
    let bestDist = Infinity;
    for (const y of [HOME_Y, HOME_Y - 90]) {
      for (const off of OFFSETS) {
        const x = Math.min(FIELD.width - 24, Math.max(24, player.x + off));
        const danger = dangerAt(state, x, y, 0.55);
        const dist = Math.abs(x - targetX) + Math.abs(y - HOME_Y) * 0.4;
        if (danger === Infinity) {
          if (bestDanger !== Infinity || dist < bestDist) {
            bestDanger = Infinity;
            bestDist = dist;
            bestX = x;
            bestY = y;
          }
        } else if (bestDanger !== Infinity && danger > bestDanger) {
          bestDanger = danger;
          bestDist = dist;
          bestX = x;
          bestY = y;
        }
      }
    }
    const dx = bestX - player.x;
    const steerX = Math.max(-1, Math.min(1, dx / 50));
    const dy = bestY - player.y;
    const steerY = Math.max(-1, Math.min(1, dy / 60));
    // A bomb when the hull is last and a bullet is about to land, or when the sky
    // is so full of bullets that dodging has stopped working.
    let bullets = 0;
    for (const b of state.enemyBullets) if (b.active) bullets += 1;
    const doomed =
      player.bombs > 0 &&
      ((player.hull === 1 && dangerAt(state, player.x, HOME_Y, 0.3) < 0.3) ||
        (bullets > 30 && player.hull <= 2));
    return { x: steerX, y: steerY, bomb: doomed };
  }

  return { steer };
}
