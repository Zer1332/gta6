// SOLMAR — the city itself: a procedural coastal town on an 80 m road grid.
// The ground is one big canvas texture (asphalt roads, lane dashes, sidewalks,
// crosswalks, a sandy beach and the sea), so the whole street plan costs a
// single draw call. Buildings are boxes with a shared lit-window texture,
// tinted by district colour; downtown blocks grow towers, the south edge grows
// the dock district and palm trees. Every building also registers an AABB
// collider the cars, pedestrians and the player all respect.
import * as THREE from 'three';
import { PALETTE, PLACES, SOLMAR, SUNSET } from './config.js';
import { chance, intRange, pick, range } from './random.js';

function makeGroundTexture(rng) {
  const size = 1024;
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const g = cv.getContext('2d');
  const toPx = (v) => ((v + SOLMAR.cityHalf) / (SOLMAR.cityHalf * 2)) * size;
  // Base: dry grass and dirt lots between the roads.
  g.fillStyle = '#7a6f52';
  g.fillRect(0, 0, size, size);
  // Beach and sea along the south edge.
  g.fillStyle = '#c9b078';
  g.fillRect(0, toPx(SOLMAR.waterZ - 22), size, toPx(SOLMAR.waterZ) - toPx(SOLMAR.waterZ - 22));
  g.fillStyle = '#1d5f7a';
  g.fillRect(0, toPx(SOLMAR.waterZ), size, size - toPx(SOLMAR.waterZ));
  g.fillStyle = 'rgba(255,255,255,0.25)';
  for (let i = 0; i < 40; i += 1) {
    const y = toPx(SOLMAR.waterZ) + rng() * (size - toPx(SOLMAR.waterZ));
    g.fillRect(rng() * size, y, 30 + rng() * 70, 2);
  }
  // Sidewalk slabs: one pale square per city block.
  g.fillStyle = PALETTE.sidewalk;
  for (let bx = -SOLMAR.cityHalf; bx < SOLMAR.cityHalf; bx += SOLMAR.roadGap) {
    for (let bz = -SOLMAR.cityHalf; bz < SOLMAR.waterZ - 40; bz += SOLMAR.roadGap) {
      g.fillRect(toPx(bx + 8), toPx(bz + 8), toPx(bx + SOLMAR.roadGap - 8) - toPx(bx + 8), toPx(bz + SOLMAR.roadGap - 8) - toPx(bz + 8));
    }
  }
  // Roads: dark asphalt ribbons between the slabs.
  g.fillStyle = PALETTE.asphalt;
  for (let c = -SOLMAR.cityHalf; c <= SOLMAR.cityHalf; c += SOLMAR.roadGap) {
    g.fillRect(0, toPx(c - 8), size, toPx(c + 8) - toPx(c - 8));
    g.fillRect(toPx(c - 8), 0, toPx(c + 8) - toPx(c - 8), toPx(SOLMAR.waterZ));
  }
  // Lane dashes and crosswalks.
  g.fillStyle = '#d8c25a';
  for (let c = -SOLMAR.cityHalf; c <= SOLMAR.cityHalf; c += SOLMAR.roadGap) {
    for (let v = -SOLMAR.cityHalf + 12; v < SOLMAR.cityHalf; v += 16) {
      g.fillRect(toPx(v), toPx(c - 1), toPx(v + 6) - toPx(v), 2);
      g.fillRect(toPx(c - 1), toPx(v), 2, toPx(v + 6) - toPx(v));
    }
  }
  g.fillStyle = 'rgba(240,240,240,0.85)';
  for (let c = -SOLMAR.cityHalf; c <= SOLMAR.cityHalf; c += SOLMAR.roadGap) {
    for (let d = -SOLMAR.cityHalf; d <= SOLMAR.cityHalf; d += SOLMAR.roadGap) {
      for (let k = -6; k <= 6; k += 4) {
        g.fillRect(toPx(d + k), toPx(c - 10), 2, 4);
        g.fillRect(toPx(d + k), toPx(c + 6), 2, 4);
      }
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeWindowTexture() {
  const cv = document.createElement('canvas');
  cv.width = 64;
  cv.height = 128;
  const g = cv.getContext('2d');
  // A pale base: the texture multiplies the tint colour, so a dark base
  // would turn every tower black. Lit windows glow, unlit ones stay blue-grey.
  g.fillStyle = '#9aa0ab';
  g.fillRect(0, 0, 64, 128);
  for (let y = 8; y < 120; y += 16) {
    for (let x = 8; x < 56; x += 16) {
      const lit = Math.random() < 0.45;
      g.fillStyle = lit ? '#ffd98a' : '#3a4a5e';
      g.fillRect(x, y, 9, 11);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makePalm(rng) {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5c38 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f7a3a, side: THREE.DoubleSide });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, 6, 6), trunkMat);
  trunk.position.y = 3;
  trunk.rotation.z = range(rng, -0.08, 0.08);
  group.add(trunk);
  for (let i = 0; i < 6; i += 1) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.4, 4), leafMat);
    leaf.position.y = 6.2;
    leaf.rotation.z = Math.PI / 2.4;
    leaf.rotation.y = (i / 6) * Math.PI * 2;
    leaf.translateY(1.2);
    group.add(leaf);
  }
  return group;
}

export function buildCity(scene, rng) {
  const colliders = [];
  const buildings = [];
  const windowTex = makeWindowTexture();
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const materials = PALETTE.building.map(
    (c) => new THREE.MeshLambertMaterial({ color: c, map: windowTex }),
  );

  // Ground: one textured plane for the whole 800 m.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(SOLMAR.cityHalf * 2, SOLMAR.cityHalf * 2),
    new THREE.MeshLambertMaterial({ map: makeGroundTexture(rng) }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Sea plane, slightly below the beach, catching the sunset.
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(SOLMAR.cityHalf * 2, 90),
    new THREE.MeshLambertMaterial({ color: PALETTE.water, transparent: true, opacity: 0.92 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.4, SOLMAR.waterZ + 45);
  scene.add(sea);

  // Buildings, block by block. Blocks sit BETWEEN the roads, so their centres
  // are offset half a road gap from the road lines (roads run on multiples
  // of 80, block centres on -360, -280, ...). Downtown (near the centre)
  // grows towers.
  for (let bx = -SOLMAR.cityHalf + SOLMAR.roadGap / 2; bx < SOLMAR.cityHalf; bx += SOLMAR.roadGap) {
    for (let bz = -SOLMAR.cityHalf + SOLMAR.roadGap / 2; bz < SOLMAR.waterZ - 60; bz += SOLMAR.roadGap) {
      const distCentre = Math.hypot(bx, bz);
      const downtown = distCentre < 150;
      const count = downtown ? intRange(rng, 1, 2) : intRange(rng, 1, 3);
      for (let n = 0; n < count; n += 1) {
        const w = range(rng, 16, 30);
        const d = range(rng, 16, 30);
        const h = downtown ? range(rng, 45, 110) : range(rng, 10, 34);
        const x = bx + range(rng, -14, 14);
        const z = bz + range(rng, -14, 14);
        // Keep the mission lots clear of buildings.
        const nearLot = (p) => Math.hypot(x - p.x, z - p.z) < 42;
        if (nearLot(PLACES.parking) || nearLot(PLACES.garage) || nearLot(PLACES.hospital)) continue;
        const mesh = new THREE.Mesh(boxGeo, pick(rng, materials));
        mesh.scale.set(w, h, d);
        mesh.position.set(x, h / 2, z);
        mesh.castShadow = true;
        scene.add(mesh);
        buildings.push(mesh);
        colliders.push({ x, z, hx: w / 2 + 0.4, hz: d / 2 + 0.4 });
      }
    }
  }

  // Dock district: crates, containers and a pier along the water.
  const crateGeo = new THREE.BoxGeometry(1, 1, 1);
  const crateMats = [0xb0562e, 0x2e6b8a, 0x6b8a2e, 0x8a2e5e].map(
    (c) => new THREE.MeshLambertMaterial({ color: c }),
  );
  for (let i = 0; i < 26; i += 1) {
    const w = range(rng, 4, 10);
    const h = range(rng, 2.5, 6);
    const d = range(rng, 4, 8);
    const x = range(rng, -260, 260);
    const z = range(rng, 285, 330);
    // Keep the delivery point itself clear: the Sunset Run ends here.
    if (Math.hypot(x - PLACES.dock.x, z - PLACES.dock.z) < 25) continue;
    const crate = new THREE.Mesh(crateGeo, pick(rng, crateMats));
    crate.scale.set(w, h, d);
    crate.position.set(x, h / 2, z);
    crate.rotation.y = chance(rng, 0.5) ? 0 : Math.PI / 2;
    crate.castShadow = true;
    scene.add(crate);
    colliders.push({ x, z, hx: Math.max(w, d) / 2 + 0.3, hz: Math.max(w, d) / 2 + 0.3 });
  }
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x6b4e2e });
  for (const px of [-180, 0, 180]) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(14, 1.2, 46), pierMat);
    pier.position.set(px, 0.6, SOLMAR.waterZ + 12);
    scene.add(pier);
  }

  // Street props: lamps at intersections, hydrants and benches on sidewalks.
  const lampPole = new THREE.MeshLambertMaterial({ color: 0x2c2f36 });
  const lampGlow = new THREE.MeshBasicMaterial({ color: 0xffe6a8 });
  const lampGeo = new THREE.CylinderGeometry(0.09, 0.12, 6.5, 6);
  const bulbGeo = new THREE.SphereGeometry(0.32, 8, 6);
  for (let cx = -SOLMAR.cityHalf; cx <= SOLMAR.cityHalf; cx += SOLMAR.roadGap) {
    for (let cz = -SOLMAR.cityHalf; cz < SOLMAR.waterZ - 40; cz += SOLMAR.roadGap) {
      if (!chance(rng, 0.55)) continue;
      const pole = new THREE.Mesh(lampGeo, lampPole);
      pole.position.set(cx + 9.5, 3.25, cz + 9.5);
      scene.add(pole);
      const bulb = new THREE.Mesh(bulbGeo, lampGlow);
      bulb.position.set(cx + 9.5, 6.6, cz + 9.5);
      scene.add(bulb);
    }
  }
  const hydrantMat = new THREE.MeshLambertMaterial({ color: 0xc23b2e });
  const hydrantGeo = new THREE.CylinderGeometry(0.28, 0.34, 0.9, 8);
  for (let i = 0; i < 18; i += 1) {
    const h = new THREE.Mesh(hydrantGeo, hydrantMat);
    h.position.set(range(rng, -320, 320), 0.45, range(rng, -320, 280));
    scene.add(h);
  }

  // Palm trees along the beachfront.
  for (let x = -360; x <= 360; x += 26) {
    if (chance(rng, 0.75)) {
      const palm = makePalm(rng);
      palm.position.set(x + range(rng, -6, 6), 0, SOLMAR.waterZ - 26 + range(rng, -4, 4));
      scene.add(palm);
    }
  }

  // Mara's garage: a low teal block with a glowing sign band.
  const garage = new THREE.Mesh(
    new THREE.BoxGeometry(26, 9, 18),
    new THREE.MeshLambertMaterial({ color: 0x2e7a7a, map: windowTex }),
  );
  garage.position.set(PLACES.garage.x, 4.5, PLACES.garage.z);
  garage.castShadow = true;
  scene.add(garage);
  colliders.push({ x: PLACES.garage.x, z: PLACES.garage.z, hx: 13.4, hz: 9.4 });
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(20, 1.6, 0.4),
    new THREE.MeshBasicMaterial({ color: 0xffd24c }),
  );
  sign.position.set(PLACES.garage.x, 8.2, PLACES.garage.z - 9.2);
  scene.add(sign);

  // Hospital: a white cross-topped block at the north-west corner.
  const hospital = new THREE.Mesh(
    new THREE.BoxGeometry(24, 14, 20),
    new THREE.MeshLambertMaterial({ color: 0xe8e4da, map: windowTex }),
  );
  hospital.position.set(PLACES.hospital.x, 7, PLACES.hospital.z);
  hospital.castShadow = true;
  scene.add(hospital);
  colliders.push({ x: PLACES.hospital.x, z: PLACES.hospital.z, hx: 12.4, hz: 10.4 });

  return { colliders, buildings, ground };
}

// True when point (x, z) with radius r hits any building collider.
export function hitsCollider(colliders, x, z, r) {
  for (let i = 0; i < colliders.length; i += 1) {
    const c = colliders[i];
    if (Math.abs(x - c.x) < c.hx + r && Math.abs(z - c.z) < c.hz + r) return c;
  }
  return null;
}

// Push a circle out of every collider it overlaps; returns the corrected point.
export function resolveColliders(colliders, x, z, r) {
  for (let i = 0; i < colliders.length; i += 1) {
    const c = colliders[i];
    const dx = x - c.x;
    const dz = z - c.z;
    const px = c.hx + r - Math.abs(dx);
    const pz = c.hz + r - Math.abs(dz);
    if (px > 0 && pz > 0) {
      if (px < pz) x = c.x + Math.sign(dx || 1) * (c.hx + r);
      else z = c.z + Math.sign(dz || 1) * (c.hz + r);
    }
  }
  return { x, z };
}

export { SUNSET };
