// SOLMAR — shots.js
// Mode screenshot deterministik lewat query URL:
//   ?shot=start|drive|chase|mission&seed=1
// Kamera dan posisi tetap untuk tiap mode, tanpa keacakan di luar seed.
// Dipakai oleh skrip capture untuk mengambil 4 screenshot JPG 1280x720.
// Setelah beberapa frame simulasi, window.__solmarReady = true.

import { PLACES } from './config.js';

export const SHOT_MODES = ['start', 'drive', 'chase', 'mission'];

export function shotModeFromUrl() {
  const q = new URLSearchParams(window.location.search);
  const shot = q.get('shot');
  if (!SHOT_MODES.includes(shot)) return null;
  const seed = parseInt(q.get('seed') || '1', 10);
  return { mode: shot, seed: Number.isFinite(seed) ? seed : 1 };
}

// Menyiapkan adegan untuk satu mode screenshot. Mengembalikan jumlah frame
// simulasi yang harus dijalankan sebelum screenshot diambil.
export function applyShotMode(game, mode) {
  const { player, missions, police } = game;
  if (mode === 'start') {
    // Layar awal: kamera mengorbit kota, menu terlihat.
    game.state.mode = 'menu';
    game.shotCamera = {
      pos: new THREE.Vector3(180, 90, 180),
      look: new THREE.Vector3(0, 30, 0),
    };
    return 30;
  }

  // Tiga mode lain: permainan langsung berjalan (tanpa pointer lock).
  game.startGame({ skipPhone: true });
  game.input.enabled = true;

  if (mode === 'drive') {
    // Rook mengemudi di jalan utama, lalu lintas di sekitar.
    const car = game.enterCarAt(-100, 0, Math.PI / 2, 0xc0c0c8);
    game.player.inCar = car;
    game.state.mode = 'playing';
    // Dorong mobil maju sedikit agar adegan hidup.
    game.shotDrive = { throttle: true, frames: 70 };
    return 70;
  }

  if (mode === 'chase') {
    // Kejar-kejaran polisi: wanted 3, dua mobil polisi di belakang.
    const car = game.enterCarAt(-60, 0, Math.PI / 2, 0x8a2a2a);
    game.player.inCar = car;
    game.state.wanted = 3;
    game.state.mode = 'playing';
    game.shotDrive = { throttle: true, frames: 90 };
    // Tempatkan polisi tepat di belakang pemain; mereka menyusul ke sisi
    // mobil selama simulasi sehingga terlihat di frame.
    police.update(0.01, game);
    police.cars.forEach((c, i) => {
      c.mesh.position.set(-60 - (i + 1) * 14, 0, (i === 0 ? 4 : -4));
      c.heading = Math.PI / 2;
      c.speed = 20;
    });
    return 90;
  }

  // mission: misi 1 aktif, Rook sudah di dalam sedan biru target,
  // baru keluar dari tempat parkir ke jalan (z=200), penanda garasi Mara
  // terlihat di minimap dan objektif di HUD.
  missions.start(0);
  const target = missions.targetCar;
  target.mesh.position.set(-280, 0, 200);
  target.mesh.rotation.y = Math.PI / 2;
  target.heading = Math.PI / 2;
  const car = game.enterCarAt(-280, 200, Math.PI / 2, 0x2a4a8a, target);
  game.player.inCar = car;
  missions.stage = 1;
  missions.setMarker(PLACES.maraGarage, 0x4a90ff);
  game.hud.setObjective('Misi 1: First Gear — Antar sedan ke Garasi Mara');
  game.state.mode = 'playing';
  game.shotDrive = { throttle: true, frames: 60 };
  return 60;
}
