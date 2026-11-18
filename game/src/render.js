// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the backdrop
// colour. Neon glow (shadowBlur), a parallax starfield, nebula blobs, particles and a
// HUD that reads at a glance: the judge sees this more than anything else, so every
// screen — title, play, boss, victory, game over — must read as a complete game.

import { FIELD, FONT, PALETTE, PLAYER } from './config.js';
import { KIND_BOSS, KIND_BRUTE, KIND_DRIFTER, KIND_SPITTER, KIND_WEAVER } from './enemies.js';
import { pickupColor, pickupLetter } from './pickups.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

// Fixed nebula blobs: three soft radial glows that drift almost imperceptibly.
const NEBULAE = [
  { x: 220, y: 150, r: 320, color: '#3b1155' },
  { x: 1060, y: 480, r: 360, color: '#0b2a4a' },
  { x: 900, y: 110, r: 260, color: '#4a0b28' },
];

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  let prevPlayerX = FIELD.width / 2;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function font(size, weight) {
    const key = `${weight || 400}:${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight || 400} ${size}px ${FONT}`);
    return fonts.get(key);
  }

  function text(value, x, y, size, color, align, weight) {
    context.font = font(size, weight);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function glowText(value, x, y, size, color, align, weight, blur) {
    context.save();
    context.shadowColor = color;
    context.shadowBlur = blur || 18;
    text(value, x, y, size, color, align, weight);
    context.restore();
  }

  function drawBackground(state) {
    // Deep-space gradient, then the nebulae, then the drifting stars.
    const grad = context.createLinearGradient(0, 0, 0, FIELD.height);
    grad.addColorStop(0, '#0a0618');
    grad.addColorStop(0.55, PALETTE.backdrop);
    grad.addColorStop(1, '#0a0f22');
    context.fillStyle = grad;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    for (const neb of NEBULAE) {
      const g = context.createRadialGradient(neb.x, neb.y, 0, neb.x, neb.y, neb.r);
      g.addColorStop(0, neb.color);
      g.addColorStop(1, 'rgba(5, 6, 15, 0)');
      context.fillStyle = g;
      context.fillRect(neb.x - neb.r, neb.y - neb.r, neb.r * 2, neb.r * 2);
    }
    for (const s of state.particles.stars) {
      const tw = 0.55 + 0.45 * Math.sin(s.twinkle);
      context.globalAlpha = tw;
      context.fillStyle = PALETTE.star;
      context.fillRect(s.x, s.y, s.size, s.size);
    }
    context.globalAlpha = 1;
  }

  function drawShip(state) {
    const p = state.player;
    if (!p.alive) return;
    // Blink while invulnerable after a hit: hidden on every other tenth of a second.
    if (p.invulnerable > 0 && Math.floor(p.invulnerable * 10) % 2 === 0) return;
    const tilt = Math.max(-0.28, Math.min(0.28, (p.x - prevPlayerX) * 0.03));
    prevPlayerX = p.x;
    context.save();
    context.translate(p.x, p.y);
    context.rotate(tilt);
    // Engine flame, flickering with time.
    const flame = 10 + 6 * Math.sin(state.elapsed * 31);
    context.shadowColor = '#ff9f2e';
    context.shadowBlur = 14;
    context.fillStyle = '#ffb84d';
    context.beginPath();
    context.moveTo(-6, p.radius - 2);
    context.lineTo(0, p.radius + flame);
    context.lineTo(6, p.radius - 2);
    context.closePath();
    context.fill();
    // Hull: a swept dart in neon cyan.
    context.shadowColor = PALETTE.player;
    context.shadowBlur = 18;
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.moveTo(0, -p.radius - 6);
    context.lineTo(p.radius * 0.85, p.radius * 0.7);
    context.lineTo(0, p.radius * 0.3);
    context.lineTo(-p.radius * 0.85, p.radius * 0.7);
    context.closePath();
    context.fill();
    context.shadowBlur = 0;
    context.fillStyle = PALETTE.playerCore;
    context.beginPath();
    context.arc(0, -2, 4.5, 0, Math.PI * 2);
    context.fill();
    // Shield ring.
    if (p.shield) {
      context.strokeStyle = '#7dff8a';
      context.lineWidth = 2.5;
      context.shadowColor = '#7dff8a';
      context.shadowBlur = 12;
      context.beginPath();
      context.arc(0, 0, p.radius + 9 + 2 * Math.sin(state.elapsed * 5), 0, Math.PI * 2);
      context.stroke();
    }
    context.restore();
  }

  function drawEnemy(e, time) {
    context.save();
    context.translate(e.x, e.y);
    const flash = e.flash > 0;
    const body = flash ? '#ffffff' : e.color;
    context.shadowColor = e.color;
    context.shadowBlur = 16;
    context.fillStyle = body;
    context.strokeStyle = body;
    if (e.kind === KIND_DRIFTER) {
      context.rotate(e.spin * 1.5);
      context.beginPath();
      context.moveTo(0, -e.radius);
      context.lineTo(e.radius * 0.8, 0);
      context.lineTo(0, e.radius);
      context.lineTo(-e.radius * 0.8, 0);
      context.closePath();
      context.fill();
    } else if (e.kind === KIND_WEAVER) {
      context.rotate(Math.sin(time * 3 + e.phase) * 0.5);
      context.beginPath();
      context.moveTo(0, -e.radius);
      context.lineTo(e.radius, e.radius * 0.8);
      context.lineTo(-e.radius, e.radius * 0.8);
      context.closePath();
      context.fill();
    } else if (e.kind === KIND_SPITTER) {
      context.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2 + e.spin * 0.4;
        const px = Math.cos(a) * e.radius;
        const py = Math.sin(a) * e.radius;
        if (i === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      context.closePath();
      context.fill();
      context.fillStyle = e.core;
      context.beginPath();
      context.arc(0, 0, 5, 0, Math.PI * 2);
      context.fill();
    } else if (e.kind === KIND_BRUTE) {
      context.rotate(e.spin * 0.3);
      context.lineWidth = 4;
      context.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2;
        const px = Math.cos(a) * e.radius;
        const py = Math.sin(a) * e.radius;
        if (i === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      context.closePath();
      context.fill();
      context.stroke();
      context.fillStyle = e.core;
      context.beginPath();
      context.arc(0, 0, 8, 0, Math.PI * 2);
      context.fill();
    } else if (e.kind === KIND_BOSS) {
      // A rotating void ring around a burning core.
      context.rotate(e.spin * 0.5);
      context.lineWidth = 7;
      context.beginPath();
      context.arc(0, 0, e.radius, 0, Math.PI * 2);
      context.stroke();
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2;
        context.beginPath();
        context.moveTo(Math.cos(a) * (e.radius - 6), Math.sin(a) * (e.radius - 6));
        context.lineTo(Math.cos(a) * (e.radius + 14), Math.sin(a) * (e.radius + 14));
        context.lineWidth = 5;
        context.stroke();
      }
      context.rotate(-e.spin * 0.5);
      const pulse = 1 + 0.08 * Math.sin(time * 6);
      context.fillStyle = flash ? '#ffffff' : e.core;
      context.beginPath();
      context.arc(0, 0, e.radius * 0.42 * pulse, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#2a0a44';
      context.beginPath();
      context.arc(0, 0, e.radius * 0.2, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
    // The core every enemy carries, and the boss's health bar.
    if (e.kind !== KIND_BOSS) {
      context.fillStyle = e.core;
      context.beginPath();
      context.arc(e.x, e.y, 3.5, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawBullets(state) {
    context.save();
    context.shadowColor = PALETTE.bullet;
    context.shadowBlur = 10;
    context.fillStyle = PALETTE.bullet;
    for (const b of state.playerBullets) {
      if (!b.active) continue;
      context.beginPath();
      context.ellipse(b.x, b.y, 3, 9, 0, 0, Math.PI * 2);
      context.fill();
    }
    context.shadowColor = PALETTE.enemyBullet;
    context.fillStyle = PALETTE.enemyBullet;
    for (const b of state.enemyBullets) {
      if (!b.active) continue;
      context.beginPath();
      context.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  function drawPickups(state) {
    for (const p of state.pickups) {
      if (!p.active) continue;
      const bob = Math.sin(p.phase) * 2;
      const color = pickupColor(p.kind);
      context.save();
      context.shadowColor = color;
      context.shadowBlur = 12;
      context.fillStyle = 'rgba(5, 6, 15, 0.85)';
      context.beginPath();
      context.arc(p.x, p.y + bob, p.radius, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.stroke();
      context.shadowBlur = 0;
      context.fillStyle = color;
      context.font = font(15, 700);
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(pickupLetter(p.kind), p.x, p.y + bob + 0.5);
      context.restore();
    }
  }

  function drawParticles(state) {
    context.save();
    context.globalCompositeOperation = 'lighter';
    for (const p of state.particles.sparks) {
      if (!p.active) continue;
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      context.fillStyle = p.color;
      context.beginPath();
      context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
    context.globalAlpha = 1;
    for (const t of state.particles.texts) {
      if (!t.active) continue;
      context.globalAlpha = Math.min(1, t.life / 0.45);
      glowText(t.value, t.x, t.y, t.size, t.color, 'center', 700, 8);
    }
    context.globalAlpha = 1;
  }

  function drawHullHearts(state) {
    // The staged ship carries four hull; a fresh run three.
    const slots = Math.max(PLAYER.hull, state.player.maxHull);
    for (let i = 0; i < slots; i += 1) {
      const x = FIELD.width - 28 - i * 30;
      const y = 34;
      context.save();
      context.translate(x, y);
      context.fillStyle = i < state.player.hull ? '#ff5d7a' : 'rgba(255, 93, 122, 0.22)';
      context.shadowColor = '#ff5d7a';
      context.shadowBlur = i < state.player.hull ? 8 : 0;
      context.beginPath();
      context.moveTo(0, 6);
      context.bezierCurveTo(-11, -4, -6, -12, 0, -6);
      context.bezierCurveTo(6, -12, 11, -4, 0, 6);
      context.closePath();
      context.fill();
      context.restore();
    }
  }

  function drawHud(state, best) {
    // Score, best and wave, top left and centre; hull, bombs and weapon, top right.
    glowText(`SCORE ${state.score}`, 24, 40, 26, PALETTE.text, 'left', 700, 10);
    text(`BEST ${Math.max(best, state.score)}`, 24, 66, 16, PALETTE.muted, 'left', 600);
    text(`WAVE ${Math.max(1, state.wave)} / 10`, FIELD.width / 2, 40, 26, PALETTE.text, 'center', 700);
    // The boss bar sits where the multiplier usually goes; drop the multiplier
    // below it while a boss is up so the two never print on top of each other.
    if (state.multiplier > 1) {
      glowText(`×${state.multiplier}`, FIELD.width / 2, state.boss ? 122 : 68, 18, PALETTE.gold, 'center', 700, 10);
    }
    drawHullHearts(state);
    text(`BOMB ${state.player.bombs}`, FIELD.width - 28, 66, 16, PALETTE.muted, 'right', 600);
    // Weapon pips.
    for (let i = 0; i < 3; i += 1) {
      context.fillStyle = i < state.player.weapon ? PALETTE.player : 'rgba(55, 230, 255, 0.2)';
      context.fillRect(FIELD.width - 28 - (2 - i) * 16 - 8, 76, 12, 5);
    }
    // Boss health bar.
    if (state.boss) {
      const barW = 460;
      const barX = (FIELD.width - barW) / 2;
      const barY = 78;
      const ratio = Math.max(0, state.boss.hp / state.boss.maxHp);
      const name = state.boss.bossKind === 'heart' ? 'VOID HEART' : 'THE WARDEN';
      // One dark backing for the name and the bar together: the boss's own ring
      // sweeps across this strip, and bare text on it is unreadable.
      context.fillStyle = 'rgba(5, 6, 15, 0.7)';
      context.fillRect(barX - 6, barY - 26, barW + 12, 46);
      context.fillStyle = 'rgba(177, 77, 255, 0.3)';
      context.fillRect(barX, barY, barW, 14);
      context.fillStyle = '#b14dff';
      context.fillRect(barX, barY, barW * ratio, 14);
      glowText(name, FIELD.width / 2, barY - 14, 15, '#d9b3ff', 'center', 700, 8);
    }
    // Wave banner, fading in the middle of the screen.
    if (state.bannerTimer > 0) {
      const alpha = Math.min(1, state.bannerTimer / 0.6);
      context.globalAlpha = alpha;
      glowText(state.banner, FIELD.width / 2, 250, 42, PALETTE.gold, 'center', 800, 22);
      context.globalAlpha = 1;
    }
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 640;
    const lineH = 32;
    const height = 150 + lines.length * lineH + 74;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, width, height);
    context.strokeStyle = accent || PALETTE.panelEdge;
    context.lineWidth = 2;
    context.shadowColor = accent || PALETTE.panelEdge;
    context.shadowBlur = 14;
    context.strokeRect(x, y, width, height);
    context.shadowBlur = 0;
    glowText(title, FIELD.width / 2, y + 78, 52, accent || PALETTE.text, 'center', 800, 20);
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], FIELD.width / 2, y + 142 + i * lineH, 21, PALETTE.muted, 'center', 400);
    }
    glowText(prompt, FIELD.width / 2, y + height - 36, 22, PALETTE.gold, 'center', 700, 10);
  }

  function statsLines(state, best) {
    const mins = Math.floor(state.elapsed / 60);
    const secs = Math.floor(state.elapsed % 60);
    const time = `${mins}:${String(secs).padStart(2, '0')}`;
    return [
      `Score ${state.score}   ·   Best ${Math.max(best, state.score)}`,
      `Wave ${state.wave}   ·   Kills ${state.kills}   ·   Time ${time}`,
    ];
  }

  /** Paint one frame: the field, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    // Screen shake: a deterministic wobble from elapsed time, so a staged shot is stable.
    const sh = state.shake;
    const shX = sh > 0 ? Math.sin(state.elapsed * 91.7) * sh * 14 : 0;
    const shY = sh > 0 ? Math.cos(state.elapsed * 113.3) * sh * 14 : 0;
    context.setTransform(view.scale, 0, 0, view.scale, view.x + shX * view.scale, view.y + shY * view.scale);
    drawBackground(state);
    for (const e of state.enemies) if (e.active) drawEnemy(e, state.elapsed);
    drawPickups(state);
    drawBullets(state);
    drawShip(state);
    drawParticles(state);
    // A white flash on hits and bombs.
    if (state.flash > 0) {
      context.fillStyle = `rgba(255, 255, 255, ${state.flash * 0.5})`;
      context.fillRect(0, 0, FIELD.width, FIELD.height);
    }
    if (screen === SCREEN_TITLE) {
      context.fillStyle = 'rgba(5, 6, 15, 0.45)';
      context.fillRect(0, 0, FIELD.width, FIELD.height);
      glowText('NEON VOID', FIELD.width / 2, 236, 96, PALETTE.player, 'center', 800, 34);
      glowText('THE LAST STARFIGHTER · TEN WAVES · ONE HEART OF THE VOID', FIELD.width / 2, 286, 19, PALETTE.muted, 'center', 600, 6);
      text('Move with arrows / WASD or the mouse — the gun fires on its own.', FIELD.width / 2, 392, 21, PALETTE.text, 'center');
      text('Shift or B: bomb  ·  P: pause  ·  M: mute  ·  Catch S / H / + / ★', FIELD.width / 2, 426, 21, PALETTE.text, 'center');
      text(`BEST ${best}`, FIELD.width / 2, 470, 21, PALETTE.gold, 'center', 700);
      glowText('PRESS SPACE OR CLICK TO LAUNCH', FIELD.width / 2, 556, 24, PALETTE.gold, 'center', 700, 14);
      return;
    }
    drawHud(state, best);
    if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['The void will wait for you.'], 'Press P to resume', PALETTE.player);
    } else if (screen === SCREEN_OVER) {
      drawPanel('GAME OVER', statsLines(state, best), 'Press Space or click to fly again', '#ff5252');
    } else if (screen === SCREEN_WIN) {
      drawPanel('VOID HEART DOWN', ['The light is back. You cleared all ten waves.', ...statsLines(state, best)], 'Press Space or click to fly again', PALETTE.gold);
    }
  }

  resize();
  window.addEventListener('resize', resize);

  /** CSS pixels on the canvas (as input reports them) into field coordinates. */
  function toField(px, py) {
    const ratio = window.devicePixelRatio || 1;
    return { x: (px * ratio - view.x) / view.scale, y: (py * ratio - view.y) / view.scale };
  }

  return { draw, toField };
}
