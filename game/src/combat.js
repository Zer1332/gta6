// Combat: Rook's fists and his pistol, and the people who shoot back. Shooting is a hitscan
// against the nearest living person or police car in front of the aim within range; a tracer
// line and a muzzle flash show where it went. Rivals and cops return fire at a slow rate with
// poor aim. Pedestrians never fight: they run away.
import * as THREE from 'three';
import { COMBAT, PLAYER } from './config.js';

export function createCombat(scene) {
  // One reusable tracer line, shown briefly after each shot.
  const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0 });
  const tracerGeo = new THREE.BufferGeometry();
  tracerGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const tracer = new THREE.Line(tracerGeo, tracerMat);
  tracer.frustumCulled = false;
  scene.add(tracer);
  return {
    shootCooldown: 0,
    tracerTimer: 0,
    tracer,
    tracerMat,
    shotsFired: 0,
    shotsHit: 0,
    /** A rival or cop that can shoot back: {x, z, hp, shootTimer, mesh}. */
    enemies: [],
  };
}

/** A Vulture rival: a red-jacketed figure with a pistol, guarding the dockside. */
export function makeRivalMesh() {
  const group = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: '#a93226' });
  const skin = new THREE.MeshLambertMaterial({ color: '#c98d5f' });
  const pants = new THREE.MeshLambertMaterial({ color: '#1f242b' });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.7, 4, 10), jacket);
  body.position.y = 1.05;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), skin);
  head.position.y = 1.82;
  group.add(head);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 12), new THREE.MeshLambertMaterial({ color: '#1f242b' }));
  band.position.y = 2.0;
  group.add(band);
  const legGeo = new THREE.BoxGeometry(0.22, 0.62, 0.22);
  for (const sx of [-0.18, 0.18]) {
    const leg = new THREE.Mesh(legGeo, pants);
    leg.position.set(sx, 0.31, 0);
    group.add(leg);
  }
  return group;
}

/**
 * Fire the pistol from `from` toward `aimDir` (a normalised {x, z}). Hits the nearest living
 * target in a narrow cone within range. Returns the target hit, or null.
 */
export function shoot(combat, from, aimDir, targets, audio) {
  if (combat.shootCooldown > 0) return null;
  combat.shootCooldown = COMBAT.pistolRate;
  combat.shotsFired += 1;
  if (audio) audio.shoot();
  const range = COMBAT.pistolRange;
  let best = null;
  let bestDist = range;
  for (const target of targets) {
    if (!target || target.hp <= 0 || target.dead) continue;
    const dx = target.x - from.x;
    const dz = target.z - from.z;
    const dist = Math.hypot(dx, dz);
    if (dist > range || dist < 0.5) continue;
    // Must be roughly in front of the aim (within ~26 degrees): forgiving on purpose,
    // so a chase-camera shot at a moving target can actually land.
    const dot = (dx * aimDir.x + dz * aimDir.z) / dist;
    if (dot < 0.9) continue;
    if (dist < bestDist) {
      bestDist = dist;
      best = target;
    }
  }
  // Tracer from the muzzle to the hit point (or to full range).
  const endX = from.x + aimDir.x * bestDist;
  const endZ = from.z + aimDir.z * bestDist;
  const pos = combat.tracer.geometry.attributes.position;
  pos.setXYZ(0, from.x, 1.4, from.z);
  pos.setXYZ(1, endX, 1.3, endZ);
  pos.needsUpdate = true;
  combat.tracerMat.opacity = 0.9;
  combat.tracerTimer = 0.07;
  if (best) {
    best.hp -= COMBAT.pistolDamage;
    combat.shotsHit += 1;
    if (audio) audio.hit();
  }
  return best;
}

/** A punch from `from` toward `heading`: hits the nearest living target in range. */
export function punch(from, heading, targets, audio) {
  if (audio) audio.punch();
  const reach = PLAYER.punchRange + 0.6;
  let best = null;
  let bestDist = reach;
  for (const target of targets) {
    if (!target || target.hp <= 0 || target.dead) continue;
    const dx = target.x - from.x;
    const dz = target.z - from.z;
    const dist = Math.hypot(dx, dz);
    if (dist > reach) continue;
    const dot = (dx * Math.sin(heading) + dz * Math.cos(heading)) / dist;
    if (dot < 0.5) continue;
    if (dist < bestDist) {
      bestDist = dist;
      best = target;
    }
  }
  if (best) {
    best.hp -= PLAYER.punchDamage;
    // Knock the target back a step.
    best.x += Math.sin(heading) * 0.8;
    best.z += Math.cos(heading) * 0.8;
    if (audio) audio.hit();
  }
  return best;
}

/** Enemies shoot back at the player when close enough and in line of sight. */
export function updateEnemies(combat, player, dt, onDamagePlayer) {
  if (combat.shootCooldown > 0) combat.shootCooldown -= dt;
  if (combat.tracerTimer > 0) {
    combat.tracerTimer -= dt;
    if (combat.tracerTimer <= 0) combat.tracerMat.opacity = 0;
  }
  for (const enemy of combat.enemies) {
    if (enemy.hp <= 0) continue;
    enemy.shootTimer -= dt;
    const dx = player.x - enemy.x;
    const dz = player.z - enemy.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 34 || enemy.shootTimer > 0) continue;
    enemy.shootTimer = COMBAT.enemyShotRate * (0.8 + Math.random() * 0.5);
    // Poor aim that gets worse with distance: standing off and shooting back is the play.
    const hitChance = dist < 12 ? 0.5 : dist < 25 ? 0.35 : 0.2;
    if (Math.random() < hitChance) onDamagePlayer(COMBAT.enemyShotDamage);
  }
}
