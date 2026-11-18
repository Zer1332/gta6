// SOLMAR — main.js
// Bootstrap: baca ?shot= &seed=, bangun game, jalankan loop, dan
// sediakan window.__SOLMAR untuk playtest otomatis.

import { createGame } from './world.js';
import { applyShotMode } from './shots.js';

const params = new URLSearchParams(window.location.search);
const seed = parseInt(params.get('seed') || '1', 10) || 1;
const shot = params.get('shot') || '';

const G = createGame(seed);

if (shot) {
  applyShotMode(G, shot);
} else {
  G.hud.showStart();
}

// Loop utama dengan delta dibatasi supaya tab yang lama diam tak meloncat.
let last = performance.now();
let frames = 0;
function loop(now) {
  const dt = Math.min(0.05, Math.max(0.0001, (now - last) / 1000));
  last = now;
  try {
    G.update(dt);
  } catch (e) {
    // Satu frame gagal tak boleh mematikan seluruh game; laporkan ke console.
    console.error('SOLMAR frame error:', e);
  }
  frames += 1;
  if (frames === 3) {
    window.__SOLMAR_READY = true;
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// API untuk playtest otomatis (dan debugging): membaca state, memindahkan
// pemain/mobil, dan menembak lewat fungsi combat yang sama dengan game.
window.__SOLMAR = {
  G,
  version: '1.0.0',
  seed,
  shot: shot || null,

  state() {
    const p = G.player;
    return {
      state: G.state,
      missionIndex: G.missions.index,
      stage: G.missions.stage,
      stageDetail: G.missions.stageDetail,
      objective: G.missions.objective,
      money: p.money,
      hp: Math.round(p.hp),
      wanted: G.police.wanted,
      weapon: p.weapon,
      ammo: p.ammo[p.weapon],
      reserve: p.reserve[p.weapon],
      enemiesAlive: G.combat.aliveCount(),
      timer: Math.round(G.missions.timer * 10) / 10,
      hasPackage: G.missions.hasPackage,
      inCar: !!p.car,
      carIsSedan: !!(p.car && p.car.missionSedan),
      px: Math.round(p.pos.x * 10) / 10,
      pz: Math.round(p.pos.z * 10) / 10,
      speed: p.car ? Math.round(p.car.speed * 10) / 10 : 0,
      threeRevision: typeof THREE !== 'undefined' ? THREE.REVISION : null,
    };
  },

  start() {
    G.startGame();
  },
  callMara() {
    G.missions.callMara();
  },
  teleport(x, z) {
    const p = G.player;
    if (p.car) {
      p.car.pos.set(x, 0, z);
      p.car.mesh.position.copy(p.car.pos);
    }
    p.pos.set(x, 0, z);
    p.mesh.position.copy(p.pos);
  },
  teleportCar(x, z) {
    const p = G.player;
    if (!p.car) return false;
    p.car.pos.set(x, 0, z);
    p.car.mesh.position.copy(p.car.pos);
    p.pos.set(x, 0, z);
    p.mesh.position.copy(p.pos);
    return true;
  },
  enterNearestCar() {
    const car = G.nearestCar(6);
    if (!car) return false;
    // Masuk mobil lewat jalur game yang sama dengan tombol E.
    G.input.press('KeyE');
    return !!G.player.car;
  },
  pressKey(code) {
    G.input.press(code);
  },
  // Arahkan kamera ke musuh hidup terdekat lalu tembak dengan
  // combat.shoot() yang asli (sinar dari kamera + aim-assist).
  aimAndShoot() {
    const alive = G.combat.enemies.filter((e) => e.alive);
    if (!alive.length) return null;
    let best = alive[0];
    let bestD = Infinity;
    for (const e of alive) {
      const d = e.pos.distanceTo(G.player.pos);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    // Putar pemain menghadap musuh, lalu jepret kamera ke posisi ikut.
    const dx = best.pos.x - G.player.pos.x;
    const dz = best.pos.z - G.player.pos.z;
    const ammoBefore = G.player.ammo[G.player.weapon];
    G.player.yaw = Math.atan2(-dx, -dz);
    G.player.pitch = 0;
    G.render.updateCamera(1);
    const hit = G.combat.shoot();
    const fired = G.player.ammo[G.player.weapon] < ammoBefore;
    return { fired, hit: !!hit, hp: hit ? hit.hp : null, alive: hit ? hit.alive : null };
  },
  shoot() {
    return G.combat.shoot();
  },
  saveRaw() {
    try {
      return localStorage.getItem(G.config.saveKey);
    } catch (e) {
      return null;
    }
  },
};
