// SOLMAR — police.js
// Wanted 0–5, mobil polisi yang mengejar, dan penangkapan.
// Polisi sedikit lebih lambat dari mobil pemain supaya bisa kabur.

import { createCar } from './vehicles.js';

export function createPolice(G) {
  return {
    wanted: 0,
    cars: [],
    officers: [],
    lastRaiseAt: -99,
    sirenAt: 0,

    setWanted(n) {
      this.wanted = Math.max(0, Math.min(G.config.wanted.max, n));
      this.syncCars();
    },

    raiseWanted(n, why) {
      if (G.time - this.lastRaiseAt < 2) return; // jangan spam naik
      this.lastRaiseAt = G.time;
      this.setWanted(this.wanted + n);
      void why;
    },

    syncCars() {
      // Jumlah mobil polisi aktif mengikuti wanted (maks 3 mobil + petugas).
      const want = Math.min(3, this.wanted);
      while (this.cars.length < want) {
        const p = G.player;
        const angle = G.rng.range(0, Math.PI * 2);
        const car = createCar(G, {
          color: 0x111122,
          isPolice: true,
          x: p.pos.x + Math.sin(angle) * 55,
          z: p.pos.z + Math.cos(angle) * 55,
          yaw: 0,
          id: 900 + this.cars.length,
        });
        this.cars.push(car);
      }
      while (this.cars.length > want) {
        const car = this.cars.pop();
        G.scene.remove(car.mesh);
      }
    },

    update(dt) {
      // Wanted turun bila 20 detik tak terlihat polisi mana pun.
      if (this.wanted > 0) {
        let seen = false;
        for (const c of this.cars) {
          if (c.pos.distanceTo(G.player.pos) < 60) {
            seen = true;
            break;
          }
        }
        if (seen) {
          G.player.lastSeenByPoliceAt = G.time;
        } else if (G.time - G.player.lastSeenByPoliceAt > G.config.wanted.decayAfter) {
          this.setWanted(this.wanted - 1);
          G.player.lastSeenByPoliceAt = G.time;
        }
      }

      // Sirene berkala saat wanted > 0.
      if (this.wanted > 0 && G.time - this.sirenAt > 2.2) {
        this.sirenAt = G.time;
        G.audio.sirenBlip();
      }

      // Kejar pemain.
      const p = G.player;
      let closest = Infinity;
      for (const car of this.cars) {
        const dx = p.pos.x - car.pos.x;
        const dz = p.pos.z - car.pos.z;
        const dist = Math.hypot(dx, dz);
        closest = Math.min(closest, dist);
        const targetYaw = Math.atan2(dx, dz);
        // Belok menuju pemain, kecepatan sedikit di bawah mobil pemain.
        let dyaw = targetYaw - car.yaw;
        while (dyaw > Math.PI) dyaw -= Math.PI * 2;
        while (dyaw < -Math.PI) dyaw += Math.PI * 2;
        car.yaw += Math.max(-2.2 * dt, Math.min(2.2 * dt, dyaw));
        const speed = Math.min(G.config.car.policeMaxSpeed, 8 + dist * 0.35);
        car.pos.x += Math.sin(car.yaw) * speed * dt;
        car.pos.z += Math.cos(car.yaw) * speed * dt;
        const hit = G.collide(car.pos.x, car.pos.z, 2.4);
        if (hit) {
          car.pos.x = hit.x;
          car.pos.z = hit.z;
        }
        car.mesh.position.copy(car.pos);
        car.mesh.rotation.y = car.yaw;

        // Tabrak pemain yang jalan kaki: damage kecil + dorongan.
        if (!p.car && dist < 3) {
          // damagePlayer dipanggil dari world agar tidak dobel per frame.
          G.combat.policeRam(dt);
        }
      }

      // Tertangkap: polisi sangat dekat saat pemain jalan kaki & lambat.
      if (!p.car && this.wanted > 0 && closest < G.config.wanted.bustDistance) {
        p.bustedTimer += dt;
        if (p.bustedTimer > G.config.wanted.bustTime) {
          p.bustedTimer = 0;
          G.playerDead = true;
          respawnAfterBust(G);
        }
      } else {
        p.bustedTimer = Math.max(0, p.bustedTimer - dt * 2);
      }
    },
  };
}

function respawnAfterBust(G) {
  // Dipanggil lewat world.respawnPlayer agar urutan state konsisten.
  G.respawn('Tertangkap polisi.');
}
