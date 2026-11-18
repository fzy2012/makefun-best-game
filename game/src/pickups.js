// Pickups: what enemies drop and what each one does. Spread widens the gun for a
// while, shield eats the next hit, repair gives back one hull, and a star is pure score.

import { FIELD, PICKUP } from './config.js';

export const PICK_SPREAD = 'spread';
export const PICK_SHIELD = 'shield';
export const PICK_REPAIR = 'repair';
export const PICK_STAR = 'star';

const LETTERS = {
  [PICK_SPREAD]: 'S',
  [PICK_SHIELD]: 'H',
  [PICK_REPAIR]: '+',
  [PICK_STAR]: '★',
};

const COLORS = {
  [PICK_SPREAD]: '#37e6ff',
  [PICK_SHIELD]: '#7dff8a',
  [PICK_REPAIR]: '#ff7d9c',
  [PICK_STAR]: '#ffd34d',
};

/** Roll what an enemy drops: nothing most of the time, else one of the four. */
export function rollDrop(random) {
  if (random() > PICKUP.dropChance) return null;
  const roll = random();
  if (roll < 0.34) return PICK_SPREAD;
  if (roll < 0.58) return PICK_SHIELD;
  if (roll < 0.78) return PICK_REPAIR;
  return PICK_STAR;
}

export function spawnPickup(slot, kind, x, y) {
  slot.active = true;
  slot.kind = kind;
  slot.x = x;
  slot.y = y;
  slot.radius = PICKUP.radius;
  slot.phase = 0;
  return slot;
}

export function pickupLetter(kind) {
  return LETTERS[kind];
}

export function pickupColor(kind) {
  return COLORS[kind];
}

export function stepPickup(slot, dt) {
  if (!slot.active) return;
  slot.y += PICKUP.fallSpeed * dt;
  slot.phase += dt * 4;
  if (slot.y - slot.radius > FIELD.height) slot.active = false;
}
