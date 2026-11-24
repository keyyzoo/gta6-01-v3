// Screenshot scenes behind ?shot=start|drive|chase|mission (with &seed=N). Each one
// plays the real rules forward from a fresh world for a fixed number of steps, steered
// by scripted inputs, so the frame is what real play looks like and the same seed
// always gives the same frame.
import { STEP } from './config.js';

function settle(renderer, world, seconds) {
  let t = 0;
  for (let i = 0; i < Math.ceil(seconds / STEP); i += 1) {
    t += STEP;
    renderer.sync(world, STEP, t);
  }
  renderer.drawMinimap(world);
}

function driveSteps(world, seconds, steerFn) {
  const steps = Math.ceil(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const steer = steerFn ? steerFn(i * STEP) : 0;
    world.step(STEP, { x: steer, y: 1, sprint: false });
  }
}

function idleSteps(world, seconds) {
  const steps = Math.ceil(seconds / STEP);
  for (let i = 0; i < steps; i += 1) world.step(STEP, { x: 0, y: 0, sprint: false });
}

/**
 * Set `world` to the named scene and return the screen to show over it.
 * Screens: 'title' | 'play'.
 */
export function stageShot(name, world, renderer) {
  world.reset();
  if (name === 'drive') {
    world.enterCar();
    driveSteps(world, 7, () => 0);
    settle(renderer, world, 1.5);
    return { screen: 'play' };
  }
  if (name === 'chase') {
    world.enterCar();
    world.addWanted(3);
    driveSteps(world, 6, (t) => Math.sin(t * 0.5) * 0.12);
    settle(renderer, world, 1.5);
    return { screen: 'play' };
  }
  if (name === 'mission') {
    // Drive the player's car up the road toward the first job marker so the
    // gold beacon is in frame ahead, stopping short of the target.
    const car = world.state.car;
    car.x = 72; car.z = -40; car.angle = Math.PI;
    world.state.player.x = car.x;
    world.state.player.z = car.z;
    world.state.player.angle = car.angle;
    world.enterCar();
    driveSteps(world, 1.5, () => 0);
    settle(renderer, world, 1.5);
    return { screen: 'play' };
  }
  // Default: title screen over a living city.
  idleSteps(world, 5);
  settle(renderer, world, 1.5);
  return { screen: 'title' };
}
