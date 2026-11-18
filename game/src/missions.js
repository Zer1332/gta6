// SOLMAR — missions.js
// Tiga misi cerita berurutan dari fixer Mara Solano:
// 1. First Gear — curi sedan, antar ke garasi ($300).
// 2. Sunset Run — antar paket ke dermaga dalam 90 detik ($500).
// 3. Dockside — kalahkan 3 anggota geng Vulture, kembali ke Mara ($800).
// Sesudah semua misi selesai, free roam tetap terbuka.

import { CONFIG, PLACES, MISSIONS } from './config.js';
import { makeCarMesh } from './vehicles.js';

function makeBeacon(color) {
  const g = new THREE.Group();
  const cyl = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 30, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  cyl.position.y = 15;
  g.add(cyl);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.2, 0.18, 8, 24),
    new THREE.MeshBasicMaterial({ color }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.3;
  g.add(ring);
  const arrow = new THREE.Mesh(
    new THREE.ConeGeometry(0.7, 1.6, 4),
    new THREE.MeshBasicMaterial({ color }),
  );
  arrow.rotation.x = Math.PI;
  arrow.position.y = 6;
  g.add(arrow);
  g.userData.arrow = arrow;
  g.userData.ring = ring;
  return g;
}

export class Missions {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.index = -1; // misi aktif, -1 = belum ada
    this.stage = 0;
    this.timer = 0;
    this.marker = null;
    this.markerPos = null;
    this.targetCar = null; // mobil sedan misi 1
    this.done = [false, false, false];
    this.speedingCooldown = 0;
  }

  loadDone(done) {
    this.done = done.slice(0, 3);
  }

  nextMissionIndex() {
    for (let i = 0; i < 3; i++) if (!this.done[i]) return i;
    return -1;
  }

  // Mulai misi berikutnya (dipanggil dari layar awal / setelah misi selesai).
  startNext() {
    const i = this.nextMissionIndex();
    if (i < 0) {
      this.index = -1;
      this.game.hud.setObjective('Free roam — jelajahi Solmar. Semua misi selesai!');
      return;
    }
    this.start(i);
  }

  start(i) {
    this.index = i;
    this.stage = 0;
    this.timer = MISSIONS[i].timeLimit || 0;
    const def = MISSIONS[i];
    this.game.hud.showPhone(def.call);
    this.game.audio.phone();
    this.game.hud.setObjective(`Misi ${i + 1}: ${def.title} — ${def.objectives[0]}`);
    if (i === 0) this.setupFirstGear();
    if (i === 1) this.setMarker(PLACES.packagePickup, 0xffd24a);
    if (i === 2) this.setupDockside();
  }

  setupFirstGear() {
    // Sedan biru target diparkir di Tempat Parkir Marina.
    const mesh = makeCarMesh(0x2a4a8a);
    mesh.position.set(PLACES.parkingLot.x, 0, PLACES.parkingLot.z);
    mesh.rotation.y = Math.PI / 2;
    this.scene.add(mesh);
    this.targetCar = {
      mesh,
      heading: Math.PI / 2,
      health: CONFIG.carHealth,
      isTarget: true,
      taken: false,
    };
    this.game.parkedCars.push(this.targetCar);
    this.setMarker(PLACES.parkingLot, 0x4a90ff);
  }

  setupDockside() {
    const spots = [
      { x: 415, z: 130 },
      { x: 430, z: 155 },
      { x: 410, z: 175 },
    ];
    this.game.combat.spawnEnemies(spots);
    this.setMarker(PLACES.vultureCamp, 0xff4030);
  }

  setMarker(place, color) {
    this.clearMarker();
    this.marker = makeBeacon(color);
    this.marker.position.set(place.x, 0, place.z);
    this.scene.add(this.marker);
    this.markerPos = { x: place.x, z: place.z };
  }

  clearMarker() {
    if (this.marker) {
      this.scene.remove(this.marker);
      this.marker = null;
      this.markerPos = null;
    }
  }

  update(dt) {
    if (this.marker) {
      // Denyut penanda: panah naik-turun, cincin berputar.
      const t = this.game.now;
      this.marker.userData.arrow.position.y = 6 + Math.sin(t * 3) * 0.8;
      this.marker.userData.ring.rotation.z = t * 0.8;
    }
    if (this.index < 0) return;
    const p = this.game.player.pos;
    const def = MISSIONS[this.index];
    if (this.index === 0) this.updateFirstGear(p, def);
    else if (this.index === 1) this.updateSunsetRun(dt, p, def);
    else if (this.index === 2) this.updateDockside(p, def);
    if (this.speedingCooldown > 0) this.speedingCooldown -= dt;
  }

  near(p, place, r) {
    return Math.hypot(p.x - place.x, p.z - place.z) < r;
  }

  updateFirstGear(p, def) {
    if (this.stage === 0) {
      // Tahap 0 selesai saat pemain masuk ke sedan target.
      if (this.targetCar && this.targetCar.taken) {
        this.stage = 1;
        this.setMarker(PLACES.maraGarage, 0x4a90ff);
        this.game.hud.setObjective(`Misi 1: ${def.title} — ${def.objectives[1]}`);
        this.game.hud.showBanner('Sedan didapat — antar ke Garasi Mara!');
      }
      // Gagal bila sedan hancur sebelum diambil.
      if (this.targetCar && this.targetCar.health <= 0 && !this.targetCar.taken) {
        this.fail('Sedan hancur! Misi gagal.');
      }
    } else if (this.stage === 1) {
      if (this.targetCar && this.targetCar.health <= 0) {
        this.fail('Sedan hancur! Misi gagal.');
        return;
      }
      if (this.game.player.inCar && this.game.player.inCar._parkedRef === this.targetCar && this.near(p, PLACES.maraGarage, 12)) {
        this.complete();
      }
    }
  }

  updateSunsetRun(dt, p, def) {
    if (this.stage === 0) {
      if (this.near(p, PLACES.packagePickup, 5)) {
        this.stage = 1;
        this.timer = def.timeLimit;
        this.setMarker(PLACES.dockEnd, 0xffd24a);
        this.game.hud.setObjective(`Misi 2: ${def.title} — ${def.objectives[1]}`);
        this.game.hud.showBanner('Paket diambil — 90 detik menuju dermaga!');
        this.game.audio.pickup();
      }
    } else if (this.stage === 1) {
      this.timer -= dt;
      this.game.hud.setTimer(Math.max(0, Math.ceil(this.timer)));
      if (this.timer <= 0) {
        this.game.hud.setTimer(null);
        this.fail('Waktu habis! Paket terlambat sampai.');
        return;
      }
      // Ngebut di pusat kota menaikkan perhatian polisi.
      const car = this.game.player.inCar;
      if (car && Math.abs(car.speed) > 25 && Math.abs(p.x) < 150 && Math.abs(p.z) < 150) {
        if (this.speedingCooldown <= 0) {
          this.game.addWanted(1);
          this.speedingCooldown = 5;
          this.game.hud.showBanner('Polisi melihatmu ngebut di pusat kota!');
        }
      }
      if (this.near(p, PLACES.dockEnd, 8)) {
        this.game.hud.setTimer(null);
        this.complete();
      }
    }
  }

  updateDockside(p, def) {
    if (this.stage === 0) {
      if (this.game.combat.enemiesAlive() === 0) {
        this.stage = 1;
        this.setMarker(PLACES.maraGarage, 0x4a90ff);
        this.game.hud.setObjective(`Misi 3: ${def.title} — ${def.objectives[1]}`);
        this.game.hud.showBanner('Dermaga bersih — kembali ke Garasi Mara!');
        this.game.audio.pickup();
      }
    } else if (this.stage === 1) {
      if (this.near(p, PLACES.maraGarage, 12)) this.complete();
    }
  }

  complete() {
    const i = this.index;
    const reward = MISSIONS[i].reward;
    this.done[i] = true;
    this.clearMarker();
    this.game.state.money += reward;
    this.game.state.score += reward;
    this.game.hud.showBanner(`Misi selesai: ${MISSIONS[i].title} — +$${reward}`);
    this.game.audio.pickup();
    this.game.save();
    this.index = -1;
    // Telepon misi berikutnya beberapa detik kemudian (bila belum ada misi aktif).
    setTimeout(() => {
      if (this.game.state.mode === 'playing' && this.index < 0) this.startNext();
    }, 4000);
  }

  fail(reason) {
    this.game.hud.showBanner(reason + ' Coba lagi.');
    this.game.audio.click();
    const i = this.index;
    this.clearMarker();
    this.index = -1;
    if (i === 0 && this.targetCar && !this.targetCar.taken) {
      // Sedan baru muncul lagi.
      const idx = this.game.parkedCars.indexOf(this.targetCar);
      if (idx >= 0) this.game.parkedCars.splice(idx, 1);
      this.scene.remove(this.targetCar.mesh);
      this.targetCar = null;
    }
    if (i === 2) this.game.combat.clearEnemies();
    setTimeout(() => {
      if (this.game.state.mode === 'playing' && this.index < 0) this.start(i);
    }, 3000);
  }

  objectiveText() {
    if (this.index < 0) return 'Free roam — jelajahi Solmar.';
    const def = MISSIONS[this.index];
    return `Misi ${this.index + 1}: ${def.title} — ${def.objectives[this.stage] || ''}`;
  }
}
