// NEON VOID — every tuning number and colour in one place. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule below depends
// on the screen size. Waves run 1..10; wave 10 ends with the VOID HEART, and beating it
// wins the game.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** How many waves a run lasts; the last wave is the boss wave and the win. */
export const FINAL_WAVE = 10;

export const PLAYER = {
  radius: 14,
  speed: 460,
  /** Seconds of mercy after a hit, and the seconds a fresh shield lasts. */
  invulnerable: 1.6,
  /** Hull points; a hit takes one, a repair pickup gives one back. */
  hull: 3,
  /** Bombs carried at the start of a run; a bomb clears every enemy bullet. */
  bombs: 2,
  /** Shots a second at weapon level 1; each level adds this much. */
  fireInterval: 0.16,
  fireIntervalPerLevel: -0.018,
  /** Fastest the gun ever fires. */
  fireIntervalMin: 0.07,
  bulletSpeed: 800,
};

export const BULLET = {
  playerRadius: 4,
  enemyRadius: 6,
  /** Enemy bullets are slower than the player's so they stay dodgeable. */
  enemySpeed: 215,
};

/** Enemy kinds. Each one flies, shoots or charges in its own way. */
export const ENEMY = {
  drifter: { radius: 18, hp: 1, speed: 95, score: 50, color: '#ff4fd8', core: '#ffd7f5' },
  weaver: { radius: 15, hp: 2, speed: 150, score: 80, color: '#ff9f2e', core: '#ffe9c4' },
  spitter: { radius: 19, hp: 2, speed: 70, score: 120, color: '#ffe14d', core: '#fff7c4' },
  brute: { radius: 30, hp: 8, speed: 48, score: 250, color: '#ff5252', core: '#ffc4c4' },
};

export const BOSS = {
  radius: 64,
  /** Health of the wave 5 warden and the final VOID HEART. */
  wardenHp: 60,
  heartHp: 160,
  speed: 42,
  score: 2000,
  color: '#b14dff',
  core: '#eadcff',
};

/** One wave's spawn plan: what flies in, how fast, and what the banner says. */
export const WAVES = [
  { drifters: 6, weavers: 0, spitters: 0, brutes: 0, interval: 1.1, banner: 'WAVE 1 — THEY COME' },
  { drifters: 8, weavers: 3, spitters: 0, brutes: 0, interval: 1.0, banner: 'WAVE 2 — WEAVERS' },
  { drifters: 8, weavers: 5, spitters: 2, brutes: 0, interval: 0.9, banner: 'WAVE 3 — SPITTERS' },
  { drifters: 10, weavers: 6, spitters: 4, brutes: 1, interval: 0.85, banner: 'WAVE 4 — BRUTES' },
  { drifters: 0, weavers: 0, spitters: 0, brutes: 0, interval: 1.0, boss: 'warden', banner: 'WAVE 5 — THE WARDEN' },
  { drifters: 12, weavers: 7, spitters: 5, brutes: 2, interval: 0.8, banner: 'WAVE 6 — THE SWARM' },
  { drifters: 11, weavers: 8, spitters: 5, brutes: 2, interval: 0.75, banner: 'WAVE 7 — CROSSFIRE' },
  { drifters: 12, weavers: 9, spitters: 6, brutes: 3, interval: 0.7, banner: 'WAVE 8 — NO MERCY' },
  { drifters: 14, weavers: 10, spitters: 7, brutes: 3, interval: 0.65, banner: 'WAVE 9 — THE LAST LINE' },
  { drifters: 0, weavers: 0, spitters: 0, brutes: 0, interval: 1.0, boss: 'heart', banner: 'FINAL WAVE — VOID HEART' },
];

/** Pickups enemies drop: spread shot, shield, repair, and a score star. */
export const PICKUP = {
  radius: 13,
  fallSpeed: 120,
  /** Chance an enemy drops something at all. */
  dropChance: 0.2,
  /** Seconds a spread-shot level lasts before it decays one step. */
  spreadTime: 20,
};

export const PARTICLE = { max: 320, sparkLife: 0.55, emberLife: 0.9 };

/** Pool sizes; everything is allocated once, at boot, and reused. */
export const POOLS = { enemies: 48, playerBullets: 96, enemyBullets: 160, pickups: 24, texts: 24 };

export const PALETTE = {
  backdrop: '#05060f',
  nebulaA: '#1a0b2e',
  nebulaB: '#0b1e3a',
  nebulaC: '#2e0b1e',
  star: '#dfe8ff',
  player: '#37e6ff',
  playerCore: '#e8fbff',
  bullet: '#8ef1ff',
  enemyBullet: '#ff5d7a',
  text: '#eef4ff',
  muted: '#9aa7c7',
  gold: '#ffd34d',
  danger: '#ff5252',
  panel: '#0a0e22',
  panelEdge: '#37e6ff',
};

export const FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'neon-void.best';
