// SOLMAR — the deterministic screenshot scenes behind ?shot=start|drive|
// chase|mission (with &seed=N). Each one plays the real game forward from a
// fresh world for a fixed number of steps, steered by a tiny autopilot that
// points the car at a waypoint, so the frame is what a short real game looks
// like and the same seed always gives the same frame. After staging, main.js
// paints it a few times and sets window.__shotReady.
import * as THREE from 'three';
import { STEP } from './config.js';
import { addWanted } from './police.js';
import { beginMission } from './missions.js';
import { enterCar, spawnPlayerCar } from './player.js';

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function autopilotSteer(car, tx, tz) {
  const want = Math.atan2(tx - car.x, tz - car.z);
  return THREE.MathUtils.clamp(wrapAngle(want - car.heading) * 2, -1, 1);
}

// A scripted input that drives toward a waypoint and never touches a key.
function scriptedInput(world, target) {
  return {
    justPressed: () => false,
    takeClick: () => false,
    mouseHeld: false,
    walk: () => ({ x: 0, z: 0, run: false }),
    drive: () => {
      const car = world.player.inCar;
      if (!car) return { throttle: 0, steer: 0, handbrake: false };
      // Brake for sharp corners, but only while still moving forward: a
      // 34 m/s car cannot turn on a dime, and a wide fast arc wedges it
      // against a building. Never brake below a crawl, or the car reverses.
      const want = Math.atan2(target.x - car.x, target.z - car.z);
      const diff = wrapAngle(want - car.heading);
      return {
        throttle: Math.abs(diff) > 0.9 && car.speed > 2 ? -1 : 1,
        steer: autopilotSteer(car, target.x, target.z),
        handbrake: false,
      };
    },
  };
}

function idleInput() {
  return {
    justPressed: () => false,
    takeClick: () => false,
    mouseHeld: false,
    walk: () => ({ x: 0, z: 0, run: false }),
    drive: () => ({ throttle: 0, steer: 0, handbrake: false }),
  };
}

function stepWorld(world, view, input, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const car = world.player.inCar;
    if (car) view.camYaw = car.heading + Math.PI;
    world.update(STEP, input, view);
  }
}

export function stageShot(name, world, view) {
  const scene = world.scene;
  if (name === 'drive') {
    const car = spawnPlayerCar(scene, 0, -160, 0x2e6bc2, 0);
    enterCar(world.player, car);
    world.state.money = 350;
    stepWorld(world, view, scriptedInput(world, { x: 0, z: 240 }), 4);
    return { screen: 'play', camYaw: car.heading + Math.PI };
  }
  if (name === 'chase') {
    const car = spawnPlayerCar(scene, -80, -80, 0xc23b2e, 0);
    enterCar(world.player, car);
    addWanted(world.police, 3);
    world.state.money = 650;
    stepWorld(world, view, scriptedInput(world, { x: -80, z: 240 }), 5);
    return { screen: 'play', camYaw: car.heading + Math.PI };
  }
  if (name === 'mission') {
    const car = spawnPlayerCar(scene, 0, 160, 0x3aa655, 0);
    enterCar(world.player, car);
    world.missions.index = 1;
    beginMission(world.missions, world);
    world.state.money = 300;
    stepWorld(world, view, scriptedInput(world, { x: 0, z: 315 }), 3);
    return { screen: 'play', camYaw: car.heading + Math.PI };
  }
  // Default: the title screen over a living city.
  world.state.money = 120;
  stepWorld(world, view, idleInput(), 5);
  return { screen: 'title', camYaw: 0 };
}
