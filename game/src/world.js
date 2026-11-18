// NEON VOID's rules and state, with no drawing and no browser in it: the player's
// ship, the pools of bullets, enemies and pickups, the ten waves and the two bosses,
// collisions, score, streaks and the win. step() advances one fixed step and returns
// what happened as bit flags, so the caller can react without the world knowing about
// screens or sound. Nothing here allocates after createWorld returns.

import { BOSS, BULLET, FIELD, FINAL_WAVE, PARTICLE, PICKUP, PLAYER, POOLS, WAVES } from './config.js';
import { KIND_BOSS, KIND_BRUTE, KIND_DRIFTER, KIND_SPITTER, KIND_WEAVER, aimAt, spawnEnemy, stepEnemy } from './enemies.js';
import { PICK_REPAIR, PICK_SHIELD, PICK_SPREAD, PICK_STAR, rollDrop, spawnPickup, stepPickup } from './pickups.js';
import { createParticles } from './particles.js';

export const EVENT_HIT = 1;
export const EVENT_KILL = 2;
export const EVENT_PICKUP = 4;
export const EVENT_WAVE = 8;
export const EVENT_BOSS = 16;
export const EVENT_OVER = 32;
export const EVENT_WIN = 64;
export const EVENT_BOMB = 128;
export const EVENT_SHOOT = 256;

/** A wave's spawn plan, shuffled into a queue of kinds. */
function buildQueue(random, wave) {
  const plan = WAVES[wave - 1];
  const queue = [];
  for (let i = 0; i < plan.drifters; i += 1) queue.push(KIND_DRIFTER);
  for (let i = 0; i < plan.weavers; i += 1) queue.push(KIND_WEAVER);
  for (let i = 0; i < plan.spitters; i += 1) queue.push(KIND_SPITTER);
  for (let i = 0; i < plan.brutes; i += 1) queue.push(KIND_BRUTE);
  // Shuffle so the wave never arrives in kind order.
  for (let i = queue.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = queue[i];
    queue[i] = queue[j];
    queue[j] = tmp;
  }
  return queue;
}

function circleHit(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const r = a.radius + b.radius;
  return dx * dx + dy * dy < r * r;
}

export function createWorld(random) {
  const particles = createParticles(random);
  const player = {
    x: FIELD.width / 2,
    y: FIELD.height - 90,
    radius: PLAYER.radius,
    hull: PLAYER.hull,
    maxHull: PLAYER.hull,
    bombs: PLAYER.bombs,
    weapon: 1,
    spreadTimer: 0,
    shield: false,
    invulnerable: 0,
    fireTimer: 0,
    alive: true,
  };
  const playerBullets = [];
  for (let i = 0; i < POOLS.playerBullets; i += 1) {
    playerBullets.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, radius: BULLET.playerRadius });
  }
  const enemyBullets = [];
  for (let i = 0; i < POOLS.enemyBullets; i += 1) {
    enemyBullets.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, radius: BULLET.enemyRadius });
  }
  const enemies = [];
  for (let i = 0; i < POOLS.enemies; i += 1) {
    enemies.push({ active: false, kind: KIND_DRIFTER, x: 0, y: 0, radius: 0, hp: 0 });
  }
  const pickups = [];
  for (let i = 0; i < POOLS.pickups; i += 1) {
    pickups.push({ active: false, kind: PICK_STAR, x: 0, y: 0, radius: 0, phase: 0 });
  }
  const state = {
    player,
    playerBullets,
    enemyBullets,
    enemies,
    pickups,
    particles,
    score: 0,
    best: 0,
    wave: 0,
    kills: 0,
    shotsFired: 0,
    shotsHit: 0,
    streak: 0,
    multiplier: 1,
    elapsed: 0,
    banner: '',
    bannerTimer: 0,
    intermission: 0,
    boss: null,
    shake: 0,
    flash: 0,
    over: false,
    won: false,
  };
  let queue = [];
  let spawnTimer = 0;
  let bossSpawnTimer = 0;
  let bossMinionTimer = 0;

  function free(pool) {
    for (let i = 0; i < pool.length; i += 1) if (!pool[i].active) return pool[i];
    return null;
  }

  function fireBullet(x, y, vx, vy, pool, radius) {
    const b = free(pool);
    if (b === null) return;
    b.active = true;
    b.x = x;
    b.y = y;
    b.vx = vx;
    b.vy = vy;
    b.radius = radius;
  }

  function playerShoot() {
    const level = player.weapon;
    const speed = PLAYER.bulletSpeed;
    const y = player.y - player.radius - 6;
    if (level === 1) {
      fireBullet(player.x, y, 0, -speed, playerBullets, BULLET.playerRadius);
      state.shotsFired += 1;
    } else if (level === 2) {
      fireBullet(player.x - 9, y, 0, -speed, playerBullets, BULLET.playerRadius);
      fireBullet(player.x + 9, y, 0, -speed, playerBullets, BULLET.playerRadius);
      state.shotsFired += 2;
    } else {
      fireBullet(player.x, y, 0, -speed, playerBullets, BULLET.playerRadius);
      fireBullet(player.x - 10, y, -110, -speed, playerBullets, BULLET.playerRadius);
      fireBullet(player.x + 10, y, 110, -speed, playerBullets, BULLET.playerRadius);
      state.shotsFired += 3;
    }
  }

  function enemyShoot(x, y, dirX, dirY, speed) {
    fireBullet(x, y, dirX * speed, dirY * speed, enemyBullets, BULLET.enemyRadius);
  }

  function bossRadial(boss) {
    for (let i = 0; i < 12; i += 1) {
      const angle = (i / 12) * Math.PI * 2 + boss.phase * 0.2;
      enemyShoot(boss.x, boss.y, Math.cos(angle), Math.sin(angle), BULLET.enemySpeed * 0.85);
    }
  }

  function bossSpread(boss) {
    const aim = aimAt(boss, player);
    for (let i = -1; i <= 1; i += 1) {
      const angle = Math.atan2(aim.y, aim.x) + i * 0.22;
      enemyShoot(boss.x, boss.y + boss.radius * 0.5, Math.cos(angle), Math.sin(angle), BULLET.enemySpeed);
    }
  }

  function hurtPlayer(events) {
    if (player.shield) {
      player.shield = false;
      particles.burst(player.x, player.y, '#7dff8a', 14, 200);
      return events;
    }
    player.hull -= 1;
    player.invulnerable = PLAYER.invulnerable;
    player.streak = 0;
    state.multiplier = 1;
    state.shake = 0.45;
    state.flash = 0.25;
    particles.burst(player.x, player.y, '#ff5d7a', 26, 320);
    events |= EVENT_HIT;
    if (player.hull <= 0) {
      player.alive = false;
      state.over = true;
      particles.burst(player.x, player.y, '#37e6ff', 60, 420);
      particles.burst(player.x, player.y, '#ff5d7a', 40, 300);
      events |= EVENT_OVER;
    }
    return events;
  }

  function killEnemy(enemy, events) {
    enemy.active = false;
    state.kills += 1;
    state.streak += 1;
    state.multiplier = Math.min(5, 1 + Math.floor(state.streak / 8));
    const gained = enemy.score * state.multiplier;
    state.score += gained;
    particles.burst(enemy.x, enemy.y, enemy.color, enemy.kind === KIND_BOSS ? 70 : 22, 300);
    particles.floatText(enemy.x, enemy.y, `+${gained}`, '#ffd34d', 18);
    if (enemy.kind === KIND_BOSS) {
      state.boss = null;
      state.shake = 0.8;
      state.flash = 0.4;
      for (let i = 0; i < 3; i += 1) {
        particles.burst(enemy.x + (random() - 0.5) * 120, enemy.y + (random() - 0.5) * 60, '#b14dff', 30, 380);
      }
    }
    const drop = enemy.kind === KIND_BOSS ? PICK_REPAIR : rollDrop(random);
    if (drop) {
      const slot = free(pickups);
      if (slot) spawnPickup(slot, drop, enemy.x, enemy.y);
    }
    return events | EVENT_KILL;
  }

  function startWave(wave) {
    state.wave = wave;
    const plan = WAVES[wave - 1];
    state.banner = plan.banner;
    state.bannerTimer = 2.4;
    queue = buildQueue(random, wave);
    spawnTimer = 0.6;
    bossSpawnTimer = plan.boss ? 1.2 : 0;
    state.intermission = 0;
  }

  function waveCleared(events) {
    const bonus = 100 * state.wave;
    state.score += bonus;
    particles.floatText(FIELD.width / 2, FIELD.height / 2 - 40, `WAVE BONUS +${bonus}`, '#ffd34d', 26);
    if (state.wave >= FINAL_WAVE) {
      state.won = true;
      events |= EVENT_WIN;
      return events;
    }
    state.intermission = 1.6;
    return events;
  }

  function reset(demo) {
    player.x = FIELD.width / 2;
    player.y = FIELD.height - 90;
    player.hull = demo ? 4 : PLAYER.hull;
    player.maxHull = demo ? 4 : PLAYER.hull;
    player.bombs = demo ? 3 : PLAYER.bombs;
    player.weapon = demo ? 3 : 1;
    player.spreadTimer = demo ? PICKUP.spreadTime : 0;
    player.shield = !!demo;
    player.invulnerable = 0;
    player.fireTimer = 0;
    player.alive = true;
    for (const b of playerBullets) b.active = false;
    for (const b of enemyBullets) b.active = false;
    for (const e of enemies) e.active = false;
    for (const p of pickups) p.active = false;
    state.score = 0;
    state.wave = 0;
    state.kills = 0;
    state.shotsFired = 0;
    state.shotsHit = 0;
    state.streak = 0;
    state.multiplier = 1;
    state.elapsed = 0;
    state.banner = '';
    state.bannerTimer = 0;
    state.intermission = 0;
    state.boss = null;
    state.shake = 0;
    state.flash = 0;
    state.over = false;
    state.won = false;
    queue = [];
  }

  /**
   * One fixed step. `steer` is -1..1 on each axis (keys, or toward the pointer).
   * With `harmless` set (the title screen's backdrop) things fly and the ship shoots,
   * but nothing touches the player and nothing scores. `wantBomb` spends a bomb.
   */
  function step(dt, steerX, steerY, harmless, wantBomb) {
    let events = 0;
    state.elapsed += dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 1.4);
    if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 1.8);
    if (state.bannerTimer > 0) state.bannerTimer -= dt;
    particles.step(dt);

    // The ship steers, eased toward the pointer's direction, and fires on its own.
    const len = Math.hypot(steerX, steerY);
    if (len > 0.01 && player.alive) {
      const nx = steerX / Math.max(1, len);
      const ny = steerY / Math.max(1, len);
      player.x = Math.min(FIELD.width - 24, Math.max(24, player.x + nx * PLAYER.speed * dt));
      player.y = Math.min(FIELD.height - 40, Math.max(120, player.y + ny * PLAYER.speed * dt));
      if (random() < 0.6) particles.trail(player.x, player.y + player.radius + 4, '#37e6ff');
    }
    if (player.invulnerable > 0) player.invulnerable = Math.max(0, player.invulnerable - dt);
    if (player.spreadTimer > 0) {
      player.spreadTimer -= dt;
      if (player.spreadTimer <= 0 && player.weapon > 1) {
        player.weapon -= 1;
        if (player.weapon > 1) player.spreadTimer = PICKUP.spreadTime;
      }
    }
    if (player.alive && !state.over && !state.won) {
      player.fireTimer -= dt;
      if (player.fireTimer <= 0) {
        playerShoot();
        events |= EVENT_SHOOT;
        player.fireTimer = Math.max(
          PLAYER.fireIntervalMin,
          PLAYER.fireInterval + PLAYER.fireIntervalPerLevel * (player.weapon - 1),
        );
      }
    }
    if (wantBomb && player.bombs > 0 && player.alive && !state.over && !state.won) {
      player.bombs -= 1;
      state.flash = 0.5;
      state.shake = 0.6;
      for (const b of enemyBullets) {
        if (b.active) {
          particles.burst(b.x, b.y, '#8ef1ff', 3, 120);
          b.active = false;
        }
      }
      for (const e of enemies) {
        if (!e.active || e.kind === KIND_BOSS) continue;
        e.hp -= 3;
        e.flash = 0.15;
        if (e.hp <= 0) events = killEnemy(e, events);
      }
      if (state.boss) {
        state.boss.hp -= 5;
        state.boss.flash = 0.15;
        if (state.boss.hp <= 0) events = killEnemy(state.boss, events);
      }
      events |= EVENT_BOMB;
    }

    // Waves: spawn from the queue, bring the boss in, and notice when a wave is clear.
    if (!harmless && !state.over && !state.won) {
      if (state.intermission > 0) {
        state.intermission -= dt;
        if (state.intermission <= 0) startWave(state.wave + 1);
      } else if (state.wave === 0) {
        startWave(1);
        events |= EVENT_WAVE;
      } else {
        const plan = WAVES[state.wave - 1];
        if (plan.boss && bossSpawnTimer > 0) {
          bossSpawnTimer -= dt;
          if (bossSpawnTimer <= 0) {
            const slot = free(enemies);
            if (slot) {
              spawnEnemy(slot, KIND_BOSS, FIELD.width / 2, random, plan.boss);
              state.boss = slot;
              events |= EVENT_BOSS;
            }
          }
        } else if (queue.length > 0) {
          spawnTimer -= dt;
          if (spawnTimer <= 0) {
            const kind = queue.shift();
            const slot = free(enemies);
            if (slot) {
              const def = kind === KIND_BRUTE ? { radius: 30 } : { radius: 18 };
              spawnEnemy(slot, kind, def.radius + random() * (FIELD.width - 2 * def.radius), random);
            }
            spawnTimer = plan.interval * (0.8 + random() * 0.4);
          }
        } else {
          const anyLeft = enemies.some((e) => e.active);
          if (!anyLeft) events = waveCleared(events);
        }
        // The final boss calls in drifters while the fight drags on.
        if (state.boss && state.boss.bossKind === 'heart') {
          bossMinionTimer -= dt;
          if (bossMinionTimer <= 0) {
            bossMinionTimer = 6;
            for (let i = 0; i < 2; i += 1) {
              const slot = free(enemies);
              if (slot) spawnEnemy(slot, KIND_DRIFTER, 60 + random() * (FIELD.width - 120), random);
            }
          }
        }
      }
    }

    // Title backdrop: a gentle stream of drifters for the ship to shoot at.
    if (harmless) {
      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        spawnTimer = 1.4;
        const slot = free(enemies);
        if (slot) spawnEnemy(slot, KIND_DRIFTER, 40 + random() * (FIELD.width - 80), random);
      }
    }

    // Enemies fly, shoot, and are steered by their kind.
    for (const e of enemies) {
      if (!e.active) continue;
      const act = stepEnemy(e, dt, state.elapsed, player, random);
      if (act === 'shoot') {
        if (e.kind === KIND_BOSS) bossSpread(e);
        else {
          const aim = aimAt(e, player);
          enemyShoot(e.x, e.y + e.radius, aim.x, aim.y, BULLET.enemySpeed);
        }
      } else if (act === 'radial') {
        bossRadial(e);
      }
    }

    // Player bullets fly and hit enemies.
    for (const b of playerBullets) {
      if (!b.active) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y < -12 || b.x < -12 || b.x > FIELD.width + 12) {
        b.active = false;
        continue;
      }
      for (const e of enemies) {
        if (!e.active || b.y > e.y + e.radius + 6) continue;
        if (!circleHit(b, e)) continue;
        b.active = false;
        state.shotsHit += 1;
        e.hp -= 1;
        e.flash = 0.09;
        particles.burst(b.x, b.y, '#8ef1ff', 4, 160);
        if (e.hp <= 0) {
          events = killEnemy(e, events);
          if (!harmless && e.kind === KIND_BOSS && state.wave >= FINAL_WAVE) {
            events = waveCleared(events);
          }
        }
        break;
      }
    }

    // Enemy bullets fly and hit the player.
    for (const b of enemyBullets) {
      if (!b.active) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y < -12 || b.y > FIELD.height + 12 || b.x < -12 || b.x > FIELD.width + 12) {
        b.active = false;
        continue;
      }
      if (harmless || !player.alive || player.invulnerable > 0) continue;
      if (circleHit(b, player)) {
        b.active = false;
        events = hurtPlayer(events);
        if (state.over) break;
      }
    }

    // Enemies that ram the ship die and hurt it.
    if (!harmless && player.alive && player.invulnerable === 0) {
      for (const e of enemies) {
        if (!e.active || e.kind === KIND_BOSS) continue;
        if (!circleHit(e, player)) continue;
        e.hp = 0;
        events = killEnemy(e, events);
        events = hurtPlayer(events);
        if (state.over) break;
      }
    }
    // The boss itself is too big to ram; brushing it still hurts.
    if (!harmless && player.alive && player.invulnerable === 0 && state.boss) {
      if (circleHit(state.boss, player)) events = hurtPlayer(events);
    }

    // Pickups drift down and are collected.
    for (const p of pickups) {
      if (!p.active) continue;
      stepPickup(p, dt);
      if (!p.active || !player.alive) continue;
      if (!circleHit(p, player)) continue;
      p.active = false;
      if (p.kind === PICK_SPREAD) {
        player.weapon = Math.min(3, player.weapon + 1);
        player.spreadTimer = PICKUP.spreadTime;
        particles.floatText(player.x, player.y - 30, 'SPREAD UP', '#37e6ff', 20);
      } else if (p.kind === PICK_SHIELD) {
        player.shield = true;
        particles.floatText(player.x, player.y - 30, 'SHIELD', '#7dff8a', 20);
      } else if (p.kind === PICK_REPAIR) {
        player.hull = Math.min(player.maxHull, player.hull + 1);
        particles.floatText(player.x, player.y - 30, '+1 HULL', '#ff7d9c', 20);
      } else if (p.kind === PICK_STAR) {
        state.score += 150 * state.multiplier;
        particles.floatText(player.x, player.y - 30, `+${150 * state.multiplier}`, '#ffd34d', 20);
      }
      particles.burst(p.x, p.y, '#ffd34d', 10, 180);
      events |= EVENT_PICKUP;
    }

    // Harmless kills score nothing: the title backdrop is a show, not a run.
    if (harmless) {
      state.score = 0;
      state.kills = 0;
    }
    return events;
  }

  reset(false);
  return { state, reset, step, startWave };
}
