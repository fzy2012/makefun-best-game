// Particles, floating score text and the parallax starfield. Everything is pooled:
// the arrays are allocated once at boot and reused, so a frame allocates nothing.
// The starfield drifts on its own and needs no game state.

import { FIELD, PARTICLE } from './config.js';

export function createParticles(random) {
  const sparks = [];
  for (let i = 0; i < PARTICLE.max; i += 1) {
    sparks.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#ffffff' });
  }
  const texts = [];
  for (let i = 0; i < 24; i += 1) {
    texts.push({ active: false, x: 0, y: 0, life: 0, value: '', color: '#ffffff', size: 18 });
  }
  // Three star layers: far (slow, dim), mid, near (fast, bright).
  const stars = [];
  for (let layer = 0; layer < 3; layer += 1) {
    for (let i = 0; i < 46; i += 1) {
      stars.push({
        x: random() * FIELD.width,
        y: random() * FIELD.height,
        speed: 12 + layer * 22,
        size: 0.8 + layer * 0.7,
        twinkle: random() * Math.PI * 2,
      });
    }
  }

  function freeSpark() {
    for (let i = 0; i < sparks.length; i += 1) if (!sparks[i].active) return sparks[i];
    return sparks[0];
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const p = freeSpark();
      const angle = random() * Math.PI * 2;
      const v = speed * (0.3 + random() * 0.7);
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * v;
      p.vy = Math.sin(angle) * v;
      p.maxLife = PARTICLE.sparkLife * (0.6 + random() * 0.7);
      p.life = p.maxLife;
      p.size = 1.5 + random() * 2.5;
      p.color = color;
    }
  }

  function trail(x, y, color) {
    const p = freeSpark();
    p.active = true;
    p.x = x + (random() - 0.5) * 6;
    p.y = y;
    p.vx = (random() - 0.5) * 30;
    p.vy = 60 + random() * 60;
    p.maxLife = PARTICLE.emberLife * 0.5;
    p.life = p.maxLife;
    p.size = 1.5 + random() * 2;
    p.color = color;
  }

  function floatText(x, y, value, color, size) {
    for (let i = 0; i < texts.length; i += 1) {
      if (texts[i].active) continue;
      texts[i].active = true;
      texts[i].x = x;
      texts[i].y = y;
      texts[i].life = 0.9;
      texts[i].value = value;
      texts[i].color = color;
      texts[i].size = size || 18;
      return;
    }
  }

  function step(dt) {
    for (let i = 0; i < sparks.length; i += 1) {
      const p = sparks[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 1.6 * dt;
      p.vy *= 1 - 1.6 * dt;
    }
    for (let i = 0; i < texts.length; i += 1) {
      const t = texts[i];
      if (!t.active) continue;
      t.life -= dt;
      t.y -= 34 * dt;
      if (t.life <= 0) t.active = false;
    }
    for (let i = 0; i < stars.length; i += 1) {
      const s = stars[i];
      s.y += s.speed * dt;
      s.twinkle += dt * 2;
      if (s.y > FIELD.height + 2) {
        s.y = -2;
        s.x = random() * FIELD.width;
      }
    }
  }

  return { sparks, texts, stars, burst, trail, floatText, step };
}
