// Solmar, the city: a 40 m road grid with instanced low-poly buildings (one shared window
// texture), roads and sidewalks, palm trees and lamps, a central park, a dockside with
// containers, and a beach with the sea to the south. All static meshes are built once; the
// collision boxes (building footprints) are what the cars and the player run into.
import * as THREE from 'three';
import { CITY_HALF, GRID, PALETTE, ROAD_W, SIDEWALK_W } from './config.js';

/** Window texture shared by every building: a warm facade with lit and dark windows. */
function makeWindowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  g.fillStyle = '#f5ead2';
  g.fillRect(0, 0, 128, 256);
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const lit = ((row * 4 + col) % 5) === 0;
      g.fillStyle = lit ? '#ffe9a8' : '#5a7d92';
      g.fillRect(14 + col * 28, 16 + row * 30, 18, 20);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function box(w, h, d, color, x, y, z) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color }),
  );
  mesh.position.set(x, y, z);
  return mesh;
}

export function createCity(scene, random) {
  const colliders = [];
  const group = new THREE.Group();
  scene.add(group);

  // Ground: grass inland, sand on the beach strip, sea beyond it.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_HALF * 2 + 60, CITY_HALF * 2 + 60),
    new THREE.MeshLambertMaterial({ color: PALETTE.grass }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 0);
  ground.receiveShadow = false;
  group.add(ground);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_HALF * 2 + 60, 46),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0, CITY_HALF + 23);
  group.add(sand);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_HALF * 2 + 400, 200),
    new THREE.MeshLambertMaterial({ color: PALETTE.sea, transparent: true, opacity: 0.92 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.02, CITY_HALF + 146);
  group.add(sea);

  // Roads and sidewalks on every grid line.
  const roadMat = new THREE.MeshLambertMaterial({ color: PALETTE.asphalt });
  const walkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  const span = CITY_HALF * 2 + 20;
  for (let line = -CITY_HALF; line <= CITY_HALF; line += GRID) {
    const roadX = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, span), roadMat);
    roadX.rotation.x = -Math.PI / 2;
    roadX.position.set(line, 0.01, 0);
    group.add(roadX);
    const roadZ = new THREE.Mesh(new THREE.PlaneGeometry(span, ROAD_W), roadMat);
    roadZ.rotation.x = -Math.PI / 2;
    roadZ.position.set(0, 0.01, line);
    group.add(roadZ);
    for (const side of [-1, 1]) {
      const walkX = new THREE.Mesh(new THREE.PlaneGeometry(SIDEWALK_W, span), walkMat);
      walkX.rotation.x = -Math.PI / 2;
      walkX.position.set(line + side * (ROAD_W / 2 + SIDEWALK_W / 2), 0.02, 0);
      group.add(walkX);
      const walkZ = new THREE.Mesh(new THREE.PlaneGeometry(span, SIDEWALK_W), walkMat);
      walkZ.rotation.x = -Math.PI / 2;
      walkZ.position.set(0, 0.02, line + side * (ROAD_W / 2 + SIDEWALK_W / 2));
      group.add(walkZ);
    }
  }
  // Crosswalk stripes at the central intersections.
  const stripeMat = new THREE.MeshLambertMaterial({ color: '#e8e6df' });
  for (const cx of [-80, 0, 80]) {
    for (const cz of [-80, 0, 80]) {
      for (let s = 0; s < 5; s += 1) {
        const stripe = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 8), stripeMat);
        stripe.rotation.x = -Math.PI / 2;
        stripe.position.set(cx - 4 + s * 2, 0.03, cz - 8);
        group.add(stripe);
      }
    }
  }

  // Buildings: one InstancedMesh, colours and heights varied per instance.
  const texture = makeWindowTexture();
  const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
  const buildingMat = new THREE.MeshLambertMaterial({ map: texture });
  const placements = [];
  const blockCentres = [];
  for (let bx = -CITY_HALF + GRID / 2; bx < CITY_HALF; bx += GRID) {
    for (let bz = -CITY_HALF + GRID / 2; bz < CITY_HALF; bz += GRID) {
      blockCentres.push([bx, bz]);
    }
  }
  for (const [bx, bz] of blockCentres) {
    if (bx === 0 && bz === 0) continue; // the park
    if (bx === -180 && bz === -180) continue; // the docks
    if (bz >= 180) continue; // the beachfront stays open
    const count = 1 + Math.floor(random() * 3);
    for (let i = 0; i < count; i += 1) {
      const w = 9 + random() * 12;
      const d = 9 + random() * 12;
      const h = 7 + random() * random() * 30;
      // Keep buildings clear of the sidewalk and the road: the buildable strip is the
      // block minus road, sidewalk and a 2 m margin on each side, so a car turning a
      // corner never clips a building's edge.
      const x = bx + (random() - 0.5) * (GRID - ROAD_W - SIDEWALK_W * 2 - w - 4);
      const z = bz + (random() - 0.5) * (GRID - ROAD_W - SIDEWALK_W * 2 - d - 4);
      placements.push({ x, z, w, d, h, color: PALETTE.building[Math.floor(random() * PALETTE.building.length)] });
      colliders.push({ x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2 });
    }
  }
  const buildings = new THREE.InstancedMesh(buildingGeo, buildingMat, placements.length);
  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const colour = new THREE.Color();
  placements.forEach((p, i) => {
    pos.set(p.x, p.h / 2, p.z);
    scale.set(p.w, p.h, p.d);
    matrix.compose(pos, quat, scale);
    buildings.setMatrixAt(i, matrix);
    buildings.setColorAt(i, colour.set(p.color));
  });
  buildings.instanceMatrix.needsUpdate = true;
  if (buildings.instanceColor) buildings.instanceColor.needsUpdate = true;
  group.add(buildings);

  // Central park: lawn, a pond and palms.
  const park = new THREE.Mesh(
    new THREE.CircleGeometry(15, 24),
    new THREE.MeshLambertMaterial({ color: '#5d9b4a' }),
  );
  park.rotation.x = -Math.PI / 2;
  park.position.set(0, 0.04, 0);
  group.add(park);
  const pond = new THREE.Mesh(
    new THREE.CircleGeometry(6, 20),
    new THREE.MeshLambertMaterial({ color: PALETTE.sea }),
  );
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(4, 0.05, -3);
  group.add(pond);

  // Dockside: warehouse and stacked containers at the north-west block.
  const dock = box(26, 9, 16, '#8a6f5c', -180, 4.5, -180);
  group.add(dock);
  colliders.push({ x0: -193, z0: -188, x1: -167, z1: -172 });
  const containerColours = ['#c0392b', '#2e86c1', '#e67e22', '#16a085', '#7d3c98'];
  for (let i = 0; i < 10; i += 1) {
    const cx = -196 + (i % 5) * 7;
    const cz = -160 + Math.floor(i / 5) * 7;
    const c = box(6, 2.6, 2.6, containerColours[i % containerColours.length], cx, 1.3 + (i % 2) * 2.6, cz);
    group.add(c);
    colliders.push({ x0: cx - 3, z0: cz - 1.3, x1: cx + 3, z1: cz + 1.3 });
  }

  // Palm trees: instanced trunks and canopies, along sidewalks and the beach.
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 5, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: '#8a6f4d' });
  const canopyGeo = new THREE.IcosahedronGeometry(2.2, 0);
  const canopyMat = new THREE.MeshLambertMaterial({ color: '#4d8f3f', flatShading: true });
  const treeSpots = [];
  for (let i = 0; i < 90; i += 1) {
    const onBeach = random() < 0.25;
    const x = onBeach ? -190 + random() * 380 : -190 + random() * 380;
    const z = onBeach ? 204 + random() * 26 : -190 + random() * 380;
    if (!onBeach && Math.abs(((x + 200) % GRID) - 20) < 9) continue;
    treeSpots.push([x, z]);
  }
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeSpots.length);
  const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, treeSpots.length);
  treeSpots.forEach(([x, z], i) => {
    pos.set(x, 2.5, z);
    scale.set(1, 1, 1);
    matrix.compose(pos, quat, scale);
    trunks.setMatrixAt(i, matrix);
    pos.set(x, 5.6, z);
    matrix.compose(pos, quat, scale);
    canopies.setMatrixAt(i, matrix);
  });
  trunks.instanceMatrix.needsUpdate = true;
  canopies.instanceMatrix.needsUpdate = true;
  group.add(trunks);
  group.add(canopies);

  // Lamps along the roads.
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 5.5, 5);
  const poleMat = new THREE.MeshLambertMaterial({ color: '#3c4148' });
  const lampGeo = new THREE.SphereGeometry(0.35, 8, 6);
  const lampMat = new THREE.MeshLambertMaterial({ color: '#ffe9a8', emissive: '#ffdf8a', emissiveIntensity: 0.7 });
  const lampSpots = [];
  for (let line = -CITY_HALF; line <= CITY_HALF; line += GRID) {
    for (let along = -180; along <= 180; along += 80) {
      lampSpots.push([line + 7, along]);
      lampSpots.push([along, line + 7]);
    }
  }
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, lampSpots.length);
  const lamps = new THREE.InstancedMesh(lampGeo, lampMat, lampSpots.length);
  lampSpots.forEach(([x, z], i) => {
    pos.set(x, 2.75, z);
    scale.set(1, 1, 1);
    matrix.compose(pos, quat, scale);
    poles.setMatrixAt(i, matrix);
    pos.set(x, 5.6, z);
    matrix.compose(pos, quat, scale);
    lamps.setMatrixAt(i, matrix);
  });
  poles.instanceMatrix.needsUpdate = true;
  lamps.instanceMatrix.needsUpdate = true;
  group.add(poles);
  group.add(lamps);

  // A pier reaching into the sea, with a few moored boats (boxes with a mast).
  const pier = box(8, 1, 30, '#7a5c42', 120, 0.5, CITY_HALF + 40);
  group.add(pier);
  for (let i = 0; i < 3; i += 1) {
    const boat = box(4, 1.6, 9, ['#e8e4da', '#c0392b', '#2e86c1'][i], 108 + i * 12, 0.8, CITY_HALF + 62);
    group.add(boat);
    const mast = box(0.3, 6, 0.3, '#5a4632', 108 + i * 12, 4, CITY_HALF + 62);
    group.add(mast);
  }

  return {
    colliders,
    /** The nearest point on a road centreline to (x, z). */
    nearestRoad(x, z) {
      const snap = (v) => Math.max(-CITY_HALF, Math.min(CITY_HALF, Math.round(v / GRID) * GRID));
      const rx = snap(x);
      const rz = snap(z);
      return Math.abs(x - rx) < Math.abs(z - rz) ? { x: rx, z } : { x, z: rz };
    },
    /** True when (x, z) is on a road surface (not a sidewalk or a block). */
    isOnRoad(x, z) {
      const nearX = Math.abs(x - Math.round(x / GRID) * GRID) <= ROAD_W / 2;
      const nearZ = Math.abs(z - Math.round(z / GRID) * GRID) <= ROAD_W / 2;
      return nearX || nearZ;
    },
    randomRoadPoint(randomFn) {
      const line = -CITY_HALF + Math.floor(randomFn() * 11) * GRID;
      const along = -CITY_HALF + randomFn() * CITY_HALF * 2;
      return randomFn() < 0.5 ? { x: line, z: along } : { x: along, z: line };
    },
  };
}
