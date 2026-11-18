// SOLMAR — city.js
// Membangun kota prosedural Solmar: jalan grid, gedung bertingkat dengan
// jendela menyala, dermaga di tepi air, taman, lampu jalan, pohon palem,
// hidran, dan bangku. Mengembalikan daftar collider (AABB) untuk fisika.

import { CONFIG, PALETTE } from './config.js';

function makeWindowTexture(rng, litRatio) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#20242c';
  g.fillRect(0, 0, 64, 128);
  for (let y = 6; y < 122; y += 12) {
    for (let x = 6; x < 58; x += 12) {
      const lit = rng.next() < litRatio;
      g.fillStyle = lit ? '#ffd27a' : '#2a3542';
      g.fillRect(x, y, 8, 8);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeRoadTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#2e2e33';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#d8c85a';
  g.fillRect(30, 4, 4, 20);
  g.fillRect(30, 40, 4, 20);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class City {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.colliders = []; // {minX, maxX, minZ, maxZ}
    this.buildings = [];
    this.group = new THREE.Group();
    this.group.name = 'city';
    scene.add(this.group);
  }

  build() {
    const { cityHalf, roadEvery, roadWidth } = CONFIG;
    this.buildGround();
    this.buildRoads();
    this.buildBlocks();
    this.buildWaterfront();
    this.buildStreetProps();
    return this;
  }

  buildGround() {
    const geo = new THREE.PlaneGeometry(CONFIG.cityHalf * 2 + 300, CONFIG.cityHalf * 2 + 300);
    const mat = new THREE.MeshLambertMaterial({ color: PALETTE.ground });
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(150, 0, 0);
    ground.receiveShadow = true;
    this.group.add(ground);

    // Pasir pantai di tepi timur.
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(30, CONFIG.cityHalf * 2),
      new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(CONFIG.waterX - 12, 0.05, 0);
    sand.receiveShadow = true;
    this.group.add(sand);

    // Laut.
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(600, CONFIG.cityHalf * 2 + 300),
      new THREE.MeshLambertMaterial({ color: PALETTE.water }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(CONFIG.waterX + 300, 0.02, 0);
    this.group.add(water);
  }

  buildRoads() {
    const tex = makeRoadTexture();
    const mat = new THREE.MeshLambertMaterial({ map: tex });
    const { cityHalf, roadEvery, roadWidth } = CONFIG;
    for (let c = -cityHalf; c <= cityHalf; c += roadEvery) {
      // Jalan arah utara-selatan (sepanjang z).
      const v = new THREE.Mesh(new THREE.PlaneGeometry(roadWidth, cityHalf * 2), mat.clone());
      v.material.map = tex.clone();
      v.material.map.repeat.set(1, cityHalf * 2 / 16);
      v.material.map.needsUpdate = true;
      v.rotation.x = -Math.PI / 2;
      v.position.set(c, 0.1, 0);
      v.receiveShadow = true;
      this.group.add(v);
      // Jalan arah timur-barat (sepanjang x).
      const h = new THREE.Mesh(new THREE.PlaneGeometry(cityHalf * 2, roadWidth), mat.clone());
      h.material.map = tex.clone();
      h.material.map.repeat.set(cityHalf * 2 / 16, 1);
      h.material.map.needsUpdate = true;
      h.rotation.x = -Math.PI / 2;
      h.position.set(0, 0.1, c);
      h.receiveShadow = true;
      this.group.add(h);
    }
  }

  // Satu blok kota = 1-4 gedung; pusat kota lebih tinggi, ada taman & dermaga.
  buildBlocks() {
    const { rng } = this;
    const winTex = makeWindowTexture(rng, 0.35);
    const centers = [];
    for (let x = -350; x <= 350; x += 100) {
      for (let z = -350; z <= 350; z += 100) centers.push({ x, z });
    }
    for (const { x, z } of centers) {
      const distCenter = Math.hypot(x, z);
      // Dermaga: blok timur dekat pier jadi area pelabuhan terbuka.
      if (x === 350 && z >= 100 && z <= 200) continue;
      // Taman kota di blok (-50, 50).
      if (x === -50 && z === 50) {
        this.buildPark(x, z);
        continue;
      }
      const n = rng.int(1, 3);
      for (let i = 0; i < n; i++) {
        const w = rng.range(18, 34);
        const d = rng.range(18, 34);
        const bx = x + rng.range(-28, 28);
        const bz = z + rng.range(-28, 28);
        if (Math.abs(bx - x) + w / 2 > 42 || Math.abs(bz - z) + d / 2 > 42) continue;
        const tall = distCenter < 180 ? rng.range(40, 95) : rng.range(12, 45);
        const h = rng.chance(0.12) ? rng.range(80, 120) : tall;
        const color = rng.pick(PALETTE.building);
        const mat = new THREE.MeshLambertMaterial({ color, map: winTex });
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        b.position.set(bx, h / 2, bz);
        b.castShadow = true;
        b.receiveShadow = true;
        this.group.add(b);
        // Atap datar sedikit lebih gelap.
        const roof = new THREE.Mesh(
          new THREE.BoxGeometry(w + 0.6, 1, d + 0.6),
          new THREE.MeshLambertMaterial({ color: 0x3a3a40 }),
        );
        roof.position.set(bx, h + 0.5, bz);
        this.group.add(roof);
        this.colliders.push({ minX: bx - w / 2, maxX: bx + w / 2, minZ: bz - d / 2, maxZ: bz + d / 2 });
        this.buildings.push(b);
      }
    }
    // Rumah sakit: gedung putih khas di barat daya, titik respawn.
    const hosp = new THREE.Mesh(
      new THREE.BoxGeometry(40, 26, 30),
      new THREE.MeshLambertMaterial({ color: 0xe8e8e0, map: winTex }),
    );
    hosp.position.set(-320, 13, -320);
    hosp.castShadow = true;
    this.group.add(hosp);
    this.colliders.push({ minX: -340, maxX: -300, minZ: -335, maxZ: -305 });
    const cross = new THREE.Mesh(
      new THREE.BoxGeometry(10, 2, 2),
      new THREE.MeshBasicMaterial({ color: 0xd02020 }),
    );
    cross.position.set(-320, 28, -304);
    this.group.add(cross);
    const crossV = cross.clone();
    crossV.rotation.z = Math.PI / 2;
    this.group.add(crossV);
  }

  buildPark(x, z) {
    const { rng } = this;
    const lawn = new THREE.Mesh(
      new THREE.PlaneGeometry(84, 84),
      new THREE.MeshLambertMaterial({ color: 0x4a7a3a }),
    );
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.set(x, 0.12, z);
    lawn.receiveShadow = true;
    this.group.add(lawn);
    for (let i = 0; i < 10; i++) {
      const px = x + rng.range(-36, 36);
      const pz = z + rng.range(-36, 36);
      this.addPalm(px, pz, rng.range(0.8, 1.3));
    }
  }

  buildWaterfront() {
    const { rng } = this;
    // Dermaga kayu menjorok ke laut.
    const pier = new THREE.Mesh(
      new THREE.BoxGeometry(70, 1.5, 16),
      new THREE.MeshLambertMaterial({ color: 0x6a4a2a }),
    );
    pier.position.set(435, 0.8, 150);
    pier.castShadow = true;
    pier.receiveShadow = true;
    this.group.add(pier);
    this.colliders.push({ minX: 400, maxX: 470, minZ: 141, maxZ: 143 });
    this.colliders.push({ minX: 400, maxX: 470, minZ: 157, maxZ: 159 });
    // Tiang dermaga.
    for (let x = 405; x <= 465; x += 10) {
      for (const dz of [-7, 7]) {
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.5, 0.5, 3, 6),
          new THREE.MeshLambertMaterial({ color: 0x4a3018 }),
        );
        post.position.set(x, 0.5, 150 + dz);
        this.group.add(post);
      }
    }
    // Kontainer pelabuhan.
    const contColors = [0xb04030, 0x3070b0, 0x40a050, 0xd0a030];
    for (let i = 0; i < 6; i++) {
      const c = new THREE.Mesh(
        new THREE.BoxGeometry(12, 3, 3),
        new THREE.MeshLambertMaterial({ color: contColors[i % contColors.length] }),
      );
      c.position.set(360 + rng.range(-8, 8), 1.5, 110 + i * 8);
      c.rotation.y = rng.range(-0.1, 0.1);
      c.castShadow = true;
      this.group.add(c);
      this.colliders.push({
        minX: c.position.x - 6, maxX: c.position.x + 6,
        minZ: c.position.z - 1.6, maxZ: c.position.z + 1.6,
      });
    }
    // Pohon palem sepanjang pantai.
    for (let z = -380; z <= 380; z += 40) {
      this.addPalm(388, z + rng.range(-8, 8), rng.range(0.9, 1.4));
    }
  }

  addPalm(x, z, s) {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25 * s, 0.4 * s, 7 * s, 6),
      new THREE.MeshLambertMaterial({ color: PALETTE.palmTrunk }),
    );
    trunk.position.set(x, 3.5 * s, z);
    trunk.castShadow = true;
    this.group.add(trunk);
    for (let i = 0; i < 5; i++) {
      const leaf = new THREE.Mesh(
        new THREE.ConeGeometry(1.1 * s, 4 * s, 4),
        new THREE.MeshLambertMaterial({ color: PALETTE.palmLeaf }),
      );
      const a = (i / 5) * Math.PI * 2;
      leaf.position.set(x + Math.cos(a) * 1.4 * s, 7 * s, z + Math.sin(a) * 1.4 * s);
      leaf.rotation.z = Math.cos(a) * 1.1;
      leaf.rotation.x = -Math.sin(a) * 1.1;
      this.group.add(leaf);
    }
  }

  buildStreetProps() {
    const { rng } = this;
    // Lampu jalan di setiap persimpangan.
    const lampMat = new THREE.MeshLambertMaterial({ color: 0x303038 });
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    for (let x = -400; x <= 400; x += 100) {
      for (let z = -400; z <= 400; z += 100) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 6, 6), lampMat);
        pole.position.set(x + 8, 3, z + 8);
        this.group.add(pole);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), bulbMat);
        bulb.position.set(x + 8, 6.2, z + 8);
        this.group.add(bulb);
      }
    }
    // Hidran dan bangku tersebar.
    for (let i = 0; i < 24; i++) {
      const x = rng.range(-380, 380);
      const z = rng.range(-380, 380);
      const hydrant = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.4, 1, 8),
        new THREE.MeshLambertMaterial({ color: 0xc03028 }),
      );
      hydrant.position.set(x, 0.5, z);
      this.group.add(hydrant);
    }
    for (let i = 0; i < 16; i++) {
      const bench = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 0.5, 0.8),
        new THREE.MeshLambertMaterial({ color: 0x5a4028 }),
      );
      bench.position.set(rng.range(-380, 380), 0.5, rng.range(-380, 380));
      bench.rotation.y = rng.range(0, Math.PI);
      this.group.add(bench);
    }
  }

  // Cek tabrakan lingkaran (x, z, radius) dengan semua collider gedung.
  collideCircle(x, z, r) {
    let px = x;
    let pz = z;
    for (const c of this.colliders) {
      const cx = Math.max(c.minX, Math.min(px, c.maxX));
      const cz = Math.max(c.minZ, Math.min(pz, c.maxZ));
      const dx = px - cx;
      const dz = pz - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        px = cx + (dx / d) * r;
        pz = cz + (dz / d) * r;
      } else if (d2 <= 0.0001) {
        // Titik di dalam AABB: dorong ke sisi terdekat.
        const pushL = px - c.minX + r;
        const pushR = c.maxX - px + r;
        const pushT = pz - c.minZ + r;
        const pushB = c.maxZ - pz + r;
        const m = Math.min(pushL, pushR, pushT, pushB);
        if (m === pushL) px = c.minX - r;
        else if (m === pushR) px = c.maxX + r;
        else if (m === pushT) pz = c.minZ - r;
        else pz = c.maxZ + r;
      }
    }
    return { x: px, z: pz };
  }

  // Batas dunia: jangan sampai jatuh ke laut (kecuali di dermaga).
  clampToLand(x, z) {
    const onPier = x > 395 && x < 470 && z > 142 && z < 158;
    if (x > CONFIG.waterX && !onPier) x = CONFIG.waterX;
    x = Math.max(-CONFIG.cityHalf, Math.min(CONFIG.cityHalf + 60, x));
    z = Math.max(-CONFIG.cityHalf, Math.min(CONFIG.cityHalf, z));
    return { x, z };
  }
}
