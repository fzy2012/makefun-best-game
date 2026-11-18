// The things that shoot back: four enemy kinds and the two bosses. Each enemy is a
// small state machine (enter, fight, die) drawn by the renderer from its kind, position
// and wobble phase. The boss is an enemy too, with its own health bar and attack patterns.

import { BOSS, ENEMY, FIELD } from './config.js';

export const KIND_DRIFTER = 'drifter';
export const KIND_WEAVER = 'weaver';
export const KIND_SPITTER = 'spitter';
export const KIND_BRUTE = 'brute';
export const KIND_BOSS = 'boss';

export function kindDef(kind) {
  if (kind === KIND_BOSS) return BOSS;
  return ENEMY[kind];
}

/** A fresh enemy of `kind` entering at the top. `bossKind` names warden or heart. */
export function spawnEnemy(enemy, kind, x, random, bossKind) {
  const def = kindDef(kind);
  enemy.active = true;
  enemy.kind = kind;
  enemy.bossKind = bossKind || null;
  enemy.x = x;
  enemy.y = kind === KIND_BOSS ? -90 : -def.radius - 10;
  enemy.radius = def.radius;
  enemy.hp = kind === KIND_BOSS ? (bossKind === 'heart' ? BOSS.heartHp : BOSS.wardenHp) : def.hp;
  enemy.maxHp = enemy.hp;
  enemy.speed = def.speed;
  enemy.score = kind === KIND_BOSS ? BOSS.score : def.score;
  enemy.color = def.color;
  enemy.core = def.core;
  enemy.phase = random() * Math.PI * 2;
  enemy.fireTimer = 1.2 + random() * 0.8;
  enemy.patternTimer = 0;
  enemy.entered = false;
  enemy.flash = 0;
  enemy.spin = 0;
  return enemy;
}

/**
 * Steer one enemy for a step. Returns 'shoot' when a spitter or the boss fires an aimed
 * shot, 'radial' when the boss lets off a ring, 'spawn' when the boss calls in drifters.
 * `player` is only read for aiming, never moved.
 */
export function stepEnemy(enemy, dt, time, player, random) {
  if (!enemy.active) return null;
  if (enemy.flash > 0) enemy.flash -= dt;
  enemy.spin += dt;
  const def = kindDef(enemy.kind);
  if (enemy.kind === KIND_DRIFTER) {
    enemy.y += enemy.speed * dt;
    enemy.x += Math.sin(time * 2.2 + enemy.phase) * 55 * dt;
  } else if (enemy.kind === KIND_WEAVER) {
    enemy.y += enemy.speed * dt;
    enemy.x += Math.sin(time * 5 + enemy.phase) * 190 * dt;
  } else if (enemy.kind === KIND_SPITTER) {
    enemy.y += enemy.speed * dt;
    if (enemy.y > 150) enemy.y = 150 + Math.sin(time * 1.4 + enemy.phase) * 26;
    enemy.fireTimer -= dt;
    if (enemy.fireTimer <= 0 && enemy.y > 0) {
      enemy.fireTimer = 2.6 + random() * 0.8;
      return 'shoot';
    }
  } else if (enemy.kind === KIND_BRUTE) {
    enemy.y += enemy.speed * dt;
    enemy.x += Math.sin(time * 1.1 + enemy.phase) * 30 * dt;
  } else if (enemy.kind === KIND_BOSS) {
    // The boss sinks to its station, then strafes across the top and cycles attacks.
    const station = 110;
    if (!enemy.entered) {
      enemy.y += 60 * dt;
      if (enemy.y >= station) {
        enemy.y = station;
        enemy.entered = true;
      }
      return null;
    }
    enemy.x += Math.sin(time * 0.7 + enemy.phase) * 90 * dt;
    enemy.patternTimer -= dt;
    enemy.fireTimer -= dt;
    if (enemy.patternTimer <= 0) {
      enemy.patternTimer = 3.2;
      return 'radial';
    }
    if (enemy.fireTimer <= 0) {
      enemy.fireTimer = 1.5;
      return 'shoot';
    }
  }
  // Anything that slips past the bottom is gone: dodging past an enemy is a fair
  // way to survive it, and the wave only ends when the sky is actually clear.
  if (enemy.kind !== KIND_BOSS && enemy.y - enemy.radius > FIELD.height) {
    enemy.active = false;
  }
  return null;
}

/** Unit vector from the enemy toward the player, for aimed shots. */
export function aimAt(enemy, player) {
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}
