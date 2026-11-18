// SOLMAR — cars: one boxy low-poly build shared by traffic, the player's
// stolen rides and the police, in different colours. Traffic cars follow a
// rectangular loop around one city block, slowing near intersections; police
// cars are the same mesh with a flashing light bar. Driving physics live here
// too: arcade acceleration, steering that bites harder at low speed, a
// handbrake that kills grip, and building colliders that stop a car dead.
import * as THREE from 'three';
import { CAR_TUNE, PALETTE, SOLMAR } from './config.js';
import { hitsCollider, resolveColliders } from './city.js';
import { intRange, pick, range } from './random.js';

const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10);
const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141416 });
const glassMat = new THREE.MeshLambertMaterial({ color: 0x1c2a38 });

export function makeCarMesh(color, police = false) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.72, 4.4), bodyMat);
  body.position.y = 0.62;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.62, 2.2), glassMat);
  cabin.position.set(0, 1.28, -0.25);
  cabin.castShadow = true;
  group.add(cabin);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.4, 0.7), bodyMat);
  nose.position.set(0, 0.55, 2.2);
  group.add(nose);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const sx of [-0.7, 0.7]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.1), lightMat);
    lamp.position.set(sx, 0.62, 2.56);
    group.add(lamp);
  }
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.42, wz);
    group.add(wheel);
    wheels.push(wheel);
  }
  let barRed = null;
  let barBlue = null;
  if (police) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.22, 0.5), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    bar.position.set(0, 1.72, -0.25);
    group.add(bar);
    barRed = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.2, 0.44), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    barRed.position.set(-0.32, 1.86, -0.25);
    group.add(barRed);
    barBlue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.2, 0.44), new THREE.MeshBasicMaterial({ color: 0x2266ff }));
    barBlue.position.set(0.32, 1.86, -0.25);
    group.add(barBlue);
  }
  group.userData.wheels = wheels;
  group.userData.barRed = barRed;
  group.userData.barBlue = barBlue;
  return group;
}

// A car the world drives: position, heading, speed and the loop it follows.
export function makeTrafficCar(scene, rng, colliders) {
  const color = pick(rng, PALETTE.car);
  const mesh = makeCarMesh(color);
  scene.add(mesh);
  const bx = intRange(rng, -4, 3) * SOLMAR.roadGap;
  const bz = intRange(rng, -4, 3) * SOLMAR.roadGap;
  const loop = [
    { x: bx, z: bz },
    { x: bx + SOLMAR.roadGap, z: bz },
    { x: bx + SOLMAR.roadGap, z: bz + SOLMAR.roadGap },
    { x: bx, z: bz + SOLMAR.roadGap },
  ];
  const car = {
    mesh,
    kind: 'traffic',
    x: loop[0].x,
    z: loop[0].z,
    heading: 0,
    speed: range(rng, 7, 11),
    cruise: range(rng, 7, 11),
    loop,
    leg: 1,
    wait: 0,
    alive: true,
    color,
  };
  mesh.position.set(car.x, 0, car.z);
  return car;
}

function steerToward(car, tx, tz, dt, maxSpeed) {
  const dx = tx - car.x;
  const dz = tz - car.z;
  const dist = Math.hypot(dx, dz);
  const want = Math.atan2(dx, dz);
  let diff = want - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.heading += THREE.MathUtils.clamp(diff, -2.4 * dt, 2.4 * dt);
  car.speed = THREE.MathUtils.clamp(car.speed + (maxSpeed - car.speed) * dt * 1.2, 0, maxSpeed);
  car.x += Math.sin(car.heading) * car.speed * dt;
  car.z += Math.cos(car.heading) * car.speed * dt;
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  const spin = car.speed * dt * 2.4;
  for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
  return dist;
}

export function updateTrafficCar(car, dt) {
  if (!car.alive) return;
  const target = car.loop[car.leg];
  const nearCross = Math.min(
    Math.abs(car.x % SOLMAR.roadGap),
    Math.abs(car.z % SOLMAR.roadGap),
  );
  const wantSpeed = nearCross < 9 && car.wait <= 0 ? car.cruise * 0.35 : car.cruise;
  const dist = steerToward(car, target.x, target.z, dt, wantSpeed);
  if (dist < 3) {
    car.leg = (car.leg + 1) % car.loop.length;
    // Deterministic pause: a hash of the car's loop, not Math.random, so a
    // seeded run always pauses at the same corners.
    const h = Math.abs(Math.sin(car.loop[0].x * 12.9898 + car.loop[0].z * 78.233 + car.leg * 3.7));
    if (h < 0.18) car.wait = 1 + h * 10;
  }
  if (car.wait > 0) {
    car.wait -= dt;
    car.speed = Math.max(0, car.speed - 20 * dt);
  }
}

// Player driving: arcade model with building collision and world bounds.
export function driveCar(car, ctl, dt, colliders) {
  const forward = ctl.throttle;
  if (forward > 0) car.speed += CAR_TUNE.accel * dt;
  else if (forward < 0) {
    car.speed -= (car.speed > 0.5 ? CAR_TUNE.brake : CAR_TUNE.accel * 0.6) * dt;
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 6 * dt);
  }
  if (ctl.handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), CAR_TUNE.handbrake * dt);
  const max = CAR_TUNE.maxSpeed;
  const rev = -CAR_TUNE.reverseMax;
  car.speed = THREE.MathUtils.clamp(car.speed, rev, max);
  const steerAmount = ctl.steer * CAR_TUNE.steer * dt * Math.min(1, Math.abs(car.speed) / 8 + 0.25) * Math.sign(car.speed || 1);
  car.heading += steerAmount * (ctl.handbrake ? 1.5 : 1);
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  const hit = hitsCollider(colliders, nx, nz, 1.6);
  if (hit) {
    car.speed *= -0.25;
  } else {
    car.x = THREE.MathUtils.clamp(nx, -SOLMAR.cityHalf + 6, SOLMAR.cityHalf - 6);
    car.z = THREE.MathUtils.clamp(nz, -SOLMAR.cityHalf + 6, SOLMAR.waterZ - 8);
    const fixed = resolveColliders(colliders, car.x, car.z, 1.6);
    car.x = fixed.x;
    car.z = fixed.z;
  }
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  const spin = car.speed * dt * 2.4;
  for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
  return Math.abs(car.speed);
}

export function makePoliceCar(scene) {
  const mesh = makeCarMesh(0x1a1a22, true);
  scene.add(mesh);
  return {
    mesh,
    kind: 'police',
    x: 0,
    z: 0,
    heading: 0,
    speed: 0,
    alive: true,
    flash: 0,
  };
}

export function updatePoliceCar(car, tx, tz, dt, siren) {
  const dist = steerToward(car, tx, tz, dt, CAR_TUNE.policeMaxSpeed);
  car.flash += dt;
  const on = Math.floor(car.flash * 4) % 2 === 0;
  if (car.mesh.userData.barRed) car.mesh.userData.barRed.visible = on;
  if (car.mesh.userData.barBlue) car.mesh.userData.barBlue.visible = !on;
  return dist;
}
