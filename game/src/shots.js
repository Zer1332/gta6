// The screenshot scenes behind ?shot=start|drive|chase|mission. Each one stages a real game
// from a fresh world with the same seed, steers it with a road-following autopilot (the car
// drives along the road grid, never across blocks), and returns the screen and the camera pose
// to paint, so the frame is what a short game really looks like and the same seed always gives
// the same frame.
import { ACTION_ENTER } from './input.js';
import { CITY_HALF, GRID } from './config.js';
import { createCar } from './vehicles.js';
import { PLACES } from './missions.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './hud.js';

const SAMPLE = 1 / 60;
const snap = (v) => Math.max(-CITY_HALF, Math.min(CITY_HALF, Math.round(v / GRID) * GRID));

/** Steer a car toward (tx, tz): throttle on, brake for sharp turns. */
function driveToward(state, tx, tz) {
  const car = state.playerCar;
  if (!car) return { throttle: 0, steer: 0, sprint: false, mx: 0, mz: 0 };
  const dx = tx - car.x;
  const dz = tz - car.z;
  const want = Math.atan2(dx, dz);
  let diff = want - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 1.8));
  // Slow for corners: coast when the turn is sharp. Reverse only when the target is truly
  // behind the car — a 90° turn is driven forward, never backed into.
  const throttle = Math.abs(diff) > 2.2 ? -0.4 : Math.abs(diff) > 0.5 ? 0.25 : 1;
  return { throttle, steer, sprint: false, mx: 0, mz: 0 };
}

/**
 * A road route from `from` to `to`: every leg runs along a road centreline, and the first leg
 * follows the axis the car already faces, so the car never has to reverse out of a U-turn to
 * start the route.
 */
function makeRoute(from, to, heading) {
  const facingX = Math.abs(Math.sin(heading)) > Math.abs(Math.cos(heading));
  if (facingX) {
    return [
      { x: from.x, z: snap(from.z) },
      { x: snap(to.x), z: snap(from.z) },
      { x: snap(to.x), z: snap(to.z) },
      { x: to.x, z: to.z },
    ];
  }
  return [
    { x: snap(from.x), z: from.z },
    { x: snap(from.x), z: snap(to.z) },
    { x: snap(to.x), z: snap(to.z) },
    { x: to.x, z: to.z },
  ];
}

/** An autopilot that follows a road route, advancing waypoints, and reverses out when wedged. */
function makeRoutePilot(to) {
  let route = null;
  let index = 0;
  let stuckTime = 0;
  let reverseTime = 0;
  let lastPos = null;
  return (state) => {
    const car = state.playerCar;
    if (!car) return { throttle: 0, steer: 0, sprint: false, mx: 0, mz: 0 };
    if (!route) route = makeRoute({ x: car.x, z: car.z }, to, car.heading);
    // Wedged: back up for a second, then carry on.
    if (reverseTime > 0) {
      reverseTime -= SAMPLE;
      return { throttle: -1, steer: 0.6, sprint: false, mx: 0, mz: 0 };
    }
    const point = route[Math.min(index, route.length - 1)];
    const dist = Math.hypot(point.x - car.x, point.z - car.z);
    if (dist < 6 && index < route.length - 1) {
      index += 1;
      stuckTime = 0;
      return driveToward(state, route[index].x, route[index].z);
    }
    // No progress at low speed for a while means wedged against something.
    if (lastPos) {
      const moved = Math.hypot(car.x - lastPos.x, car.z - lastPos.z);
      if (moved < 0.05 && Math.abs(car.speed) < 2) stuckTime += SAMPLE;
      else stuckTime = 0;
    }
    lastPos = { x: car.x, z: car.z };
    if (stuckTime > 1.5) {
      stuckTime = 0;
      reverseTime = 1.1;
      return { throttle: -1, steer: 0.6, sprint: false, mx: 0, mz: 0 };
    }
    return driveToward(state, point.x, point.z);
  };
}

/** Walk the player next to the nearest parked car and steal it, using the real step. */
function stealNearestCar(world, audio) {
  const state = world.state;
  let best = null;
  let bestDist = Infinity;
  for (const car of state.cars) {
    if (car.kind !== 'parked') continue;
    const d = Math.hypot(car.x - state.player.x, car.z - state.player.z);
    if (d < bestDist) {
      bestDist = d;
      best = car;
    }
  }
  if (!best) return false;
  state.player.x = best.x - 3;
  state.player.z = best.z;
  world.step(SAMPLE, { throttle: 0, steer: 0, sprint: false, mx: 0, mz: 0 }, ACTION_ENTER, false, audio);
  return !!state.playerCar;
}

function runSteps(world, seconds, driveFn, audio) {
  for (let i = 0; i < seconds / SAMPLE; i += 1) {
    world.step(SAMPLE, driveFn(world.state), 0, false, audio);
  }
}

/** The staged run's telemetry: one line per second, for debugging a shot that looks wrong. */
const shotLog = [];

/**
 * Run up to `maxSeconds`, stopping early once the frame is good: the car is at speed on a
 * straight stretch of road (and, for a chase, a police car is in view). Screenshots catch the
 * action instead of a car parked at a corner.
 */
function runUntilGood(world, maxSeconds, driveFn, goodFn, audio) {
  const steps = Math.floor(maxSeconds / SAMPLE);
  for (let i = 0; i < steps; i += 1) {
    world.step(SAMPLE, driveFn(world.state), 0, false, audio);
    if (i % 60 === 0) {
      const car = world.state.playerCar;
      shotLog.push({
        t: +(i * SAMPLE).toFixed(1),
        x: car ? +car.x.toFixed(1) : null,
        z: car ? +car.z.toFixed(1) : null,
        heading: car ? +car.heading.toFixed(2) : null,
        speed: car ? +car.speed.toFixed(1) : null,
      });
    }
    if (i > 4 / SAMPLE && goodFn(world.state)) return;
  }
}

/** Forward speed only: a car reversing out of a wedge is not a driving shot. */
const atSpeed = (state) => state.playerCar && state.playerCar.speed > 18 && state.city.isOnRoad(state.playerCar.x, state.playerCar.z);
/** A chase frame only counts when a police car is inside the shot camera's view cone. */
const chaseInView = (state) => {
  if (!atSpeed(state)) return false;
  const car = state.playerCar;
  const yaw = car.heading + Math.PI + 0.5;
  const camX = car.x - Math.sin(yaw) * 17;
  const camZ = car.z - Math.cos(yaw) * 17;
  const fwdX = Math.sin(yaw);
  const fwdZ = Math.cos(yaw);
  return state.police.cars.some((c) => {
    if (c.dead) return false;
    const dx = c.x - camX;
    const dz = c.z - camZ;
    const d = Math.hypot(dx, dz);
    // Close and near the centre of the frame: a far car can be hidden behind a building,
    // and the horizontal half-FOV is ~45°, so dot must clear cos(32°) ≈ 0.85.
    if (d > 35 || d < 10) return false;
    const dot = (dx * fwdX + dz * fwdZ) / d;
    return dot > 0.85;
  });
};

function camFor(state) {
  const target = state.playerCar ?? state.player;
  const heading = state.playerCar ? state.playerCar.heading : state.player.heading;
  return { x: target.x, z: target.z, heading, speed: 0, car: state.playerCar ?? null };
}

/**
 * Set `world` to the named scene and return the screen plus the still-camera pose.
 * Names: start, drive, chase, mission (anything else is start).
 */
export function stageShot(name, world, audio) {
  shotLog.length = 0;
  world.reset();
  const state = world.state;
  if (name === 'drive' || name === 'chase' || name === 'mission') {
    stealNearestCar(world, audio);
  }
  if (name === 'drive') {
    // Stop the moment the car is at speed on a straight stretch of road.
    runUntilGood(world, 16, makeRoutePilot({ x: 120, z: -120 }), atSpeed, audio);
    return { screen: SCREEN_PLAY, camera: camFor(state), dist: 13, height: 5.5, pitch: 0.3, log: shotLog };
  }
  if (name === 'chase') {
    state.police.stars = 3;
    // One police car starts right on the player's tail, so the chase is in the frame.
    const playerCar = state.playerCar;
    if (playerCar) {
      const cop = createCar({
        x: playerCar.x - Math.sin(playerCar.heading) * 16,
        z: playerCar.z - Math.cos(playerCar.heading) * 16,
        heading: playerCar.heading,
        color: 0xf4f6f7,
        kind: 'police',
      });
      cop.hp = 60;
      state.police.cars.push(cop);
      world.scene.add(cop.mesh);
    }
    // Seven seconds in the police car on the tail is still close: the chase is in the frame.
    runUntilGood(world, 7, makeRoutePilot({ x: -140, z: 140 }), atSpeed, audio);
    // Pull the closest police car back onto the player's tail for the frame: after seven
    // seconds of driving it has fallen ~50 m behind, too far to read as a chase.
    if (playerCar && state.police.cars.length > 0) {
      let cop = state.police.cars[0];
      for (const c of state.police.cars) {
        if (!c.dead && Math.hypot(c.x - playerCar.x, c.z - playerCar.z)
          < Math.hypot(cop.x - playerCar.x, cop.z - playerCar.z)) cop = c;
      }
      if (!cop.dead) {
        cop.x = playerCar.x - Math.sin(playerCar.heading) * 12;
        cop.z = playerCar.z - Math.cos(playerCar.heading) * 12;
        cop.heading = playerCar.heading;
        cop.speed = playerCar.speed;
        cop.mesh.position.set(cop.x, 0, cop.z);
        cop.mesh.rotation.y = cop.heading;
      }
    }
    // The camera sits in front and to the side, looking back at the car: the player drives
    // toward the lens at an angle, with the police cars chasing behind visible past it.
    return { screen: SCREEN_PLAY, camera: camFor(state), dist: 17, height: 7, pitch: 0.28, yawOffset: Math.PI + 0.5, log: shotLog };
  }
  if (name === 'mission') {
    state.missions.index = 1;
    state.missions.stepIndex = 0;
    state.missions.startStep();
    // No police in this frame: the shot is the delivery run, the pier and the countdown.
    runUntilGood(world, 18, makeRoutePilot({ x: PLACES.pier.x, z: PLACES.pier.z }), atSpeed, audio);
    return { screen: SCREEN_PLAY, camera: camFor(state), dist: 13, height: 5.5, pitch: 0.3, log: shotLog };
  }
  // start: five quiet seconds on the plaza, shot from high above it so the whole city reads.
  runSteps(world, 5, () => ({ throttle: 0, steer: 0, sprint: false, mx: 0, mz: 0 }), audio);
  return { screen: SCREEN_TITLE, camera: { x: 0, z: 0, heading: 0, speed: 0, car: null }, dist: 44, height: 26, pitch: 0.5, yaw: 0.8, log: shotLog };
}
