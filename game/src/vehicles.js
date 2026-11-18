// SOLMAR — vehicles.js
// Mobil: mesh prosedural, lalu lintas sipil yang mengikuti rute lurus di
// jalan grid, mobil parkir, dan fisika mengemudi arcade untuk mobil pemain.

export function makeCarMesh(color, isPolice) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 4.6), bodyMat);
  body.position.y = 0.75;
  group.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.65, 2.2),
    new THREE.MeshLambertMaterial({ color: 0x1a2530 })
  );
  cabin.position.set(0, 1.35, -0.2);
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  for (const [wx, wz] of [[-1.0, 1.5], [1.0, 1.5], [-1.0, -1.5], [1.0, -1.5]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.42, wz);
    group.add(w);
  }
  // Lampu depan.
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const wx of [-0.7, 0.7]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), lightMat);
    l.position.set(wx, 0.8, 2.32);
    group.add(l);
  }
  if (isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.5), new THREE.MeshBasicMaterial({ color: 0x2233ff }));
    bar.position.set(0, 1.78, -0.2);
    group.add(bar);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.52), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    bar2.position.set(0.35, 1.78, -0.2);
    group.add(bar2);
  }
  return group;
}

export function createCar(G, opts) {
  const car = {
    mesh: makeCarMesh(opts.color || 0x888888, !!opts.isPolice),
    pos: new THREE.Vector3(opts.x || 0, 0, opts.z || 0),
    yaw: opts.yaw || 0,
    speed: 0,
    steer: 0,
    isPolice: !!opts.isPolice,
    isPlayerCar: false,
    parked: !!opts.parked,
    missionSedan: !!opts.missionSedan,
    hp: 100,
    // Untuk lalu lintas: rute lurus.
    routeAxis: opts.routeAxis || 'x',
    routeLane: opts.routeLane || 0,
    routeDir: opts.routeDir || 1,
    routeSpeed: opts.routeSpeed || 8,
    id: opts.id || 0,
  };
  car.mesh.position.copy(car.pos);
  car.mesh.rotation.y = car.yaw;
  G.scene.add(car.mesh);
  return car;
}

export function spawnTraffic(G) {
  const colors = [0xc0c0c0, 0x404040, 0x8a2a2a, 0x2a4a8a, 0xc0a030, 0x4a6a3a, 0x7a7a8a, 0x9a5a2a];
  const roads = [];
  for (let c = -340; c <= 340; c += 60) roads.push(c);
  const cars = [];
  for (let i = 0; i < G.config.trafficCount; i++) {
    const axis = G.rng.next() < 0.5 ? 'x' : 'z';
    const lane = G.rng.pick(roads);
    const along = G.rng.range(-380, 280);
    const dir = G.rng.next() < 0.5 ? 1 : -1;
    const car = createCar(G, {
      color: G.rng.pick(colors),
      x: axis === 'x' ? along : lane + (dir > 0 ? 3 : -3),
      z: axis === 'x' ? lane + (dir > 0 ? 3 : -3) : along,
      yaw: axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : dir > 0 ? 0 : Math.PI,
      routeAxis: axis,
      routeLane: lane,
      routeDir: dir,
      routeSpeed: G.rng.range(6, 11),
      id: i,
    });
    cars.push(car);
  }
  return cars;
}

export function updateTraffic(G, dt) {
  for (const car of G.traffic) {
    const step = car.routeSpeed * car.routeDir * dt;
    if (car.routeAxis === 'x') {
      car.pos.x += step;
      if (car.pos.x > 390) car.pos.x = -390;
      if (car.pos.x < -390) car.pos.x = 390;
    } else {
      car.pos.z += step;
      if (car.pos.z > 290) car.pos.z = -390;
      if (car.pos.z < -390) car.pos.z = 290;
    }
    car.mesh.position.copy(car.pos);
    car.mesh.rotation.y = car.yaw;
  }
}

// Fisika mengemudi arcade untuk mobil yang dikendarai pemain.
export function updatePlayerCar(G, dt) {
  const car = G.player.car;
  if (!car) return;
  const input = G.input;
  const mv = input.moveVector();
  const cfg = G.config.car;
  const forward = mv.y; // W = 1, S = -1
  const steerInput = -mv.x; // A = kiri

  if (forward > 0) {
    car.speed += cfg.accel * dt;
  } else if (forward < 0) {
    car.speed -= (car.speed > 0.5 ? cfg.brake : cfg.accel * 0.6) * dt;
  } else {
    car.speed -= Math.sign(car.speed) * cfg.grip * dt * 0.5;
    if (Math.abs(car.speed) < 0.3) car.speed = 0;
  }
  if (input.down('Space')) {
    car.speed -= Math.sign(car.speed) * cfg.brake * dt; // rem tangan
  }
  const maxF = car.isPolice ? cfg.policeMaxSpeed : cfg.maxSpeed;
  car.speed = Math.max(-cfg.reverseMax, Math.min(maxF, car.speed));

  const steerTarget = steerInput * cfg.steer * Math.min(1, Math.abs(car.speed) / 8);
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
  if (Math.abs(car.speed) > 0.2) {
    car.yaw += car.steer * dt * Math.sign(car.speed);
  }

  const nx = car.pos.x + Math.sin(car.yaw) * car.speed * dt;
  const nz = car.pos.z + Math.cos(car.yaw) * car.speed * dt;
  // Tabrakan gedung: geser keluar, perlambat.
  const hit = G.collide(nx, nz, 2.4);
  if (hit) {
    car.pos.x = hit.x;
    car.pos.z = hit.z;
    if (Math.abs(car.speed) > 12) G.audio.crash();
    car.speed *= 0.4;
  } else {
    car.pos.x = nx;
    car.pos.z = nz;
  }
  // Batas dunia.
  car.pos.x = Math.max(-395, Math.min(395, car.pos.x));
  car.pos.z = Math.max(-395, Math.min(295, car.pos.z));

  car.mesh.position.copy(car.pos);
  car.mesh.rotation.y = car.yaw;
  // Roda depan ikut setir (visual sederhana: miringkan seluruh mobil sedikit).
  car.mesh.rotation.z = -car.steer * 0.04 * Math.sign(car.speed || 1);
  // Posisi pemain SELALU mengikuti mobil yang dikendarainya — kamera,
  // misi, dan polisi semua membaca p.pos.
  G.player.pos.copy(car.pos);

  // Ngebut dekat polisi menaikkan wanted.
  if (Math.abs(car.speed) > 24) {
    for (const p of G.police.cars) {
      if (p.mesh.position.distanceTo(car.pos) < 40) {
        G.police.raiseWanted(1, 'ngebut');
        break;
      }
    }
  }
}

// Mobil parkir yang bisa dicuri (termasuk sedan misi 1).
export function spawnParkedCars(G) {
  const parked = [];
  const spots = [
    { x: 180, z: -120, color: 0x2a6ac0, missionSedan: true },
    { x: 60, z: -60, color: 0xc0c0c0 },
    { x: -60, z: 60, color: 0x8a2a2a },
    { x: 120, z: 120, color: 0x2a4a8a },
    { x: -180, z: -60, color: 0xc0a030 },
    { x: 0, z: -180, color: 0x4a6a3a },
    { x: -120, z: -180, color: 0x7a7a8a },
    { x: 240, z: 60, color: 0x9a5a2a },
  ];
  for (const s of spots) {
    const car = createCar(G, {
      color: s.color,
      x: s.x,
      z: s.z,
      yaw: G.rng.range(0, Math.PI * 2),
      parked: true,
      missionSedan: !!s.missionSedan,
      id: 100 + parked.length,
    });
    parked.push(car);
  }
  return parked;
}
