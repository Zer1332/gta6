// SOLMAR — combat.js
// Menembak: sinar dari KAMERA menembus tengah layar (bukan dari pemain),
// supaya bidikan sejajar persis dengan yang terlihat di crosshair —
// ini memperbaiki paralaks third-person: kamera berada di belakang dan
// di atas pemain, jadi sinar dari posisi pemain akan menembus tanah
// di depan musuh jarak dekat. Ditambah aim-assist ringan: bila sinar
// lewat dekat musuh dalam kerucut kecil, tembakan mengunci ke musuh itu.

export function createCombat(G) {
  const raycaster = new THREE.Raycaster();
  const combat = {
    enemies: [],
    lastShotAt: -99,
    reloading: false,
    reloadUntil: 0,
    flash: null,

    spawnVultures(positions) {
      this.clearEnemies();
      positions.forEach(([x, z], i) => {
        const group = new THREE.Group();
        const body = new THREE.Mesh(
          new THREE.CylinderGeometry(0.45, 0.55, 1.2, 10),
          new THREE.MeshLambertMaterial({ color: 0x5a1a1a })
        );
        body.position.y = 1.0;
        group.add(body);
        const head = new THREE.Mesh(
          new THREE.SphereGeometry(0.32, 12, 10),
          new THREE.MeshLambertMaterial({ color: 0xd8a077 })
        );
        head.position.y = 1.85;
        group.add(head);
        // Rompi Vulture: kotak kuning gelap di dada.
        const vest = new THREE.Mesh(
          new THREE.BoxGeometry(0.7, 0.6, 0.2),
          new THREE.MeshLambertMaterial({ color: 0xc8a020 })
        );
        vest.position.set(0, 1.15, 0.42);
        group.add(vest);
        group.position.set(x, 0, z);
        G.scene.add(group);
        this.enemies.push({
          mesh: group,
          pos: new THREE.Vector3(x, 0, z),
          hp: G.config.enemy.hp,
          alive: true,
          shootAt: G.time + G.rng.range(0.5, 1.5),
          id: i,
        });
      });
    },

    clearEnemies() {
      for (const e of this.enemies) G.scene.remove(e.mesh);
      this.enemies = [];
    },

    aliveCount() {
      return this.enemies.filter((e) => e.alive).length;
    },

    weapon() {
      return G.config.weapons[G.player.weapon];
    },

    canShoot() {
      const w = this.weapon();
      return (
        G.state === 'playing' &&
        !this.reloading &&
        G.time - this.lastShotAt >= w.fireDelay &&
        G.player.ammo[G.player.weapon] > 0
      );
    },

    // Tembakan utama. Mengembalikan musuh yang kena (atau null).
    shoot() {
      if (!this.canShoot()) {
        if (G.player.ammo[G.player.weapon] === 0) this.startReload();
        return null;
      }
      const w = this.weapon();
      this.lastShotAt = G.time;
      G.player.ammo[G.player.weapon] -= 1;
      G.audio.shoot();

      // Sinar dari kamera melalui tengah layar. Perbarui matriks dunia kamera
      // dulu: kamera baru saja digerakkan (atau pemain baru berputar) dan
      // matriksnya baru diperbarui saat render — tanpa ini sinarnya memakai
      // arah kamera frame sebelumnya dan tembakan meleset.
      G.camera.updateMatrixWorld(true);
      raycaster.setFromCamera(new THREE.Vector2(0, 0), G.camera);
      const dir = raycaster.ray.direction.clone();
      const origin = raycaster.ray.origin.clone();

      // Aim-assist: cari musuh hidup yang paling dekat dengan sinar.
      let best = null;
      let bestScore = 0.16; // radian maksimum dari sinar (~9 derajat)
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const toEnemy = e.pos.clone().setY(1.3).sub(origin);
        // Jarak tembak diukur dari PENEMBAK (pemain), bukan dari kamera:
        // kamera third-person 7–10 m di belakang pemain tak boleh
        // memangkas jangkauan senjata.
        const distFromPlayer = e.pos.distanceTo(G.player.pos);
        if (distFromPlayer > w.range) continue;
        const angle = dir.angleTo(toEnemy.normalize());
        if (angle < bestScore) {
          bestScore = angle;
          best = e;
        }
      }
      // Kilat moncong singkat di ujung laras (visual).
      this.muzzleFlash();

      if (best) {
        best.hp -= w.damage;
        G.hud.hitmarker();
        if (best.hp <= 0) {
          best.alive = false;
          best.mesh.visible = false;
          G.hud.banner('Vulture tumbang! Sisa: ' + this.aliveCount(), 2);
          G.audio.cash();
          G.missions.onVultureDown();
        }
        return best;
      }
      // Bila tak kena musuh: cek pejalan kaki lari (tembakan mengusir).
      for (const ped of G.peds) {
        const toPed = ped.pos.clone().setY(1.2).sub(origin);
        if (toPed.length() < w.range && dir.angleTo(toPed.normalize()) < 0.1) {
          ped.flee = 6;
          break;
        }
      }
      return null;
    },

    muzzleFlash() {
      if (!this.flash) {
        this.flash = new THREE.PointLight(0xffc860, 0, 12);
        G.scene.add(this.flash);
      }
      const p = G.player;
      const cam = G.camera;
      // Posisi kilat: sedikit di depan kamera, searah bidikan.
      const fwd = new THREE.Vector3();
      cam.getWorldDirection(fwd);
      this.flash.position.copy(cam.position).addScaledVector(fwd, 1.6);
      this.flash.position.y -= 0.4;
      this.flash.intensity = 6;
      setTimeout(() => {
        if (this.flash) this.flash.intensity = 0;
      }, 50);
      void p;
    },

    startReload() {
      const p = G.player;
      const w = this.weapon();
      if (this.reloading || p.reserve[p.weapon] <= 0 || p.ammo[p.weapon] === w.mag) return;
      this.reloading = true;
      this.reloadUntil = G.time + 1.1;
      G.audio.reload();
    },

    update(dt) {
      if (this.reloading && G.time >= this.reloadUntil) {
        const p = G.player;
        const w = this.weapon();
        const need = w.mag - p.ammo[p.weapon];
        const take = Math.min(need, p.reserve[p.weapon]);
        p.ammo[p.weapon] += take;
        p.reserve[p.weapon] -= take;
        this.reloading = false;
      }
      // Musuh menembak balik bila pemain dekat dan terlihat.
      const p = G.player;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const dist = e.pos.distanceTo(p.pos);
        e.mesh.lookAt(p.pos.x, 0, p.pos.z);
        if (dist < G.config.enemy.aggroRange && G.state === 'playing') {
          // Bergerak mendekat perlahan bila jauh.
          if (dist > 14) {
            const dx = p.pos.x - e.pos.x;
            const dz = p.pos.z - e.pos.z;
            const len = Math.hypot(dx, dz) || 1;
            e.pos.x += (dx / len) * 2.2 * dt;
            e.pos.z += (dz / len) * 2.2 * dt;
            e.mesh.position.copy(e.pos);
          }
          if (G.time >= e.shootAt) {
            e.shootAt = G.time + G.config.enemy.shootInterval;
            G.audio.enemyShoot();
            // Akurasi musuh: kena bila pemain dekat / diam.
            if (dist < 30 && G.rng.next() < 0.55) {
              G.playerDamage(G.config.enemy.damage, 'ditembak Vulture');
            }
          }
        }
      }
    },

    // Polisi menabrak pemain jalan kaki: damage kecil, sekali per 0.8 detik.
    policeRam(dt) {
      if (!this._ramAt || G.time - this._ramAt > 0.8) {
        this._ramAt = G.time;
        G.playerDamage(8, 'ditabrak polisi');
      }
      void dt;
    },
  };
  return combat;
}
