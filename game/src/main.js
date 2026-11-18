// SOLMAR — main.js
// Titik masuk game: merakit semua sistem (kota, lalu lintas, pemain, polisi,
// misi, combat, HUD), loop utama, simpan/load localStorage, pause/game over,
// dan mode screenshot deterministik (?shot=...&seed=1).

import { CONFIG, PLACES } from './config.js';
import { Rng } from './random.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { City } from './city.js';
import { Traffic, PlayerCar, makeCarMesh } from './vehicles.js';
import { Player } from './player.js';
import { Police } from './police.js';
import { Missions } from './missions.js';
import { Combat } from './combat.js';
import { Hud } from './hud.js';
import { World } from './world.js';
import { createRenderer, createCamera, createSky, resize } from './render.js';
import { shotModeFromUrl, applyShotMode } from './shots.js';

const SAVE_KEY = 'solmar-save-v1';

class Game {
  constructor() {
    this.now = 0;
    this.state = {
      mode: 'menu', // menu | playing | paused | gameover
      money: CONFIG.startMoney,
      wanted: 0,
      score: 0,
      best: 0,
    };
    this.shot = shotModeFromUrl();
    this.rng = new Rng(this.shot ? this.shot.seed : CONFIG.seed);
    this.scene = new THREE.Scene();
    this.camera = createCamera();
    this.canvas = document.getElementById('game-canvas');
    this.renderer = createRenderer(this.canvas);
    createSky(this.scene);
    this.audio = new AudioEngine();
    this.input = new Input();
    this.input.attach(this.canvas);
    this.city = new City(this.scene, this.rng).build();
    this.world = new World(this).initLights();
    this.world.spawnPedestrians(CONFIG.pedestrians);
    this.traffic = new Traffic(this.scene, this.rng).spawn(CONFIG.trafficCars);
    this.player = new Player(this.scene);
    this.player.place(PLACES.hospital.x, PLACES.hospital.z, 0);
    this.police = new Police(this.scene, this.rng);
    this.combat = new Combat(this);
    this.missions = new Missions(this);
    this.hud = new Hud(this);
    this.parkedCars = [];
    this.shotCamera = null;
    this.shotDrive = null;
    this.shotFramesLeft = 0;
    this.shotReady = false;
    this.spawnParkedCars();
    this.load();
    this.wireInput();
    this.hud.showStart(this.missions.done);
    this.hud.showHud(false);
    window.addEventListener('resize', () => resize(this.renderer, this.camera));
    window.__solmar = this;
    window.__solmarReady = false;
    window.__solmarError = null;
    window.addEventListener('error', (e) => {
      window.__solmarError = String(e.message || e.error);
    });
    // API kecil untuk playtest otomatis (bukan cheat untuk pemain).
    window.__solmarTest = {
      state: () => ({
        mode: this.state.mode,
        money: this.state.money,
        wanted: this.state.wanted,
        health: this.player.health,
        mission: this.missions.index,
        stage: this.missions.stage,
        done: this.missions.done.slice(),
        inCar: !!this.player.inCar,
        enemies: this.combat.enemiesAlive(),
      }),
      completeMission: () => this.missions.complete(),
      startMission: (i) => this.missions.start(i),
      setWanted: (n) => {
        this.state.wanted = n;
      },
      teleport: (x, z) => this.player.place(x, z, 0),
      save: () => this.save(),
    };
  }

  // Mobil-mobil parkir yang bisa dicuri (E di dekatnya).
  spawnParkedCars() {
    const spots = [
      { x: -180, z: 220, c: 0xc0c0c8 },
      { x: 120, z: -180, c: 0x8a2a2a },
      { x: -220, z: -120, c: 0x2a4a8a },
      { x: 220, z: 120, c: 0xd0a030 },
      { x: 60, z: 280, c: 0x3a6a3a },
      { x: -60, z: -280, c: 0x7a3a6a },
      { x: 280, z: 40, c: 0xd0d0d0 },
      { x: -40, z: 180, c: 0x30343a },
    ];
    for (const s of spots) {
      const mesh = makeCarMesh(s.c);
      mesh.position.set(s.x, 0, s.z);
      mesh.rotation.y = this.rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
      this.scene.add(mesh);
      this.parkedCars.push({ mesh, heading: mesh.rotation.y, health: CONFIG.carHealth, isTarget: false, taken: false });
    }
  }

  // Dipakai mode screenshot: buat/masuki mobil di posisi tertentu.
  enterCarAt(x, z, heading, color, existing) {
    let parked = existing;
    if (!parked) {
      const mesh = makeCarMesh(color);
      mesh.position.set(x, 0, z);
      mesh.rotation.y = heading;
      this.scene.add(mesh);
      parked = { mesh, heading, health: CONFIG.carHealth, isTarget: false, taken: false };
      this.parkedCars.push(parked);
    }
    return this.enterCar(parked);
  }

  enterCar(parked) {
    const idx = this.parkedCars.indexOf(parked);
    if (idx >= 0) this.parkedCars.splice(idx, 1);
    parked.taken = true;
    const car = new PlayerCar(this.scene, parked.mesh);
    car.place(parked.mesh.position.x, parked.mesh.position.z, parked.heading);
    car.health = parked.health;
    car._parkedRef = parked;
    this.player.inCar = car;
    this.player.mesh.visible = false;
    return car;
  }

  exitCar() {
    const car = this.player.inCar;
    if (!car) return;
    const p = car.mesh.position;
    const h = car.heading;
    const px = p.x + Math.cos(h) * 3;
    const pz = p.z - Math.sin(h) * 3;
    this.player.place(px, pz, h);
    this.player.inCar = null;
    // Mobil kembali jadi mobil parkir.
    const parked = car._parkedRef || { mesh: car.mesh, heading: h, health: car.health, isTarget: false, taken: false };
    parked.health = car.health;
    parked.heading = h;
    parked.taken = false;
    this.parkedCars.push(parked);
  }

  nearestParkedCar(maxDist) {
    const p = this.player.pos;
    let best = null;
    let bestD = maxDist;
    for (const c of this.parkedCars) {
      const d = Math.hypot(c.mesh.position.x - p.x, c.mesh.position.z - p.z);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  addWanted(n) {
    if (n <= 0) return;
    this.state.wanted = Math.min(CONFIG.maxWanted, this.state.wanted + n);
  }

  wireInput() {
    this.input.onKey = (code) => {
      if (this.state.mode !== 'playing') {
        if (code === 'Enter' && this.state.mode === 'menu') this.startGame();
        return;
      }
      if (code === 'KeyE') {
        if (this.player.inCar) {
          this.exitCar();
        } else {
          const car = this.nearestParkedCar(4.5);
          if (car) {
            this.enterCar(car);
            if (!car.isTarget) this.addWanted(1); // mencuri mobil menaikkan wanted
            this.hud.showBanner(car.isTarget ? 'Sedan Mara — gas menuju garasi!' : 'Mobil dicuri — polisi waspada!');
            this.audio.pickup();
          }
        }
      }
      if (code === 'KeyF') {
        const car = this.nearestParkedCar(4.5);
        if (car && !this.player.inCar) {
          this.enterCar(car);
          if (!car.isTarget) this.addWanted(1);
        }
      }
      if (code === 'KeyR') this.combat.startReload(this.now);
      if (code === 'Digit1') this.combat.switchWeapon('pistol');
      if (code === 'Digit2') this.combat.switchWeapon('smg');
      if (code === 'KeyM') {
        this.audio.setMuted(!this.audio.muted);
        this.hud.showBanner(this.audio.muted ? 'Suara dimatikan (M)' : 'Suara dinyalakan (M)');
      }
      if (code === 'KeyP' || code === 'Escape') this.togglePause();
    };
    this.input.onMouseDown = () => {
      if (this.state.mode === 'playing' && !this.player.inCar) {
        this.audio.resume();
        this.combat.shoot(this.now);
      }
    };
    document.getElementById('start-button').addEventListener('click', () => this.startGame());
    document.getElementById('resume-button').addEventListener('click', () => this.togglePause());
    document.getElementById('restart-button').addEventListener('click', () => this.restartAfterBusted());
    document.getElementById('mute-button').addEventListener('click', () => {
      this.audio.setMuted(!this.audio.muted);
    });
  }

  startGame(options = {}) {
    this.audio.init();
    this.audio.resume();
    this.state.mode = 'playing';
    this.hud.hideStart();
    this.hud.hideGameOver();
    this.hud.showHud(true);
    this.hud.showCrosshair(false); // crosshair hanya saat jalan kaki
    if (!options.skipPhone && this.missions.nextMissionIndex() >= 0 && this.missions.index < 0) {
      this.missions.startNext();
    }
  }

  togglePause() {
    if (this.state.mode === 'playing') {
      this.state.mode = 'paused';
      this.hud.showPause(true);
      this.input.releaseLock();
    } else if (this.state.mode === 'paused') {
      this.state.mode = 'playing';
      this.hud.showPause(false);
    }
  }

  // Tertangkap polisi atau nyawa habis: respawn di rumah sakit, -10% uang.
  busted() {
    if (this.state.mode !== 'playing') return;
    const lost = Math.floor(this.state.money * CONFIG.deathPenalty);
    this.state.money -= lost;
    this.state.best = Math.max(this.state.best, this.state.score);
    this.save();
    this.police.clear();
    this.combat.clearEnemies();
    if (this.player.inCar) {
      const car = this.player.inCar;
      this.scene.remove(car.mesh);
      this.player.inCar = null;
    }
    this.state.mode = 'gameover';
    this.state.wanted = 0;
    this.hud.showGameOver(
      `<p>BUSTED — Polisi Solmar menangkapmu.</p><p>Uang hilang: $${lost} (10%)</p><p>Uang: $${Math.floor(this.state.money)} &nbsp;•&nbsp; Misi selesai: ${this.missions.done.filter(Boolean).length}/3 &nbsp;•&nbsp; Skor: ${this.state.score}</p>`,
    );
    this.hud.showHud(false);
    this.input.releaseLock();
  }

  wasted() {
    if (this.state.mode !== 'playing') return;
    const lost = Math.floor(this.state.money * CONFIG.deathPenalty);
    this.state.money -= lost;
    this.state.best = Math.max(this.state.best, this.state.score);
    this.save();
    this.police.clear();
    this.combat.clearEnemies();
    if (this.player.inCar) {
      const car = this.player.inCar;
      this.scene.remove(car.mesh);
      this.player.inCar = null;
    }
    this.state.mode = 'gameover';
    this.state.wanted = 0;
    this.hud.showGameOver(
      `<p>WASTED — Rook tumbang di jalanan Solmar.</p><p>Uang hilang: $${lost} (10%)</p><p>Uang: $${Math.floor(this.state.money)} &nbsp;•&nbsp; Misi selesai: ${this.missions.done.filter(Boolean).length}/3 &nbsp;•&nbsp; Skor: ${this.state.score}</p>`,
    );
    this.hud.showHud(false);
    this.input.releaseLock();
  }

  restartAfterBusted() {
    this.player.health = CONFIG.playerHealth;
    this.player.place(PLACES.hospital.x, PLACES.hospital.z, 0);
    this.state.mode = 'playing';
    this.hud.hideGameOver();
    this.hud.showHud(true);
    if (this.missions.index < 0) this.missions.startNext();
  }

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        money: this.state.money,
        done: this.missions.done,
        best: this.state.best,
        score: this.state.score,
      }));
    } catch (e) {
      /* localStorage tidak tersedia */
    }
  }

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (typeof data.money === 'number') this.state.money = data.money;
      if (Array.isArray(data.done)) this.missions.loadDone(data.done);
      if (typeof data.best === 'number') this.state.best = data.best;
      if (typeof data.score === 'number') this.state.score = data.score;
    } catch (e) {
      /* save rusak: mulai dari awal */
    }
  }

  update(dt) {
    this.now += dt;
    const playing = this.state.mode === 'playing';
    if (playing) {
      // Tembakan tahan-klik.
      if (this.input.mouseDown && !this.player.inCar) this.combat.shoot(this.now);
      this.player.update(dt, this.input, this.city, this.now);
      if (this.player.inCar) this.player.inCar.update(dt, this.input, this.city);
      this.traffic.update(dt, this.player.inCar);
      this.world.update(dt, this.now);
      this.police.update(dt, this);
      this.missions.update(dt);
      this.combat.update(dt, this.now);
      // Mobil pemain hancur.
      if (this.player.inCar && this.player.inCar.health <= 0) {
        this.hud.showBanner('Mobilmu hancur!');
        const car = this.player.inCar;
        this.scene.remove(car.mesh);
        this.player.inCar = null;
        this.player.place(car.mesh.position.x + 3, car.mesh.position.z, 0);
        this.player.damage(20, this.now);
      }
      if (this.player.health <= 0) this.wasted();
      // Suara mesin mengikuti kecepatan.
      const ratio = this.player.inCar ? Math.abs(this.player.inCar.speed) / CONFIG.carTopSpeed : 0;
      this.audio.setEngine(ratio, !!this.player.inCar);
      // Petunjuk interaksi.
      if (!this.player.inCar) {
        const car = this.nearestParkedCar(4.5);
        this.hud.showInteract(car ? 'Tekan E untuk masuk mobil' : null);
      } else {
        this.hud.showInteract('Tekan E untuk keluar mobil');
      }
    }
    // HUD selalu diperbarui saat bermain.
    if (playing || this.state.mode === 'paused') {
      this.hud.setHealth(this.player.health);
      this.hud.setMoney(this.state.money);
      this.hud.setWanted(this.state.wanted);
      this.hud.setObjective(this.missions.objectiveText());
      this.hud.setSpeed(this.player.inCar ? this.player.inCar.kmh() : 0, !!this.player.inCar);
      this.hud.setAmmo(this.combat.ammo, this.combat.magSize(), this.combat.weapon, this.combat.reloading);
      this.hud.showCrosshair(playing && !this.player.inCar);
      this.hud.drawMinimap();
    }
    // Kamera.
    let target;
    if (this.shotCamera && this.state.mode === 'menu') {
      target = this.shotCamera;
    } else if (this.state.mode === 'menu') {
      // Orbit perlahan di atas kota pada layar awal.
      const a = this.now * 0.05;
      target = {
        pos: new THREE.Vector3(Math.cos(a) * 320, 110, Math.sin(a) * 320),
        look: new THREE.Vector3(0, 20, 0),
      };
    } else {
      target = this.player.cameraTarget();
    }
    const k = 1 - Math.exp(-dt * 6);
    this.camera.position.lerp(target.pos, k);
    const look = target.look.clone();
    this.camera.lookAt(look);
    // Mode screenshot: sudah dijalankan sinkron di run(); tandai siap
    // setelah frame pertama selesai dirender.
    if (this.shot && !this.shotReady) {
      this.shotReady = true;
      window.__solmarReady = true;
    }
  }

  run() {
    // Terapkan mode screenshot sebelum loop pertama, lalu jalankan frame
    // simulasinya secara sinkron (tanpa menunggu render software yang lambat).
    if (this.shot) {
      const frames = applyShotMode(this, this.shot.mode);
      if (this.shot.mode === 'start') this.hud.showStart(this.missions.done);
      if (this.shotDrive) this.input.keys.add('KeyW');
      for (let i = 0; i < frames; i++) this.update(1 / 60);
      this.input.keys.delete('KeyW');
      this.shotReady = true;
      window.__solmarReady = true;
    }
    const clock = new THREE.Clock();
    const loop = () => {
      requestAnimationFrame(loop);
      const dt = Math.min(0.05, clock.getDelta());
      this.update(dt);
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  game.run();
});
