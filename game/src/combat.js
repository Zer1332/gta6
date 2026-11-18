// SOLMAR — combat: pistol and SMG fire from Rook, tracer rounds, and the
// Vulture rivals of the Dockside mission. A shot is a short-lived tracer mesh
// plus a point test against every shootable body within range; rivals answer
// back on a timer when Rook is close. Pedestrians never shoot — they run.
import * as THREE from 'three';
import { RIVAL_HP } from './config.js';

const tracerGeo = new THREE.BoxGeometry(0.06, 0.06, 1.6);
const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });

export function createCombat(scene) {
  const tracers = [];
  for (let i = 0; i < 24; i += 1) {
    const mesh = new THREE.Mesh(tracerGeo, tracerMat);
    mesh.visible = false;
    scene.add(mesh);
    tracers.push({ mesh, life: 0 });
  }
  let nextTracer = 0;
  return {
    fire(from, dir, range) {
      const t = tracers[nextTracer];
      nextTracer = (nextTracer + 1) % tracers.length;
      t.mesh.visible = true;
      t.mesh.position.copy(from).addScaledVector(dir, range / 2);
      t.mesh.lookAt(from.clone().addScaledVector(dir, range));
      t.life = 0.09;
    },
    update(dt) {
      for (const t of tracers) {
        if (t.life > 0) {
          t.life -= dt;
          if (t.life <= 0) t.mesh.visible = false;
        }
      }
    },
  };
}

// Distance from a point to the shot segment; a body counts as hit inside 1 m.
function hitAlongShot(from, dir, range, px, py, pz) {
  const vx = px - from.x;
  const vy = py - from.y;
  const vz = pz - from.z;
  const along = vx * dir.x + vy * dir.y + vz * dir.z;
  if (along < 0 || along > range) return false;
  const cx = from.x + dir.x * along;
  const cy = from.y + dir.y * along;
  const cz = from.z + dir.z * along;
  return Math.hypot(px - cx, py - cy, pz - cz) < 1.1;
}

export function makeRival(scene, x, z) {
  const group = new THREE.Group();
  const red = new THREE.MeshLambertMaterial({ color: 0x8c1f1f });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1c1c22 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 1.1, 10), red);
  body.position.y = 1.05;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), new THREE.MeshLambertMaterial({ color: 0xb98a68 }));
  head.position.y = 1.85;
  group.add(head);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.12, 12), dark);
  band.position.y = 2.05;
  group.add(band);
  for (const sx of [-0.2, 0.2]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.85, 8), dark);
    leg.position.set(sx, 0.45, 0);
    group.add(leg);
  }
  group.position.set(x, 0, z);
  scene.add(group);
  return { mesh: group, x, z, hp: RIVAL_HP, alive: true, shootTimer: 1.5, heading: 0 };
}

export function updateRival(rival, playerPos, dt, onRivalShot) {
  if (!rival.alive) return;
  const dx = playerPos.x - rival.x;
  const dz = playerPos.z - rival.z;
  const dist = Math.hypot(dx, dz);
  rival.heading = Math.atan2(dx, dz);
  rival.mesh.rotation.y = rival.heading;
  if (dist < 26 && dist > 4) {
    // Close in on Rook, but keep a little distance to shoot from.
    rival.x += (dx / dist) * 3.2 * dt;
    rival.z += (dz / dist) * 3.2 * dt;
    rival.mesh.position.set(rival.x, 0, rival.z);
  }
  rival.shootTimer -= dt;
  if (dist < 30 && rival.shootTimer <= 0) {
    rival.shootTimer = 1.4 + (dist % 1) * 0.5;
    onRivalShot(rival);
  }
}

// Test one shot against a list of bodies ({x, z, hp, alive}); returns the hit one.
export function testShot(from, dir, range, bodies) {
  let best = null;
  let bestAlong = Infinity;
  for (const b of bodies) {
    if (!b.alive) continue;
    const vx = b.x - from.x;
    const vz = b.z - from.z;
    const along = vx * dir.x + vz * dir.z;
    if (along < 0 || along > range || along > bestAlong) continue;
    if (hitAlongShot(from, dir, range, b.x, 1.2, b.z)) {
      best = b;
      bestAlong = along;
    }
  }
  return best;
}
