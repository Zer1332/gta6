// SOLMAR — world.js
// Lem game: merakit semua modul, state machine (start/playing/paused/
// gameover), pejalan kaki, tabrakan gedung, save/load localStorage,
// dan loop update utama.

import { CONFIG } from './config.js';
import { makeRng } from './random.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { buildCity } from './city.js';
import { spawnTraffic, spawnParkedCars, updateTraffic, updatePlayerCar } from './vehicles.js';
import { createPlayer, updatePlayer, nearestCar, enterCar, exitCar, damagePlayer, respawnPlayer } from './player.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createRenderer } from './render.js';

export function createGame(seed) {
  const G = {
    config: CONFIG,
    rng: makeRng(seed || 1),
    scene: new THREE.Scene(),
    time: 0,
    dayTime: 0.6,
    state: 'start', // start | playing | paused | gameover
    muted: false,
    shotCamera: false,
    colliders: [],
    traffic: [],
    parkedCars: [],
    peds: [],
    best: 0,
    save: null,
  };
  G.audio = createAudio();
  G.input = createInput();
  G.hud = createHud(G);
  G.player = null; // diisi di bawah
  G.police = createPolice(G);
  G.combat = createCombat(G);
  G.missions = createMissions(G);

  // --- Save / load ---
  G.loadSave = function () {
    try {
      const raw = localStorage.getItem(CONFIG.saveKey);
      G.save = raw ? JSON.parse(raw) : null;
      if (G.save && typeof G.save.best === 'number') G.best = G.save.best;
    } catch (e) {
      G.save = null;
    }
  };
  G.saveGame = function () {
    try {
      const data = {
        money: G.player.money,
        missions: G.missions.index,
        best: Math.max(G.best, G.player.money),
      };
      localStorage.setItem(CONFIG.saveKey, JSON.stringify(data));
      G.best = data.best;
    } catch (e) {}
  };
  G.loadSave();

  // --- Dunia ---
  buildCity(G);
  G.traffic = spawnTraffic(G);
  G.parkedCars = spawnParkedCars(G);
  G.player = createPlayer(G);
  if (G.save) {
    if (typeof G.save.money === 'number') G.player.money = G.save.money;
    if (typeof G.save.missions === 'number') G.missions.index = Math.min(3, G.save.missions);
  }
  G.peds = spawnPeds(G);

  // --- Render ---
  const R = createRenderer(G);
  G.renderer = R.renderer;
  G.camera = R.camera;
  G.render = R;
  G.hud.init();
  G.input.attach(document.getElementById('game-canvas'));

  // --- Helper yang dipakai modul lain ---
  G.collide = function (x, z, r) {
    for (const c of G.colliders) {
      if (x > c.minX - r && x < c.maxX + r && z > c.minZ - r && z < c.maxZ + r) {
        const pushL = x - (c.minX - r);
        const pushR = c.maxX + r - x;
        const pushU = z - (c.minZ - r);
        const pushD = c.maxZ + r - z;
        const m = Math.min(pushL, pushR, pushU, pushD);
        if (m === pushL) x = c.minX - r;
        else if (m === pushR) x = c.maxX + r;
        else if (m === pushU) z = c.minZ - r;
        else z = c.maxZ + r;
        return { x, z };
      }
    }
    return null;
  };
  G.nearestCar = (d) => nearestCar(G, d);
  G.playerDamage = (amount, cause) => damagePlayer(G, amount, cause);
  G.respawn = (reason) => respawnPlayer(G, reason);
  G.gameOver = function (reason, cause) {
    if (G.state === 'gameover') return;
    G.state = 'gameover';
    if (document.exitPointerLock) document.exitPointerLock();
    G.saveGame();
    const stats =
      reason + ' Misi selesai: ' + G.missions.index + '/3. Uang: $' + G.player.money + '. Terbaik: $' + G.best + '.';
    G.hud.showGameOver(stats);
    void cause;
  };
  G.toggleMute = function () {
    G.muted = !G.muted;
    G.audio.setMuted(G.muted);
    const b = document.getElementById('mute-btn');
    if (b) b.textContent = G.muted ? '🔇 Suara: Mati' : '🔊 Suara: Hidup';
  };

  G.startGame = function () {
    G.audio.ensure();
    G.state = 'playing';
    G.hud.showPlaying();
    if (G.missions.index < 3 && G.missions.stage === 'idle') {
      G.missions.start();
    }
  };

  G.pauseGame = function () {
    if (G.state !== 'playing') return;
    G.state = 'paused';
    if (document.exitPointerLock) document.exitPointerLock();
    G.hud.showPause();
  };

  G.resumeGame = function () {
    if (G.state !== 'paused') return;
    G.state = 'playing';
    G.hud.showPlaying();
  };

  G.restartRun = function () {
    const p = G.player;
    if (p.car) {
      p.car.isPlayerCar = false;
      p.car = null;
    }
    const [sx, sz] = CONFIG.spots.playerStart;
    p.pos.set(sx, 0, sz);
    p.mesh.position.copy(p.pos);
    p.mesh.visible = true;
    p.hp = CONFIG.player.hpMax;
    p.dead = false;
    p.money = G.save && typeof G.save.money === 'number' ? G.save.money : CONFIG.startMoney;
    p.weapon = 'pistol';
    p.ammo = { pistol: 12, smg: 30 };
    p.reserve = { pistol: 72, smg: 150 };
    p.yaw = Math.PI;
    p.pitch = 0;
    G.missions.index = G.save && typeof G.save.missions === 'number' ? Math.min(3, G.save.missions) : 0;
    G.missions.stage = 'idle';
    G.missions.stageDetail = '';
    G.missions.hasPackage = false;
    G.missions.timer = 0;
    G.missions.hideBeacon();
    G.missions.objective = 'Tekan T untuk telepon Mara dan mulai misi.';
    G.combat.clearEnemies();
    G.combat.reloading = false;
    G.police.setWanted(0);
    G.state = 'playing';
    G.hud.showPlaying();
    if (G.missions.index < 3) G.missions.start();
  };

  // --- Input sekali tekan ---
  G.input.onPress = function (code) {
    if (code === 'KeyM') {
      G.toggleMute();
      return;
    }
    if (G.state === 'start') {
      if (code === 'Enter' || code === 'Space') G.startGame();
      return;
    }
    if (G.state === 'playing') {
      if (code === 'KeyE') {
        if (G.player.car) exitCar(G);
        else {
          const car = nearestCar(G, 4.5);
          if (car) enterCar(G, car);
        }
      } else if (code === 'KeyF') {
        G.missions.tryPickupKey();
      } else if (code === 'KeyR') {
        G.combat.startReload();
      } else if (code === 'KeyT') {
        G.missions.callMara();
      } else if (code === 'KeyP' || code === 'Escape') {
        G.pauseGame();
      } else if (code === 'Digit1') {
        G.player.weapon = 'pistol';
      } else if (code === 'Digit2') {
        G.player.weapon = 'smg';
      }
      return;
    }
    if (G.state === 'paused') {
      if (code === 'KeyP' || code === 'Escape') G.resumeGame();
      else if (code === 'KeyR') G.restartRun();
      return;
    }
    if (G.state === 'gameover') {
      if (code === 'KeyR' || code === 'Enter') G.restartRun();
    }
  };

  // Tombol-tombol layar.
  const startBtn = document.getElementById('start-btn');
  if (startBtn) startBtn.addEventListener('click', () => G.startGame());
  const resumeBtn = document.getElementById('resume-btn');
  if (resumeBtn) resumeBtn.addEventListener('click', () => G.resumeGame());
  const restartBtn = document.getElementById('restart-btn');
  if (restartBtn) restartBtn.addEventListener('click', () => G.restartRun());
  const againBtn = document.getElementById('again-btn');
  if (againBtn) againBtn.addEventListener('click', () => G.restartRun());

  // --- Loop utama ---
  G.update = function (dt) {
    G.time += dt;
    if (G.state === 'playing') {
      updatePlayer(G, dt);
      if (G.player.car) updatePlayerCar(G, dt);
      updateTraffic(G, dt);
      updatePeds(G, dt);
      G.police.update(dt);
      G.missions.update(dt);
      G.combat.update(dt);
      // Menembak: klik sekali (pistol) atau tahan (SMG).
      if (!G.player.car) {
        const w = G.combat.weapon();
        if (w.auto) {
          if (G.input.mouseDown) G.combat.shoot();
        } else if (G.input.consumeClick()) {
          G.combat.shoot();
        }
      }
      G.audio.engineSet(G.player.car ? G.player.car.speed / CONFIG.car.maxSpeed : 0, !!G.player.car);
      R.updateCamera(dt);
      G.hud.update();
    } else if (G.state === 'start') {
      // Layar awal: kota hidup di belakang (lalu lintas jalan).
      updateTraffic(G, dt);
      updatePeds(G, dt);
      R.updateCamera(dt);
    }
    R.update(dt);
    R.render();
  };

  return G;
}

// --- Pejalan kaki ---
function spawnPeds(G) {
  const peds = [];
  const colors = [0xc0a080, 0x8090a0, 0xa08090, 0x708070, 0x908060, 0x605060];
  for (let i = 0; i < G.config.pedCount; i++) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.42, 1.0, 8),
      new THREE.MeshLambertMaterial({ color: G.rng.pick(colors) })
    );
    body.position.y = 0.9;
    group.add(body);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0xd8a077 })
    );
    head.position.y = 1.65;
    group.add(head);
    const x = G.rng.range(-380, 380);
    const z = G.rng.range(-380, 280);
    group.position.set(x, 0, z);
    G.scene.add(group);
    peds.push({
      mesh: group,
      pos: new THREE.Vector3(x, 0, z),
      axis: G.rng.next() < 0.5 ? 'x' : 'z',
      dir: G.rng.next() < 0.5 ? 1 : -1,
      speed: G.rng.range(1.2, 2.2),
      flee: 0,
    });
  }
  return peds;
}

function updatePeds(G, dt) {
  const p = G.player;
  for (const ped of G.peds) {
    if (ped.flee > 0) {
      ped.flee -= dt;
      // Lari menjauhi pemain.
      const dx = ped.pos.x - p.pos.x;
      const dz = ped.pos.z - p.pos.z;
      const len = Math.hypot(dx, dz) || 1;
      ped.pos.x += (dx / len) * 5 * dt;
      ped.pos.z += (dz / len) * 5 * dt;
    } else {
      const step = ped.speed * ped.dir * dt;
      if (ped.axis === 'x') {
        ped.pos.x += step;
        if (ped.pos.x > 390) ped.pos.x = -390;
        if (ped.pos.x < -390) ped.pos.x = 390;
      } else {
        ped.pos.z += step;
        if (ped.pos.z > 290) ped.pos.z = -390;
        if (ped.pos.z < -390) ped.pos.z = 290;
      }
      // Pejalan kaki menghindar bila pemain/mobil sangat dekat.
      const d = ped.pos.distanceTo(p.pos);
      if (d < 4 && G.state === 'playing') ped.flee = 3;
    }
    ped.mesh.position.copy(ped.pos);
    ped.mesh.rotation.y = ped.axis === 'x' ? (ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : ped.dir > 0 ? 0 : Math.PI;
  }
}
