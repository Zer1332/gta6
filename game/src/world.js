// SOLMAR — world.js
// Pejalan kaki di trotoar (lari saat ada tembakan) dan siklus siang-malam:
// matahari senja yang perlahan bergerak, langit dan kabut berubah warna,
// lampu jalan menyala saat gelap.

import { CONFIG, PALETTE } from './config.js';

function makePedMesh(rng) {
  const g = new THREE.Group();
  const shirt = rng.pick([0xc0a040, 0x4080c0, 0x8040a0, 0x40a080, 0xc06060, 0x808080]);
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.65, 0.95, 0.38),
    new THREE.MeshLambertMaterial({ color: shirt }),
  );
  body.position.y = 1.0;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.4, 0.4),
    new THREE.MeshLambertMaterial({ color: rng.pick([0xd8a880, 0xb08060, 0xe8c090]) }),
  );
  head.position.y = 1.72;
  g.add(head);
  const legMat = new THREE.MeshLambertMaterial({ color: 0x2a2a3a });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.75, 0.28), legMat);
  legL.position.set(-0.17, 0.38, 0);
  g.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.75, 0.28), legMat);
  legR.position.set(0.17, 0.38, 0);
  g.add(legR);
  g.userData.legL = legL;
  g.userData.legR = legR;
  return g;
}

export class World {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.rng = game.rng;
    this.pedestrians = [];
    this.timeOfDay = 0.32; // 0..1, mulai sore menjelang senja
    this.sun = null;
    this.ambient = null;
    this.hemi = null;
  }

  initLights() {
    this.sun = new THREE.DirectionalLight(0xffb070, 1.6);
    this.sun.position.set(200, 180, 100);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -450;
    this.sun.shadow.camera.right = 450;
    this.sun.shadow.camera.top = 450;
    this.sun.shadow.camera.bottom = -450;
    this.sun.shadow.camera.far = 1200;
    this.scene.add(this.sun);
    this.hemi = new THREE.HemisphereLight(0xffd0a0, 0x404050, 0.7);
    this.scene.add(this.hemi);
    this.ambient = new THREE.AmbientLight(0x604050, 0.4);
    this.scene.add(this.ambient);
    this.scene.fog = new THREE.Fog(PALETTE.fog, 300, 1100);
    return this;
  }

  spawnPedestrians(count) {
    for (let i = 0; i < count; i++) {
      const mesh = makePedMesh(this.rng);
      const x = this.rng.range(-390, 390);
      const z = this.rng.range(-390, 390);
      mesh.position.set(x, 0, z);
      this.scene.add(mesh);
      const ped = {
        mesh,
        speed: this.rng.range(1.2, 2.4),
        heading: this.rng.range(0, Math.PI * 2),
        walkPhase: this.rng.range(0, 6),
        flee: false,
        fleeUntil: 0,
        retargetAt: 0,
      };
      mesh.userData.pedRef = ped;
      this.pedestrians.push(ped);
    }
    return this;
  }

  update(dt, now) {
    // Siklus siang-malam: satu putaran penuh ~8 menit.
    this.timeOfDay = (this.timeOfDay + dt / 480) % 1;
    const day = Math.sin(this.timeOfDay * Math.PI * 2); // 1 = siang, -1 = malam
    const sunH = Math.max(0.08, day * 0.7 + 0.3);
    const angle = this.timeOfDay * Math.PI * 2;
    this.sun.position.set(Math.cos(angle) * 300, 60 + sunH * 220, Math.sin(angle) * 300);
    const warmth = Math.max(0, 1 - Math.abs(day - 0.3) * 2);
    this.sun.color.setHSL(0.07 + warmth * 0.02, 0.7, 0.45 + sunH * 0.2);
    this.sun.intensity = 0.5 + sunH * 1.3;
    this.hemi.intensity = 0.35 + Math.max(0, day) * 0.45;
    const night = Math.max(0, -day);
    this.scene.background = new THREE.Color().setHSL(0.07, 0.55, 0.55 - night * 0.35);
    this.scene.fog.color.setHSL(0.07, 0.5, 0.5 - night * 0.3);

    // Pejalan kaki.
    const playerPos = this.game.player.pos;
    for (const p of this.pedestrians) {
      const fleeing = p.flee && now < p.fleeUntil;
      const speed = fleeing ? p.speed * 3.2 : p.speed;
      if (fleeing) {
        // Lari menjauhi pemain.
        const dx = p.mesh.position.x - playerPos.x;
        const dz = p.mesh.position.z - playerPos.z;
        p.heading = Math.atan2(dx, dz);
      } else if (now > p.retargetAt) {
        // Pilih arah baru di trotoar terdekat (sepanjang jalan grid).
        p.retargetAt = now + this.rng.range(4, 10);
        p.heading = this.rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
      }
      p.mesh.position.x += Math.sin(p.heading) * speed * dt;
      p.mesh.position.z += Math.cos(p.heading) * speed * dt;
      p.mesh.rotation.y = p.heading;
      p.walkPhase += dt * speed * 3;
      p.mesh.userData.legL.rotation.x = Math.sin(p.walkPhase) * 0.6;
      p.mesh.userData.legR.rotation.x = -Math.sin(p.walkPhase) * 0.6;
      // Tetap di dalam kota, putar balik di tepi.
      if (Math.abs(p.mesh.position.x) > 395 || Math.abs(p.mesh.position.z) > 395) {
        p.heading += Math.PI;
        p.mesh.position.x = Math.max(-390, Math.min(390, p.mesh.position.x));
        p.mesh.position.z = Math.max(-390, Math.min(390, p.mesh.position.z));
      }
      if (!fleeing && p.flee) p.flee = false;
    }
  }
}
