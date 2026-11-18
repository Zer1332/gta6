// SOLMAR — player.js
// Rook di jalan kaki: gerak WASD relatif kamera, lompat, masuk/keluar mobil,
// nyawa + regenerasi, damage, dan respawn di rumah sakit bila tertangkap.

export function createPlayer(G) {
  const [sx, sz] = G.config.spots.playerStart;
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x2a4a6a });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 1.1, 10), bodyMat);
  body.position.y = 1.05;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), new THREE.MeshLambertMaterial({ color: 0xd8a077 }));
  head.position.y = 1.85;
  group.add(head);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.35), new THREE.MeshLambertMaterial({ color: 0x222226 }));
  legs.position.y = 0.35;
  group.add(legs);
  group.position.set(sx, 0, sz);
  G.scene.add(group);

  return {
    mesh: group,
    pos: new THREE.Vector3(sx, 0, sz),
    yaw: Math.PI, // menghadap utara kota
    pitch: 0,
    vy: 0,
    onGround: true,
    hp: G.config.player.hpMax,
    money: G.config.startMoney,
    car: null,
    weapon: 'pistol',
    ammo: { pistol: 12, smg: 30 },
    reserve: { pistol: 72, smg: 150 },
    lastDamageAt: -99,
    lastSeenByPoliceAt: -99,
    bustedTimer: 0,
    dead: false,
  };
}

export function damagePlayer(G, amount, cause) {
  const p = G.player;
  if (p.dead || G.state !== 'playing') return;
  p.hp -= amount;
  p.lastDamageAt = G.time;
  G.hud.flashDamage();
  if (p.hp <= 0) {
    p.hp = 0;
    p.dead = true;
    G.gameOver('Kamu tertembak. Rook dibawa ke rumah sakit.', cause);
  }
}

export function respawnPlayer(G, reason) {
  const p = G.player;
  // Keluar dari mobil bila sedang mengemudi.
  if (p.car) {
    p.car.isPlayerCar = false;
    p.car = null;
  }
  const [hx, hz] = G.config.spots.hospital;
  p.pos.set(hx, 0, hz);
  p.mesh.position.copy(p.pos);
  p.yaw = 0;
  p.hp = G.config.player.hpMax;
  p.dead = false;
  p.bustedTimer = 0;
  const loss = Math.floor(p.money * 0.1);
  p.money -= loss;
  G.police.setWanted(0);
  G.hud.banner(reason + ' Kehilangan $' + loss + ' (10%).', 4);
  G.saveGame();
}

export function updatePlayer(G, dt) {
  const p = G.player;
  const input = G.input;
  if (p.dead || G.state !== 'playing') return;

  // Regenerasi nyawa setelah 5 detik tanpa damage.
  if (p.hp < G.config.player.hpMax && G.time - p.lastDamageAt > G.config.player.regenDelay) {
    p.hp = Math.min(G.config.player.hpMax, p.hp + G.config.player.regenRate * dt);
  }

  // Mouse: putar pandangan (pointer lock; di mode shot diabaikan).
  if (!window.__SOLMAR_SHOT_MODE) {
    const m = input.consumeMouse();
    p.yaw -= m.dx * 0.0026;
    p.pitch = Math.max(-0.9, Math.min(0.6, p.pitch - m.dy * 0.0026));
  }

  if (p.car) return; // mengemudi ditangani vehicles.updatePlayerCar

  // Jalan kaki.
  const mv = input.moveVector();
  const run = input.down('ShiftLeft') || input.down('ShiftRight');
  const speed = run ? G.config.player.runSpeed : G.config.player.walkSpeed;
  const sin = Math.sin(p.yaw);
  const cos = Math.cos(p.yaw);
  // Maju = arah pandang (yaw 0 = +z di Three.js; kamera di belakang pemain).
  let dx = 0;
  let dz = 0;
  if (mv.y !== 0 || mv.x !== 0) {
    const len = Math.hypot(mv.x, mv.y) || 1;
    const fx = mv.x / len;
    const fy = mv.y / len;
    dx = (-sin * fy + cos * fx) * speed * dt;
    dz = (-cos * fy - sin * fx) * speed * dt;
    // Hadapkan model ke arah gerak.
    p.mesh.rotation.y = Math.atan2(dx, dz);
  }
  const hit = G.collide(p.pos.x + dx, p.pos.z + dz, 0.6);
  if (hit) {
    p.pos.x = hit.x;
    p.pos.z = hit.z;
  } else {
    p.pos.x += dx;
    p.pos.z += dz;
  }
  p.pos.x = Math.max(-395, Math.min(395, p.pos.x));
  p.pos.z = Math.max(-395, Math.min(295, p.pos.z));

  // Lompat + gravitasi sederhana.
  if (input.down('Space') && p.onGround) {
    p.vy = G.config.player.jumpSpeed;
    p.onGround = false;
  }
  if (!p.onGround) {
    p.vy -= 22 * dt;
    p.pos.y += p.vy * dt;
    if (p.pos.y <= 0) {
      p.pos.y = 0;
      p.vy = 0;
      p.onGround = true;
    }
  }
  p.mesh.position.copy(p.pos);
}

// Cari mobil terdekat dalam radius; E masuk/keluar.
export function nearestCar(G, maxDist) {
  const p = G.player;
  let best = null;
  let bestD = maxDist;
  const all = [...G.parkedCars, ...G.traffic];
  for (const car of all) {
    const d = car.pos.distanceTo(p.pos);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

export function enterCar(G, car) {
  const p = G.player;
  if (!car || p.car) return false;
  const wasParked = car.parked;
  p.car = car;
  car.isPlayerCar = true;
  car.parked = false;
  p.mesh.visible = false;
  G.audio.engineStart();
  G.audio.engineSet(0, true);
  if (wasParked && !car.missionSedan && !car.wasStolen) {
    car.wasStolen = true;
    G.police.raiseWanted(1, 'mencuri mobil');
    G.hud.banner('Mobil dicuri — wanted naik!', 2.5);
  }
  if (car.missionSedan) {
    G.missions.onSedanTaken();
  }
  return true;
}

export function exitCar(G) {
  const p = G.player;
  if (!p.car) return false;
  const car = p.car;
  car.isPlayerCar = false;
  p.car = null;
  // Turun di samping mobil.
  const side = new THREE.Vector3(Math.cos(car.yaw), 0, -Math.sin(car.yaw));
  p.pos.copy(car.pos).addScaledVector(side, 2.5);
  p.pos.y = 0;
  p.mesh.position.copy(p.pos);
  p.mesh.visible = true;
  p.yaw = car.yaw;
  G.audio.engineSet(0, false);
  return true;
}
