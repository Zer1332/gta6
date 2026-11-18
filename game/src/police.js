// SOLMAR — police.js
// Sistem wanted 0–5 bintang dan polisi Solmar: mobil patroli yang mengejar,
// petugas jalan kaki, penangkapan saat pemain terpojok, dan wanted yang
// turun bila pemain tak terlihat selama 20 detik.

import { CONFIG } from './config.js';
import { makeCarMesh } from './vehicles.js';

export class Police {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.cars = []; // {mesh, speed, heading}
    this.officers = []; // {mesh, pos, speed}
    this.unseenTime = 0;
    this.bustTimer = 0;
    this.sirenOn = false;
  }

  wantedCount(wanted) {
    return Math.min(wanted, 3); // maks 3 mobil patroli aktif
  }

  update(dt, game) {
    const wanted = game.state.wanted;
    const playerPos = game.player.pos;
    // Spawn / despawn mobil polisi sesuai wanted.
    const want = this.wantedCount(wanted);
    while (this.cars.length < want) this.spawnCar(game);
    while (this.cars.length > want) {
      const c = this.cars.pop();
      this.scene.remove(c.mesh);
    }
    // Petugas jalan kaki saat wanted >= 2 dan pemain jalan kaki.
    const wantOfficers = wanted >= 2 && !game.player.inCar ? Math.min(2, wanted - 1) : 0;
    while (this.officers.length < wantOfficers) this.spawnOfficer(game);
    while (this.officers.length > wantOfficers) {
      const o = this.officers.pop();
      this.scene.remove(o.mesh);
    }

    let nearest = Infinity;
    for (const c of this.cars) {
      // Kejar pemain: belok menuju pemain, kecepatan sedikit di bawah pemain.
      const dx = playerPos.x - c.mesh.position.x;
      const dz = playerPos.z - c.mesh.position.z;
      const dist = Math.hypot(dx, dz);
      nearest = Math.min(nearest, dist);
      const targetHeading = Math.atan2(dx, dz);
      let dh = targetHeading - c.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      c.heading += Math.max(-2.2 * dt, Math.min(2.2 * dt, dh));
      c.speed = Math.min(CONFIG.policeCarSpeed, c.speed + 12 * dt);
      c.mesh.position.x += Math.sin(c.heading) * c.speed * dt;
      c.mesh.position.z += Math.cos(c.heading) * c.speed * dt;
      c.mesh.rotation.y = c.heading;
      for (const w of c.mesh.userData.wheels) w.rotation.x += (c.speed * dt) / 0.38;
      // Kedip lightbar.
      const phase = Math.floor(game.now * 6) % 2 === 0;
      if (c.mesh.userData.lightbar) {
        c.mesh.userData.lightbar.red.material.color.setHex(phase ? 0xff2020 : 0x400000);
        c.mesh.userData.lightbar.blue.material.color.setHex(phase ? 0x2020ff : 0x000040);
      }
      // Tabrakan dengan mobil pemain (damage + perlambatan per detik).
      if (game.player.inCar && dist < 4.5) {
        game.player.inCar.speed = Math.max(0, game.player.inCar.speed - 6 * dt);
        game.player.inCar.health = Math.max(0, game.player.inCar.health - 8 * dt);
      }
    }
    for (const o of this.officers) {
      const dx = playerPos.x - o.mesh.position.x;
      const dz = playerPos.z - o.mesh.position.z;
      const dist = Math.hypot(dx, dz);
      nearest = Math.min(nearest, dist);
      const step = Math.min(dist, 5.5 * dt);
      o.mesh.position.x += (dx / (dist || 1)) * step;
      o.mesh.position.z += (dz / (dist || 1)) * step;
      o.mesh.rotation.y = Math.atan2(dx, dz);
      o.walkPhase += dt * 8;
      o.mesh.userData.legL.rotation.x = Math.sin(o.walkPhase) * 0.5;
      o.mesh.userData.legR.rotation.x = -Math.sin(o.walkPhase) * 0.5;
    }

    // Sirene berbunyi saat wanted > 0.
    const siren = wanted > 0;
    if (siren !== this.sirenOn) {
      this.sirenOn = siren;
      game.audio.siren(siren);
    }

    // Wanted turun bila tidak terlihat: tidak ada polisi dalam 60 m.
    if (wanted > 0) {
      if (nearest > 60) {
        this.unseenTime += dt;
        if (this.unseenTime > CONFIG.wantedDecayTime) {
          game.state.wanted = Math.max(0, wanted - 1);
          this.unseenTime = 0;
        }
      } else {
        this.unseenTime = 0;
      }
    }

    // Penangkapan: polisi sangat dekat dan pemain lambat / jalan kaki.
    if (wanted > 0 && nearest < CONFIG.bustDistance) {
      const slow = game.player.inCar ? Math.abs(game.player.inCar.speed) < 2 : true;
      if (slow) {
        this.bustTimer += dt;
        if (this.bustTimer > CONFIG.bustTime) {
          this.bustTimer = 0;
          game.busted();
        }
      } else {
        this.bustTimer = 0;
      }
    } else {
      this.bustTimer = 0;
    }
  }

  spawnCar(game) {
    const p = game.player.pos;
    const a = this.rng.range(0, Math.PI * 2);
    const x = Math.max(-390, Math.min(390, p.x + Math.cos(a) * 60));
    const z = Math.max(-390, Math.min(390, p.z + Math.sin(a) * 60));
    const mesh = makeCarMesh(0x14142a, true);
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    this.cars.push({ mesh, speed: 10, heading: Math.atan2(p.x - x, p.z - z) });
  }

  spawnOfficer(game) {
    const p = game.player.pos;
    const a = this.rng.range(0, Math.PI * 2);
    const mesh = this.makeOfficerMesh();
    mesh.position.set(p.x + Math.cos(a) * 25, 0, p.z + Math.sin(a) * 25);
    this.scene.add(mesh);
    this.officers.push({ mesh, walkPhase: 0 });
  }

  makeOfficerMesh() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 1.0, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x1a2a4a }),
    );
    body.position.y = 1.05;
    body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.42, 0.42),
      new THREE.MeshLambertMaterial({ color: 0xd8a880 }),
    );
    head.position.y = 1.8;
    g.add(head);
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.28, 0.14, 10),
      new THREE.MeshLambertMaterial({ color: 0x101828 }),
    );
    cap.position.y = 2.02;
    g.add(cap);
    const legMat = new THREE.MeshLambertMaterial({ color: 0x141828 });
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.8, 0.3), legMat);
    legL.position.set(-0.18, 0.4, 0);
    g.add(legL);
    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.8, 0.3), legMat);
    legR.position.set(0.18, 0.4, 0);
    g.add(legR);
    g.userData.legL = legL;
    g.userData.legR = legR;
    return g;
  }

  clear() {
    for (const c of this.cars) this.scene.remove(c.mesh);
    for (const o of this.officers) this.scene.remove(o.mesh);
    this.cars = [];
    this.officers = [];
    this.bustTimer = 0;
    this.unseenTime = 0;
  }
}
