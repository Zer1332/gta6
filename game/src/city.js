// SOLMAR — city.js
// Membangun kota prosedural: tanah, jalan grid, bangunan, lampu jalan,
// hidran, bangku, pohon palem di tepi air, laut, dan dermaga.
// Mengembalikan daftar collider AABB supaya pemain/mobil tak menembus gedung.

export function buildCity(G) {
  const { scene, rng, config } = G;
  const colliders = [];
  const S = config.worldSize;
  const half = S / 2;
  const step = config.roadStep;
  const roadW = config.roadWidth;

  const mat = (color, opts) => new THREE.MeshLambertMaterial({ color, ...(opts || {}) });
  const box = (w, h, d, color, x, y, z, opts) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
    m.position.set(x, y, z);
    scene.add(m);
    return m;
  };

  // Tanah dasar (rumput/asphalt kota).
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(S, S),
    mat(0x3a4a3a)
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 0);
  scene.add(ground);

  // Laut di utara (z > waterZ) + pantai pasir.
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(S, 220), mat(0x1a5a8a));
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.05, config.waterZ + 105);
  scene.add(sea);
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(S, 14), mat(0xc2b280));
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(0, 0.04, config.waterZ - 2);
  scene.add(beach);

  // Jalan grid: bidang gelap memanjang + garis tengah kuning.
  const roadMat = mat(0x2b2b2e);
  const lineMat = mat(0xd8b93a);
  for (let c = -half + step; c <= half - step; c += step) {
    // Jalan vertikal (sejajar sumbu z) dan horizontal (sejajar sumbu x).
    const v = new THREE.Mesh(new THREE.PlaneGeometry(roadW, S - 60), roadMat);
    v.rotation.x = -Math.PI / 2;
    v.position.set(c, 0.02, -30);
    scene.add(v);
    const h = new THREE.Mesh(new THREE.PlaneGeometry(S, roadW), roadMat);
    h.rotation.x = -Math.PI / 2;
    h.position.set(0, 0.02, c);
    scene.add(h);
    // Garis tengah putus-putus (kotak-kotak kecil).
    for (let t = -half + 20; t < half - 40; t += 16) {
      const d1 = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 5), lineMat);
      d1.rotation.x = -Math.PI / 2;
      d1.position.set(c, 0.03, t);
      scene.add(d1);
      const d2 = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.6), lineMat);
      d2.rotation.x = -Math.PI / 2;
      d2.position.set(t, 0.03, c);
      scene.add(d2);
    }
  }

  // Jalan lingkar di tepi kota.
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(S - 20, roadW), roadMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(0, 0.02, -half + 14);
  scene.add(ring);

  // Bangunan prosedural di tiap blok (hindari jalan dan area dermaga).
  const palette = [0x8a7f72, 0x6e7f8a, 0x9a8a6a, 0x7a6a7f, 0x5f6e5a, 0xb09a7a, 0x746a5e, 0x4a5a6e];
  const towerPalette = [0x3a4a5e, 0x4e3a4a, 0x2e3e4e, 0x5a4a3a];
  for (let bx = -half + step; bx < half - step; bx += step) {
    for (let bz = -half + step; bz < half - step; bz += step) {
      if (bz > 210) continue; // area dermaga: tanpa gedung
      if (Math.abs(bx) < 45 && Math.abs(bz) < 45) continue; // plaza pusat
      if (Math.abs(bx + 240) < 40 && Math.abs(bz - 180) < 40) continue; // garasi Mara
      if (Math.abs(bx - 150) < 45 && Math.abs(bz + 150) < 45) continue; // parkiran sedan misi 1
      if (Math.abs(bx + 300) < 40 && Math.abs(bz + 240) < 40) continue; // rumah sakit
      const cx = bx + step / 2;
      const cz = bz + step / 2;
      const isDowntown = Math.abs(cx) < 150 && Math.abs(cz) < 150;
      const n = rng.int(1, 2);
      for (let i = 0; i < n; i++) {
        const w = rng.range(16, 30);
        const d = rng.range(16, 30);
        const h = isDowntown ? rng.range(35, 95) : rng.range(9, 30);
        const ox = cx + (n > 1 ? (i === 0 ? -11 : 11) : 0);
        const oz = cz + (n > 1 ? (i === 0 ? -11 : 11) : 0);
        const color = isDowntown && h > 60 ? rng.pick(towerPalette) : rng.pick(palette);
        const b = box(w, h, d, color, ox, h / 2, oz);
        // Atap sedikit lebih gelap.
        const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.8, d + 0.6), mat(0x222226));
        roof.position.set(ox, h + 0.4, oz);
        scene.add(roof);
        // Jendela menyala: kotak-kotak emissive di fasad (murah, tanpa tekstur).
        if (h > 20) {
          const winMat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
          const floors = Math.floor(h / 7);
          for (let f = 0; f < floors; f++) {
            for (let wx = -1; wx <= 1; wx++) {
              if (rng.next() < 0.45) continue;
              const win = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.6), winMat);
              win.position.set(ox + wx * (w / 3.4), 4 + f * 7, oz + d / 2 + 0.06);
              scene.add(win);
            }
          }
        }
        colliders.push({ minX: ox - w / 2, maxX: ox + w / 2, minZ: oz - d / 2, maxZ: oz + d / 2 });
        void b;
      }
    }
  }

  // Garasi Mara (bangunan rendah dengan pintu besar) + rumah sakit.
  const garage = box(34, 10, 22, 0x7a4a3a, -240, 5, 180);
  void garage;
  const door = new THREE.Mesh(new THREE.PlaneGeometry(16, 7), new THREE.MeshBasicMaterial({ color: 0x2a2a30 }));
  door.position.set(-240, 3.5, 180 - 11.1);
  door.rotation.y = Math.PI;
  scene.add(door);
  colliders.push({ minX: -257, maxX: -223, minZ: 169, maxZ: 191 });
  const hosp = box(36, 16, 24, 0xe8e8e8, -300, 8, -240);
  void hosp;
  colliders.push({ minX: -318, maxX: -282, minZ: -252, maxZ: -228 });
  const cross = new THREE.Mesh(new THREE.BoxGeometry(8, 2, 1), new THREE.MeshBasicMaterial({ color: 0xd43a3a }));
  cross.position.set(-300, 18, -252.1);
  scene.add(cross);

  // Dermaga: papan kayu menjorok ke laut + gudang + kontainer.
  for (let px = 120; px <= 360; px += 60) {
    box(24, 1.2, 60, 0x6e5136, px, 0.6, config.dockZ + 20);
  }
  box(30, 12, 20, 0x8a6a4a, 200, 6, 250);
  colliders.push({ minX: 185, maxX: 215, minZ: 240, maxZ: 260 });
  const contColors = [0xb03a2e, 0x2e6eb0, 0x3a8a4a, 0xd08a2e];
  for (let i = 0; i < 8; i++) {
    const cx = 150 + (i % 4) * 26;
    const cz = 236 + Math.floor(i / 4) * 14;
    box(12, 5, 6, contColors[i % 4], cx, 2.5, cz);
    colliders.push({ minX: cx - 6, maxX: cx + 6, minZ: cz - 3, maxZ: cz + 3 });
  }

  // Lampu jalan di tiap persimpangan + hidran + bangku di plaza.
  const poleMat = mat(0x333338);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (let c = -half + step; c <= half - step; c += step) {
    for (let d = -half + step; d <= half - step; d += step) {
      if (d > 210) continue;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 7, 6), poleMat);
      pole.position.set(c + 8, 3.5, d + 8);
      scene.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), lampMat);
      lamp.position.set(c + 8, 7.2, d + 8);
      scene.add(lamp);
      if (rng.next() < 0.3) {
        box(1.2, 1, 1.2, 0xc23a2e, c - 8, 0.5, d - 8); // hidran
      }
    }
  }
  for (let i = 0; i < 6; i++) {
    box(4, 1, 1.4, 0x6a4a2a, -20 + i * 8, 0.6, -20);
  }

  // Pohon palem di sepanjang tepi air.
  for (let x = -380; x <= 380; x += 34) {
    const px = x + rng.range(-6, 6);
    const pz = 292 + rng.range(-3, 3);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 9, 6), mat(0x6a4a2a));
    trunk.position.set(px, 4.5, pz);
    scene.add(trunk);
    const leaves = new THREE.Mesh(new THREE.SphereGeometry(3.4, 8, 6), mat(0x2e7a3a));
    leaves.scale.y = 0.55;
    leaves.position.set(px, 9.6, pz);
    scene.add(leaves);
  }

  // Plaza pusat: lingkaran terang + air mancur kecil.
  const plaza = new THREE.Mesh(new THREE.CylinderGeometry(26, 26, 0.4, 24), mat(0x9a9a92));
  plaza.position.set(0, 0.2, 0);
  scene.add(plaza);
  const fountain = new THREE.Mesh(new THREE.CylinderGeometry(6, 7, 2.4, 16), mat(0x4a7a9a));
  fountain.position.set(0, 1.2, 0);
  scene.add(fountain);

  G.colliders = colliders;
  return colliders;
}
