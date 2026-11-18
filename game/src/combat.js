// SOLMAR — combat.js
// Bertarung: klik menembak (pistol/SMG), R isi ulang, 1/2 ganti senjata,
// raycast dari kamera, tracer + muzzle flash, dan anggota geng Vulture
// (HP 60) yang membalas tembakan di dermaga.

import { CONFIG } from './config.js';

export class Combat {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.weapon = 'pistol';
    this.ammo = CONFIG.pistolMag;
    this.reserve = Infinity;
    this.lastShot = 0;
    this.reloading = false;
    this.reloadUntil = 0;
    this.enemies = []; // {mesh, hp, lastShot, walkPhase}
    this.tracers = [];
    this.raycaster = new THREE.Raycaster();
    this.muzzle = new THREE.PointLight(0xffc860, 0, 12);
    this.scene.add(this.muzzle);
  }

  magSize() {
    return this.weapon === 'pistol' ? CONFIG.pistolMag : CONFIG.smgMag;
  }

  fireRate() {
    return this.weapon === 'pistol' ? CONFIG.pistolFireRate : CONFIG.smgFireRate;
  }

  damage() {
    return this.weapon === 'pistol' ? CONFIG.pistolDamage : CONFIG.smgDamage;
  }

  switchWeapon(name) {
    if (name !== 'pistol' && name !== 'smg') return;
    this.weapon = name;
    this.ammo = this.magSize();
    this.reloading = false;
    this.game.audio.click();
  }

  startReload(now) {
    if (this.reloading || this.ammo === this.magSize()) return;
    this.reloading = true;
    this.reloadUntil = now + CONFIG.reloadTime;
    this.game.audio.click();
  }

  // Tembakan dari tengah layar (crosshair).
  shoot(now) {
    if (this.game.player.inCar) return;
    if (this.reloading) return;
    if (now - this.lastShot < this.fireRate()) return;
    if (this.ammo <= 0) {
      this.startReload(now);
      return;
    }
    this.lastShot = now;
    this.ammo -= 1;
    this.game.audio.shoot(this.weapon === 'smg');
    // Menembak di dekat polisi menaikkan wanted.
    if (this.game.police.cars.length > 0 || this.game.police.officers.length > 0) {
      this.game.addWanted(1);
    }
    const camera = this.game.camera;
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const targets = [];
    for (const e of this.enemies) targets.push(e.mesh);
    for (const p of this.game.world.pedestrians) targets.push(p.mesh);
    const hits = this.raycaster.intersectObjects(targets, true);
    const buildings = this.raycaster.intersectObjects(this.game.city.buildings, false);
    let endPoint = null;
    let hitEnemy = null;
    let hitPed = null;
    if (hits.length > 0) {
      const hit = hits[0];
      endPoint = hit.point;
      let obj = hit.object;
      while (obj && !obj.userData.enemyRef && !obj.userData.pedRef) obj = obj.parent;
      if (obj && obj.userData.enemyRef) hitEnemy = obj.userData.enemyRef;
      if (obj && obj.userData.pedRef) hitPed = obj.userData.pedRef;
      if (buildings.length > 0 && buildings[0].distance < hit.distance) {
        endPoint = buildings[0].point;
        hitEnemy = null;
        hitPed = null;
      }
    } else if (buildings.length > 0) {
      endPoint = buildings[0].point;
    } else {
      endPoint = this.raycaster.ray.at(120, new THREE.Vector3());
    }
    if (hitEnemy) {
      hitEnemy.hp -= this.damage();
      if (hitEnemy.hp <= 0) this.killEnemy(hitEnemy);
    }
    if (hitPed) {
      hitPed.flee = true;
      hitPed.fleeUntil = now + 6;
    }
    // Tracer + muzzle flash.
    const start = this.game.player.mesh.position.clone();
    start.y = 1.3;
    start.add(new THREE.Vector3(Math.sin(this.game.player.camYaw), 0, Math.cos(this.game.player.camYaw)).multiplyScalar(0.5));
    this.addTracer(start, endPoint);
    this.muzzle.position.copy(start);
    this.muzzle.intensity = 6;
    setTimeout(() => {
      this.muzzle.intensity = 0;
    }, 50);
  }

  addTracer(from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }),
    );
    this.scene.add(line);
    this.tracers.push({ line, until: this.game.now + 0.07 });
  }

  update(dt, now) {
    // Tracer memudar.
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      if (now > this.tracers[i].until) {
        this.scene.remove(this.tracers[i].line);
        this.tracers[i].line.geometry.dispose();
        this.tracers.splice(i, 1);
      }
    }
    if (this.reloading && now >= this.reloadUntil) {
      this.ammo = this.magSize();
      this.reloading = false;
    }
    // Musuh menembak balik bila pemain dekat dan terlihat.
    for (const e of this.enemies) {
      const p = this.game.player.pos;
      const d = Math.hypot(p.x - e.mesh.position.x, p.z - e.mesh.position.z);
      e.mesh.rotation.y = Math.atan2(p.x - e.mesh.position.x, p.z - e.mesh.position.z);
      if (d < 45 && !this.game.player.inCar && this.game.state.mode === 'playing') {
        if (now - e.lastShot > 1.4) {
          e.lastShot = now;
          // Akurasi musuh rendah: 35% kena.
          if (Math.random() < 0.35) {
            this.game.player.damage(8, now);
            this.game.hud.flashDamage();
          }
          this.game.audio.shoot(true);
        }
        // Musuh mendekat perlahan bila terlalu jauh.
        if (d > 18) {
          const step = 2.2 * dt;
          e.mesh.position.x += ((p.x - e.mesh.position.x) / d) * step;
          e.mesh.position.z += ((p.z - e.mesh.position.z) / d) * step;
        }
      }
    }
  }

  spawnEnemies(spots) {
    this.clearEnemies();
    for (const s of spots) {
      const mesh = this.makeVultureMesh();
      mesh.position.set(s.x, 0, s.z);
      this.scene.add(mesh);
      const enemy = { mesh, hp: 60, lastShot: 0, walkPhase: 0 };
      mesh.userData.enemyRef = enemy;
      this.enemies.push(enemy);
    }
  }

  makeVultureMesh() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.75, 1.05, 0.45),
      new THREE.MeshLambertMaterial({ color: 0x8a1a1a }),
    );
    body.position.y = 1.05;
    body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.42, 0.42),
      new THREE.MeshLambertMaterial({ color: 0xc89878 }),
    );
    head.position.y = 1.82;
    g.add(head);
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.12, 0.46),
      new THREE.MeshLambertMaterial({ color: 0x1a1a1a }),
    );
    band.position.y = 1.95;
    g.add(band);
    const legMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.8, 0.3), legMat);
    legL.position.set(-0.18, 0.4, 0);
    g.add(legL);
    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.8, 0.3), legMat);
    legR.position.set(0.18, 0.4, 0);
    g.add(legR);
    const gun = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.12, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x141414 }),
    );
    gun.position.set(0.45, 1.25, 0.3);
    g.add(gun);
    return g;
  }

  killEnemy(enemy) {
    const idx = this.enemies.indexOf(enemy);
    if (idx >= 0) this.enemies.splice(idx, 1);
    this.scene.remove(enemy.mesh);
    this.game.hud.showBanner('Satu Vulture tumbang!');
  }

  enemiesAlive() {
    return this.enemies.length;
  }

  clearEnemies() {
    for (const e of this.enemies) this.scene.remove(e.mesh);
    this.enemies = [];
  }
}
