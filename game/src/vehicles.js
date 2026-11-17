// Cars: one box-built low-poly model per car (body, cabin, four wheels, lights), an arcade
// driving model with acceleration, braking, steering that bites less at speed and a little
// drift, and traffic cars that follow the road grid in loops. A car's mesh is its own group so
// the renderer can place it from the physics state each frame.
import * as THREE from 'three';
import { CAR, CITY_HALF, GRID, PALETTE } from './config.js';

let nextId = 1;

function makeCarMesh(color, police) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const darkMat = new THREE.MeshLambertMaterial({ color: '#20242a' });
  const glassMat = new THREE.MeshLambertMaterial({ color: PALETTE.glass });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.62, 4.1), bodyMat);
  body.position.y = 0.55;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.55, 2.1), glassMat);
  cabin.position.set(0, 1.1, -0.25);
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const [wx, wz] of [[-0.85, 1.35], [0.85, 1.35], [-0.85, -1.35], [0.85, -1.35]]) {
    const wheel = new THREE.Mesh(wheelGeo, darkMat);
    wheel.position.set(wx, 0.36, wz);
    group.add(wheel);
    wheels.push(wheel);
  }
  const headMat = new THREE.MeshLambertMaterial({ color: '#fff6c9', emissive: '#ffedb0', emissiveIntensity: 0.9 });
  for (const hx of [-0.6, 0.6]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.08), headMat);
    head.position.set(hx, 0.62, 2.06);
    group.add(head);
  }
  const tailMat = new THREE.MeshLambertMaterial({ color: '#d21f14', emissive: '#d21f14', emissiveIntensity: 0.7 });
  for (const tx of [-0.6, 0.6]) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.08), tailMat);
    tail.position.set(tx, 0.62, -2.06);
    group.add(tail);
  }
  let lightBar = null;
  let lightRed = null;
  let lightBlue = null;
  if (police) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 0.4), darkMat);
    bar.position.set(0, 1.45, -0.25);
    group.add(bar);
    lightRed = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.16, 0.42),
      new THREE.MeshLambertMaterial({ color: '#ff2a1e', emissive: '#ff2a1e', emissiveIntensity: 1.6 }),
    );
    lightRed.position.set(-0.28, 1.45, -0.25);
    group.add(lightRed);
    lightBlue = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.16, 0.42),
      new THREE.MeshLambertMaterial({ color: '#2a6cff', emissive: '#2a6cff', emissiveIntensity: 1.6 }),
    );
    lightBlue.position.set(0.28, 1.45, -0.25);
    group.add(lightBlue);
    lightBar = bar;
  }
  return { group, wheels, lightRed, lightBlue, lightBar };
}

/** A car: physics state plus its mesh. `kind` is 'player' | 'traffic' | 'parked' | 'police'. */
export function createCar({ x, z, heading, color, kind }) {
  const id = nextId;
  nextId += 1;
  const { group, wheels, lightRed, lightBlue } = makeCarMesh(color, kind === 'police');
  const car = {
    id, kind, color,
    x, z, heading,
    speed: 0,
    steer: 0,
    hp: 100,
    dead: false,
    smoke: 0,
    route: null,
    routeIndex: 0,
    cruise: 9 + Math.random() * 3,
    mesh: group,
    wheels,
    lightRed,
    lightBlue,
    /** Waypoint the traffic car is driving toward. */
    target: null,
  };
  return car;
}

/** Arcade driving: throttle -1..1, steer -1..1 (left positive). Returns distance driven.
 * The turn rate is near-constant with speed (a real car turns wider when fast, tighter when
 * slow) and vanishes when stopped, so the car never spins at speed and always feels like it
 * is going where the wheel points. */
export function driveCar(car, throttle, steer, dt) {
  if (car.dead) return 0;
  const speedAbs = Math.abs(car.speed);
  const targetSteer = steer * CAR.steerMax * Math.max(0.3, 1 - speedAbs / (CAR.maxSpeed * 1.5));
  car.steer += (targetSteer - car.steer) * Math.min(1, dt * 8);
  if (throttle > 0) car.speed += CAR.accel * throttle * dt;
  else if (throttle < 0) {
    if (car.speed > 0.5) car.speed -= CAR.brake * dt;
    else car.speed -= CAR.accel * 0.7 * dt;
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 6 * dt);
  }
  car.speed = Math.max(-CAR.reverseMax, Math.min(CAR.maxSpeed, car.speed));
  // Turn rate ~1.5 rad/s at full lock once rolling; reversed when backing up. A little
  // authority remains at low speed, so a car can turn its way out of a tight spot.
  const turnRate = (car.steer / CAR.steerMax) * 1.5 * Math.min(1, Math.abs(car.speed) / 3.5) * (car.speed < 0 ? -1 : 1);
  car.heading += turnRate * dt;
  const slide = Math.abs(car.steer) > CAR.steerMax * 0.85 && Math.abs(car.speed) > 14 ? 0.35 : 0;
  const moveHeading = car.heading + slide * Math.sign(car.steer) * 0.35;
  const dx = Math.sin(moveHeading) * car.speed * dt;
  const dz = Math.cos(moveHeading) * car.speed * dt;
  car.x += dx;
  car.z += dz;
  // Wheels spin with speed; front wheels yaw with the steering.
  const spin = (car.speed * dt) / 0.36;
  for (let i = 0; i < car.wheels.length; i += 1) {
    car.wheels[i].rotation.x += spin;
    if (i < 2) car.wheels[i].rotation.y = car.steer * 0.9;
  }
  return Math.hypot(dx, dz);
}

/** Keep a car inside the city and out of building footprints (circle vs AABB). A head-on hit
 * costs speed; a car sliding along a wall keeps its speed, so it can steer away instead of
 * grinding to a halt against the bricks. */
export function collideCar(car, colliders) {
  car.x = Math.max(-CITY_HALF - 20, Math.min(CITY_HALF + 20, car.x));
  car.z = Math.max(-CITY_HALF - 20, Math.min(CITY_HALF + 60, car.z));
  let hit = false;
  for (const box of colliders) {
    const cx = Math.max(box.x0, Math.min(car.x, box.x1));
    const cz = Math.max(box.z0, Math.min(car.z, box.z1));
    const dx = car.x - cx;
    const dz = car.z - cz;
    const distSq = dx * dx + dz * dz;
    const r = CAR.radius;
    if (distSq >= r * r) continue;
    hit = true;
    const dist = Math.sqrt(distSq) || 0.001;
    const push = (r - dist) / dist;
    car.x += dx * push;
    car.z += dz * push;
    // The push direction is the wall's outward normal; if the car is driving into it, the
    // crash costs speed. Sliding along the wall costs nothing.
    const into = (dx * Math.sin(car.heading) + dz * Math.cos(car.heading)) / dist;
    if (into < -0.3) car.speed *= 0.55;
  }
  return hit;
}

/** Traffic: pick a rectangular loop of road lines and follow it, turning at corners. */
export function assignTrafficRoute(car, random) {
  const lines = [];
  for (let line = -CITY_HALF; line <= CITY_HALF; line += GRID) lines.push(line);
  const pick = () => lines[Math.floor(random() * lines.length)];
  const x1 = pick();
  const x2 = pick();
  const z1 = pick();
  const z2 = pick();
  car.route = [
    { x: x1, z: z1 },
    { x: x2, z: z1 },
    { x: x2, z: z2 },
    { x: x1, z: z2 },
  ];
  car.routeIndex = 0;
  car.x = x1;
  car.z = z1;
  car.target = car.route[0];
}

/** One traffic step: steer toward the current waypoint, slow for corners, advance the route. */
export function updateTraffic(car, dt) {
  if (car.dead || !car.target) return;
  const dx = car.target.x - car.x;
  const dz = car.target.z - car.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 3) {
    car.routeIndex = (car.routeIndex + 1) % car.route.length;
    car.target = car.route[car.routeIndex];
    return;
  }
  const want = Math.atan2(dx, dz);
  let diff = want - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 1.6));
  const slow = Math.abs(diff) > 0.6 ? 0.35 : 1;
  const throttle = car.speed < car.cruise * slow ? 1 : 0;
  driveCar(car, throttle, steer, dt);
}
