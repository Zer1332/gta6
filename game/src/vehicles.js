// SOLMAR — vehicles.js
// Mesh mobil (bodi, kabin, roda, lampu), lalu lintas sipil yang mengikuti
// jalan grid, dan fisika arcade mobil pemain (gas, rem, setir, rem tangan).

import { CONFIG } from './config.js';

const CAR_COLORS = [0xc0c0c8, 0x30343a, 0x8a2a2a, 0x2a4a8a, 0xd0a030, 0x3a6a3a, 0x7a3a6a, 0xd0d0d0];

// Satu mobil: bodi + kabin + 4 roda + lampu. Mengembalikan Group dengan
// referensi roda untuk animasi putaran.
export function makeCarMesh(color, isPolice = false) {
  const g = new THREE.Group();
  g.name = isPolice ? 'police-car' : 'car';
  const bodyMat = new THREE.MeshLambertMaterial({ color: isPolice ? 0x14142a : color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.7, 4.4), bodyMat);
  body.position.y = 0.65;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.6, 2.2),
    new THREE.MeshLambertMaterial({ color: 0x1a2530 }),
  );
  cabin.position.set(0, 1.25, -0.2);
  cabin.castShadow = true;
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  const wheels = [];
  for (const [wx, wz] of [[-1, 1.5], [1, 1.5], [-1, -1.5], [1, -1.5]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.38, wz);
    g.add(w);
    wheels.push(w);
  }
  // Lampu depan kuning, belakang merah.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (const wx of [-0.7, 0.7]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.15, 0.1), headMat);
    h.position.set(wx, 0.7, 2.22);
    g.add(h);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xd02020 });
  for (const wx of [-0.7, 0.7]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.15, 0.1), tailMat);
    t.position.set(wx, 0.7, -2.22);
    g.add(t);
  }
  if (isPolice) {
    // Lightbar merah-biru di atap.
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    bar.position.set(0, 1.65, -0.2);
    g.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.2, 0.42), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    red.position.set(-0.3, 1.65, -0.2);
    g.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.2, 0.42), new THREE.MeshBasicMaterial({ color: 0x2040ff }));
    blue.position.set(0.3, 1.65, -0.2);
    g.add(blue);
    g.userData.lightbar = { red, blue };
  }
  g.userData.wheels = wheels;
  return g;
}

// Satu mobil lalu lintas: berjalan di satu lajur jalan, belok di
// persimpangan, berhenti bila ada mobil di depan.
export class TrafficCar {
  constructor(scene, rng, x, z, heading) {
    this.mesh = makeCarMesh(rng.pick(CAR_COLORS));
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading;
    scene.add(this.mesh);
    this.heading = heading;
    this.speed = rng.range(CONFIG.trafficSpeedMin, CONFIG.trafficSpeedMax);
    this.targetSpeed = this.speed;
    this.wait = 0;
    this.rng = rng;
  }

  // Arah maju (vektor satuan) dari heading.
  forward() {
    return { x: Math.sin(this.heading), z: Math.cos(this.heading) };
  }

  update(dt, others) {
    if (this.wait > 0) {
      this.wait -= dt;
      this.speed = Math.max(0, this.speed - 20 * dt);
    } else {
      // Pelan bila ada mobil lain tepat di depan.
      const f = this.forward();
      let blocked = false;
      for (const o of others) {
        if (o === this) continue;
        const dx = o.mesh.position.x - this.mesh.position.x;
        const dz = o.mesh.position.z - this.mesh.position.z;
        const along = dx * f.x + dz * f.z;
        const side = Math.abs(dx * f.z - dz * f.x);
        if (along > 0 && along < 14 && side < 3) {
          blocked = true;
          break;
        }
      }
      this.targetSpeed = blocked ? 0 : this.speed;
      this.speed += (this.targetSpeed - this.speed) * Math.min(1, dt * 2);
    }
    const f = this.forward();
    this.mesh.position.x += f.x * this.speed * dt;
    this.mesh.position.z += f.z * this.speed * dt;
    this.mesh.rotation.y = this.heading;
    // Belok di persimpangan (kelipatan 100) dengan peluang kecil.
    const px = this.mesh.position.x;
    const pz = this.mesh.position.z;
    const nearX = Math.abs(((px % 100) + 100) % 100) < 1.2 || Math.abs(((px % 100) + 100) % 100) > 98.8;
    const nearZ = Math.abs(((pz % 100) + 100) % 100) < 1.2 || Math.abs(((pz % 100) + 100) % 100) > 98.8;
    if ((nearX || nearZ) && this.rng.next() < dt * 0.6) {
      this.heading += this.rng.pick([-Math.PI / 2, Math.PI / 2]);
      this.heading = Math.round(this.heading / (Math.PI / 2)) * (Math.PI / 2);
    }
    // Putar balik di tepi kota.
    if (Math.abs(px) > 395 || Math.abs(pz) > 395) {
      this.heading += Math.PI;
      this.mesh.position.x = Math.max(-390, Math.min(390, px));
      this.mesh.position.z = Math.max(-390, Math.min(390, pz));
    }
    // Putar roda.
    for (const w of this.mesh.userData.wheels) w.rotation.x += (this.speed * dt) / 0.38;
  }
}

export class Traffic {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.cars = [];
  }

  spawn(count) {
    const roads = [];
    for (let c = -400; c <= 400; c += 100) roads.push(c);
    for (let i = 0; i < count; i++) {
      const alongRoad = this.rng.chance(0.5);
      const road = this.rng.pick(roads);
      const lane = this.rng.pick([-3.5, 3.5]);
      const along = this.rng.range(-390, 390);
      const heading = this.rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
      let x;
      let z;
      if (alongRoad) {
        x = road + lane;
        z = along;
      } else {
        x = along;
        z = road + lane;
      }
      const car = new TrafficCar(this.scene, this.rng, x, z, heading);
      this.cars.push(car);
    }
    return this;
  }

  update(dt, playerCar) {
    const all = this.cars;
    for (const c of all) c.update(dt, all);
    // Tabrakan ringan dengan mobil pemain: dorong dan kurangi kecepatan.
    if (playerCar) {
      for (const c of all) {
        const dx = c.mesh.position.x - playerCar.mesh.position.x;
        const dz = c.mesh.position.z - playerCar.mesh.position.z;
        const d = Math.hypot(dx, dz);
        if (d < 4 && d > 0.01) {
          const push = (4 - d) / 2;
          c.mesh.position.x += (dx / d) * push;
          c.mesh.position.z += (dz / d) * push;
          playerCar.speed = Math.max(0, playerCar.speed - 8 * dt);
          playerCar.health = Math.max(0, playerCar.health - 6 * dt);
        }
      }
    }
  }
}

// Mobil yang dikendarai pemain: fisika arcade sederhana.
export class PlayerCar {
  constructor(scene, mesh) {
    this.scene = scene;
    this.mesh = mesh;
    this.speed = 0;
    this.heading = 0;
    this.health = CONFIG.carHealth;
    this.steer = 0;
  }

  place(x, z, heading) {
    this.mesh.position.set(x, 0, z);
    this.heading = heading;
    this.mesh.rotation.y = heading;
    this.speed = 0;
    this.health = CONFIG.carHealth;
  }

  update(dt, input, city) {
    const throttle = input.isDown('KeyW') || input.isDown('ArrowUp') ? 1 : 0;
    const brake = input.isDown('KeyS') || input.isDown('ArrowDown') ? 1 : 0;
    const handbrake = input.isDown('Space');
    const steerIn = (input.isDown('KeyA') || input.isDown('ArrowLeft') ? 1 : 0)
      - (input.isDown('KeyD') || input.isDown('ArrowRight') ? 1 : 0);
    const targetSteer = steerIn * (this.speed >= 0 ? 1 : -1);
    this.steer += (targetSteer - this.steer) * Math.min(1, dt * 8);

    if (throttle) this.speed += CONFIG.carAccel * dt;
    if (brake) {
      if (this.speed > 0.5) this.speed -= CONFIG.carBrake * dt;
      else this.speed -= CONFIG.carAccel * 0.5 * dt;
    }
    if (!throttle && !brake) this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 6 * dt);
    if (handbrake) this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 25 * dt);
    this.speed = Math.max(-12, Math.min(CONFIG.carTopSpeed, this.speed));

    const turnRate = CONFIG.carTurn * this.steer * Math.min(1, Math.abs(this.speed) / 10) * (handbrake ? 1.6 : 1);
    this.heading += turnRate * Math.sign(this.speed) * dt;

    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    let nx = this.mesh.position.x + fx * this.speed * dt;
    let nz = this.mesh.position.z + fz * this.speed * dt;
    const before = { x: nx, z: nz };
    const hit = city.collideCircle(nx, nz, 2.2);
    if (Math.hypot(hit.x - before.x, hit.z - before.z) > 0.01) {
      this.speed *= 0.4;
      this.health = Math.max(0, this.health - 4 * dt);
    }
    const clamped = city.clampToLand(hit.x, hit.z);
    this.mesh.position.x = clamped.x;
    this.mesh.position.z = clamped.z;
    this.mesh.rotation.y = this.heading;
    // Badan mobil miring sedikit saat belok.
    this.mesh.rotation.z = -this.steer * 0.04 * Math.min(1, Math.abs(this.speed) / 15);
    for (const w of this.mesh.userData.wheels) w.rotation.x += (this.speed * dt) / 0.38;
  }

  kmh() {
    return Math.abs(this.speed) * 3.6;
  }
}
