// The screenshot scenes behind ?shot=start|play|boss|win. Each one plays the real
// rules forward from a fresh world with the autopilot, so the frame is what a short
// game really looks like and the same seed always gives the same frame. The boss and
// win scenes first try a full playthrough; if the pilot falls short, they stage the
// final wave directly and let the pilot fight it out there.

import { FIELD, STEP } from './config.js';
import { EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { createAutopilot } from './autopilot.js';

const START_SECONDS = 5;
// The busiest moment of the early game: wave 3 mid-spawn, seven enemies up,
// enemy bullets in the air, and the ship firing.
const PLAY_SECONDS = 40;
// Eight seconds into the final boss: the heart is hurt but alive, its bar half
// gone, radials on screen. Longer and the pilot kills it before the shutter.
const BOSS_SECONDS = 8;
const MAX_RUN_SECONDS = 600;

/** Run the pilot until `until(state)` is true, the run ends, or the budget runs out. */
function runPilot(world, autopilot, seconds, until) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const state = world.state;
    if (state.over || state.won) break;
    if (until && until(state)) break;
    const move = autopilot.steer(state);
    world.step(STEP, move.x, move.y, false, move.bomb);
  }
}

/** Play waves 1..9 with the pilot and stop once the final boss is on screen. */
function reachBoss(world, autopilot) {
  runPilot(world, autopilot, MAX_RUN_SECONDS, (state) => state.boss !== null && state.wave >= 10);
  return world.state.boss !== null && world.state.wave >= 10;
}

export function stageShot(name, world) {
  const autopilot = createAutopilot();
  if (name === 'play') {
    world.reset(false);
    runPilot(world, autopilot, PLAY_SECONDS);
    const over = world.state.over;
    return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'boss') {
    world.reset(true);
    if (!reachBoss(world, autopilot)) {
      // The pilot fell short on the way: stage the final wave directly.
      world.reset(true);
      world.startWave(10);
      runPilot(world, autopilot, 2.5, (state) => state.boss !== null);
    }
    runPilot(world, autopilot, BOSS_SECONDS);
    const over = world.state.over;
    return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'win') {
    world.reset(true);
    runPilot(world, autopilot, MAX_RUN_SECONDS);
    if (!world.state.won) {
      // Same fallback: stage the final wave and let the pilot finish the boss.
      world.reset(true);
      world.startWave(10);
      runPilot(world, autopilot, 2.5, (state) => state.boss !== null);
      runPilot(world, autopilot, 60);
    }
    return { screen: world.state.won ? SCREEN_WIN : SCREEN_OVER, best: world.state.score };
  }
  // Anything else is the title: the game plays harmlessly behind it.
  world.reset(false);
  for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, 0, 0, true, false);
  return { screen: SCREEN_TITLE, best: 0 };
}
