// The wanted system and the Solmar PD. Stars rise with crimes (stealing a car, hitting a
// pedestrian, shooting, killing a cop) and cool down when Rook stays quiet and unseen. Police
// cars spawn at the city edge and ram the player's car; foot cops chase on foot and punch.
// Each police unit has health: a battered car stalls and is abandoned.
import * as THREE from 'three';
import { COMBAT, POLICE, WANTED } from './config.js';
import { createCar, driveCar } from './vehicles.js';

export function createPolice() {
  return {
    stars: 0,
    quietTimer: 0,
    cars: [],
    cops: [],
    spawnTimer: 0,
  };
}

/** A crime: raise the wanted level and reset the quiet timer. */
export function addCrime(police, amount, audio) {
  const before = Math.floor(police.stars);
  police.stars = Math.min(5, police.stars + amount);
  police.quietTimer = 0;
  if (Math.floor(police.stars) > before && audio) audio.wantedUp();
}

/** Foot cop: a dark-uniform figure with a cap and swinging legs. */
function makeCopMesh() {
  const group = new THREE.Group();
  const uniform = new THREE.MeshLambertMaterial({ color: '#1c2733' });
  const skin = new THREE.MeshLambertMaterial({ color: '#d9a06c' });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.7, 4, 10), uniform);
  body.position.y = 1.05;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), skin);
  head.position.y = 1.82;
  group.add(head);
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.14, 12), new THREE.MeshLambertMaterial({ color: '#101820' }));
  hat.position.y = 2.02;
  group.add(hat);
  const legGeo = new THREE.BoxGeometry(0.22, 0.62, 0.22);
  const legL = new THREE.Mesh(legGeo, uniform);
  legL.position.set(-0.18, 0.31, 0);
  group.add(legL);
  const legR = new THREE.Mesh(legGeo, uniform);
  legR.position.set(0.18, 0.31, 0);
  group.add(legR);
  return { group, legL, legR };
}

function spawnPoliceCar(police, px, pz, random) {
  const angle = random() * Math.PI * 2;
  const x = px + Math.cos(angle) * POLICE.spawnRange;
  const z = pz + Math.sin(angle) * POLICE.spawnRange;
  const car = createCar({ x, z, heading: Math.atan2(px - x, pz - z), color: 0xf4f6f7, kind: 'police' });
  car.hp = COMBAT.copHp;
  police.cars.push(car);
  return car;
}

function spawnCop(police, px, pz, random) {
  const angle = random() * Math.PI * 2;
  const { group, legL, legR } = makeCopMesh();
  const cop = {
    x: px + Math.cos(angle) * 12,
    z: pz + Math.sin(angle) * 12,
    heading: 0,
    hp: COMBAT.copHp,
    punchCooldown: 0,
    walkPhase: random() * 6,
    mesh: group,
    legL,
    legR,
  };
  police.cops.push(cop);
  return cop;
}

/**
 * One step: cool the wanted level, keep the right number of units in the field, and steer
 * every unit at the player. `target` is {x, z, inCar} and `onDamagePlayer` is called with the
 * damage a cop's punch lands.
 */
export function updatePolice(police, target, dt, random, onDamagePlayer, scene) {
  police.quietTimer += dt;
  if (police.quietTimer > WANTED.quietSeconds && police.stars > 0) {
    police.stars = Math.max(0, police.stars - WANTED.coolRate * dt);
  }
  const want = Math.ceil(police.stars);
  police.spawnTimer -= dt;
  const live = police.cars.filter((c) => !c.dead).length + police.cops.filter((c) => c.hp > 0).length;
  if (want > live && police.spawnTimer <= 0) {
    police.spawnTimer = 2.5;
    if (target.inCar || random() < 0.6) {
      const car = spawnPoliceCar(police, target.x, target.z, random);
      scene.add(car.mesh);
    } else {
      const cop = spawnCop(police, target.x, target.z, random);
      scene.add(cop.mesh);
    }
  }
  // Police cars: steer at the player and ram; a far-away car gives up and vanishes. A car
  // wedged against a building for a while is moved back onto a road near the player. After a
  // ram the car backs off for a second instead of pinning the player against a wall.
  for (const car of police.cars) {
    if (car.dead) continue;
    if (car.ramCooldown > 0) {
      car.ramCooldown -= dt;
      driveCar(car, -0.9, 0, dt);
      continue;
    }
    const dx = target.x - car.x;
    const dz = target.z - car.z;
    const dist = Math.hypot(dx, dz);
    if (dist > POLICE.despawnRange) {
      car.dead = true;
      car.mesh.visible = false;
      continue;
    }
    if (Math.abs(car.speed) < 1.5) {
      car.stuckTime = (car.stuckTime ?? 0) + dt;
      if (car.stuckTime > 2.5) {
        car.stuckTime = 0;
        const angle = random() * Math.PI * 2;
        car.x = target.x + Math.cos(angle) * 55;
        car.z = target.z + Math.sin(angle) * 55;
        car.heading = Math.atan2(target.x - car.x, target.z - car.z);
        car.speed = 8;
      }
    } else {
      car.stuckTime = 0;
    }
    const wantHeading = Math.atan2(dx, dz);
    let diff = wantHeading - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, diff * 1.8));
    const throttle = car.speed < POLICE.carSpeed ? 1 : 0.4;
    driveCar(car, throttle, steer, dt);
    // Flash the light bar.
    const phase = Math.floor(performance.now() / 180) % 2 === 0;
    if (car.lightRed) car.lightRed.visible = phase;
    if (car.lightBlue) car.lightBlue.visible = !phase;
  }
  // Foot cops: run at the player and punch in range.
  for (const cop of police.cops) {
    if (cop.hp <= 0) continue;
    const dx = target.x - cop.x;
    const dz = target.z - cop.z;
    const dist = Math.hypot(dx, dz);
    if (dist > POLICE.despawnRange) {
      cop.hp = 0;
      cop.mesh.visible = false;
      continue;
    }
    cop.heading = Math.atan2(dx, dz);
    if (dist > POLICE.punchRange) {
      cop.x += (dx / dist) * POLICE.footSpeed * dt;
      cop.z += (dz / dist) * POLICE.footSpeed * dt;
      cop.walkPhase += dt * 11;
      cop.legL.rotation.x = Math.sin(cop.walkPhase) * 0.6;
      cop.legR.rotation.x = -Math.sin(cop.walkPhase) * 0.6;
    } else if (cop.punchCooldown <= 0) {
      cop.punchCooldown = 1.1;
      onDamagePlayer(POLICE.punchDamage);
    }
    if (cop.punchCooldown > 0) cop.punchCooldown -= dt;
  }
  // Sweep the dead out of the lists (their meshes stay hidden in the scene).
  police.cars = police.cars.filter((c) => !c.dead || c.mesh.visible);
  police.cops = police.cops.filter((c) => c.hp > 0 || c.mesh.visible);
}
