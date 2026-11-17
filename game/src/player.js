// Rook on foot: a low-poly figure (capsule body, head, swinging legs) that walks, sprints,
// turns toward the camera's heading and punches. Movement is circle-vs-AABB against the
// city's building footprints, so he slides along walls instead of sticking to them.
import * as THREE from 'three';
import { PLAYER } from './config.js';

export function createPlayerMesh() {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: '#e8b88a' });
  const shirt = new THREE.MeshLambertMaterial({ color: PALETTE_SHIRT });
  const pants = new THREE.MeshLambertMaterial({ color: '#2c3440' });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.7, 4, 10), shirt);
  body.position.y = 1.05;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), skin);
  head.position.y = 1.82;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 12), new THREE.MeshLambertMaterial({ color: '#c0392b' }));
  cap.position.y = 2.02;
  group.add(cap);
  const legGeo = new THREE.BoxGeometry(0.22, 0.62, 0.22);
  const legL = new THREE.Mesh(legGeo, pants);
  legL.position.set(-0.18, 0.31, 0);
  group.add(legL);
  const legR = new THREE.Mesh(legGeo, pants);
  legR.position.set(0.18, 0.31, 0);
  group.add(legR);
  const armGeo = new THREE.BoxGeometry(0.18, 0.6, 0.18);
  const armL = new THREE.Mesh(armGeo, shirt);
  armL.position.set(-0.55, 1.1, 0);
  group.add(armL);
  const armR = new THREE.Mesh(armGeo, shirt);
  armR.position.set(0.55, 1.1, 0);
  group.add(armR);
  return { group, legL, legR, armL, armR };
}

const PALETTE_SHIRT = '#2f6fd0';

export function createPlayer(x, z) {
  const { group, legL, legR, armL, armR } = createPlayerMesh();
  return {
    x, z,
    heading: 0,
    speed: 0,
    walkPhase: 0,
    hp: PLAYER.hp,
    maxHp: PLAYER.hp,
    punchCooldown: 0,
    hurtTimer: 0,
    regenTimer: 0,
    mesh: group,
    legL, legR, armL, armR,
  };
}

/** Move on foot: `mx, mz` is the wish direction (world space), sprint when Shift is held. */
export function movePlayer(player, mx, mz, sprint, dt, colliders) {
  const wish = Math.hypot(mx, mz);
  const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  if (wish > 0.01) {
    const nx = mx / wish;
    const nz = mz / wish;
    player.x += nx * speed * dt;
    player.z += nz * speed * dt;
    player.heading = Math.atan2(nx, nz);
    player.speed = speed;
    player.walkPhase += dt * speed * 1.6;
  } else {
    player.speed = 0;
  }
  // Circle vs building footprints: push out along the shortest axis.
  const r = PLAYER.radius;
  for (const box of colliders) {
    const cx = Math.max(box.x0, Math.min(player.x, box.x1));
    const cz = Math.max(box.z0, Math.min(player.z, box.z1));
    const dx = player.x - cx;
    const dz = player.z - cz;
    const distSq = dx * dx + dz * dz;
    if (distSq >= r * r) continue;
    const dist = Math.sqrt(distSq) || 0.001;
    player.x += (dx / dist) * (r - dist);
    player.z += (dz / dist) * (r - dist);
  }
  player.x = Math.max(-220, Math.min(220, player.x));
  player.z = Math.max(-220, Math.min(260, player.z));
  if (player.punchCooldown > 0) player.punchCooldown -= dt;
  if (player.hurtTimer > 0) player.hurtTimer -= dt;
  // Slow health regen after 5 quiet seconds.
  player.regenTimer += dt;
  if (player.regenTimer > 5 && player.hp < player.maxHp) {
    player.hp = Math.min(player.maxHp, player.hp + 4 * dt);
  }
  // Walk swing.
  const swing = player.speed > 0 ? Math.sin(player.walkPhase) * 0.55 : 0;
  player.legL.rotation.x = swing;
  player.legR.rotation.x = -swing;
  player.armL.rotation.x = -swing * 0.7;
  player.armR.rotation.x = swing * 0.7;
}
