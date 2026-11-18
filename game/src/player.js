// SOLMAR — Rook on foot: a third-person walker with run, jump, health that
// regrows after five quiet seconds, two weapons and a stolen car. The player
// object owns the body mesh and the driving state; world.js asks it each frame
// whether Rook is walking or driving and where the camera should look.
import * as THREE from 'three';
import { CAR_TUNE, PLAYER_TUNE, SOLMAR, WEAPONS } from './config.js';
import { resolveColliders } from './city.js';
import { makeCarMesh } from './vehicles.js';

export function createPlayer(scene) {
  const group = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x3a5a8c });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc89878 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2c2f36 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 1.05, 10), jacket);
  body.position.y = 1.05;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), skin);
  head.position.y = 1.85;
  head.castShadow = true;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.32, 0.14, 12), pants);
  cap.position.y = 2.08;
  group.add(cap);
  for (const sx of [-0.2, 0.2]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.85, 8), pants);
    leg.position.set(sx, 0.45, 0);
    group.add(leg);
  }
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.5), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  gun.position.set(0.42, 1.25, 0.3);
  group.add(gun);
  scene.add(group);

  return {
    mesh: group,
    x: 40,
    z: 40,
    y: 0,
    vy: 0,
    heading: 0,
    speed: 0,
    health: PLAYER_TUNE.maxHealth,
    sinceDamage: 99,
    weapon: 'pistol',
    ammo: { pistol: { mag: 12, reserve: 60 }, smg: { mag: 30, reserve: 150 } },
    reloadTimer: 0,
    fireTimer: 0,
    inCar: null,
    alive: true,
  };
}

export function playerShootOrigin(player) {
  return new THREE.Vector3(player.x, 1.45, player.z);
}

export function updatePlayerOnFoot(player, walk, camYaw, dt, colliders, jump) {
  const speed = walk.run ? PLAYER_TUNE.runSpeed : PLAYER_TUNE.walkSpeed;
  // Walk input is camera-relative: W walks away from the camera, D strafes
  // right. Forward on screen is (-sin yaw, -cos yaw), right is (cos, -sin).
  const sin = Math.sin(camYaw);
  const cos = Math.cos(camYaw);
  const mx = walk.x * cos + walk.z * sin;
  const mz = -walk.x * sin + walk.z * cos;
  const moving = Math.hypot(walk.x, walk.z) > 0.01;
  const targetSpeed = moving ? speed : 0;
  player.speed += (targetSpeed - player.speed) * Math.min(1, dt * 10);
  if (moving) {
    const wantHeading = Math.atan2(mx, mz);
    let diff = wantHeading - player.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    player.heading += THREE.MathUtils.clamp(diff, -10 * dt, 10 * dt);
  }
  const nx = player.x + Math.sin(player.heading) * player.speed * dt;
  const nz = player.z + Math.cos(player.heading) * player.speed * dt;
  const fixed = resolveColliders(colliders, nx, nz, 0.6);
  player.x = THREE.MathUtils.clamp(fixed.x, -SOLMAR.cityHalf + 4, SOLMAR.cityHalf - 4);
  player.z = THREE.MathUtils.clamp(fixed.z, -SOLMAR.cityHalf + 4, SOLMAR.waterZ - 6);

  // Jump and gravity, landing back on the street.
  if (jump && player.y <= 0.01) player.vy = PLAYER_TUNE.jumpSpeed;
  player.vy -= PLAYER_TUNE.gravity * dt;
  player.y = Math.max(0, player.y + player.vy * dt);
  if (player.y === 0) player.vy = 0;

  // Health regrows after five seconds without damage.
  player.sinceDamage += dt;
  if (player.sinceDamage > PLAYER_TUNE.regenDelay && player.health < PLAYER_TUNE.maxHealth && player.alive) {
    player.health = Math.min(PLAYER_TUNE.maxHealth, player.health + PLAYER_TUNE.regenRate * dt);
  }
  player.mesh.position.set(player.x, player.y, player.z);
  player.mesh.rotation.y = player.heading;
  // A little bob while running so the walk reads on screen.
  const bob = moving ? Math.sin(performance.now() * 0.014) * 0.05 * (player.speed / PLAYER_TUNE.runSpeed) : 0;
  player.mesh.position.y = player.y + Math.abs(bob);
}

export function damagePlayer(player, amount) {
  if (!player.alive) return;
  player.health -= amount;
  player.sinceDamage = 0;
  if (player.health <= 0) {
    player.health = 0;
    player.alive = false;
  }
}

export function enterCar(player, car) {
  player.inCar = car;
  player.mesh.visible = false;
  car.driver = 'player';
}

export function exitCar(player) {
  const car = player.inCar;
  if (!car) return null;
  player.inCar = null;
  player.mesh.visible = true;
  // Step out to the driver's side, clear of the door.
  player.x = car.x - Math.cos(car.heading) * 2.4;
  player.z = car.z + Math.sin(car.heading) * 2.4;
  player.y = 0;
  player.heading = car.heading;
  player.mesh.position.set(player.x, 0, player.z);
  return car;
}

export function spawnPlayerCar(scene, x, z, color, heading = 0) {
  const mesh = makeCarMesh(color);
  scene.add(mesh);
  const car = {
    mesh,
    kind: 'player',
    x,
    z,
    heading,
    speed: 0,
    alive: true,
    driver: null,
    color,
  };
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  return car;
}

export function weaponOf(player) {
  return WEAPONS[player.weapon];
}
