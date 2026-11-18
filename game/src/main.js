// SOLMAR — boot and the one loop. Input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there. The
// game moves between four screens: title, play, paused and game over. Progress
// (cash, jobs finished, best cash) is kept in localStorage between visits.
//
// ?seed=N fixes the city. ?shot=start|drive|chase|mission (with &seed=N)
// stages that scene instead of running the loop, paints it a few times and
// sets window.__shotReady for a screenshot.
import { SOLMAR, STEP } from './config.js';
import { makeRng } from './random.js';
import { createInput } from './input.js';
import { createRender } from './render.js';
import { createWorld } from './world.js';
import { createHud } from './hud.js';
import { currentMission, startCall, MISSION_IDLE } from './missions.js';
import { stageShot } from './shots.js';

window.__errors = [];
window.addEventListener('error', (e) => window.__errors.push(String(e.message || e.error)));

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : (Math.floor(Math.random() * 4294967296) >>> 0);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const rng = makeRng(seed);
const render = createRender(canvas);
const world = createWorld(render.scene, rng);
const hud = createHud();
const input = createInput(canvas);

function readSave() {
  try {
    const raw = window.localStorage.getItem(SOLMAR.saveKey);
    if (!raw) return { money: 0, missionsDone: 0, best: 0 };
    const s = JSON.parse(raw);
    return { money: s.money | 0, missionsDone: s.missionsDone | 0, best: s.best | 0 };
  } catch {
    return { money: 0, missionsDone: 0, best: 0 };
  }
}

function writeSave() {
  try {
    window.localStorage.setItem(SOLMAR.saveKey, JSON.stringify({
      money: Math.floor(world.state.money),
      missionsDone: world.state.missionsDone,
      best: Math.floor(world.state.best),
    }));
  } catch {
    // Storage can be off: progress then lasts this visit only.
  }
}

const save = readSave();
world.state.money = save.money;
world.state.best = save.best;
world.state.missionsDone = save.missionsDone;
world.missions.index = Math.min(save.missionsDone, 3);

window.__solmar = {
  version: 'solmar-round2',
  seed,
  world,
  get screen() { return screen; },
  get money() { return world.state.money; },
  get wanted() { return world.police.wanted; },
  get missionIndex() { return world.missions.index; },
  get missionPhase() { return world.missions.phase; },
  get playerHealth() { return world.player.health; },
  get camYaw() { return camYaw; },
  camera: render.camera,
  missions: world.missions,
  startCall() { startCall(world.missions, world.audio); },
  save: writeSave,
};

let screen = 'title';
let camYaw = Math.PI;
let camPitch = 0.12;
let accumulator = 0;
let last = performance.now();
let titleT = 0;
let callTimer = -1;
let saveTimer = 0;
let lastMouseDX = 0;

function announce(message) {
  status.textContent = message;
}

function startGame() {
  screen = 'play';
  hud.showScreen('play');
  input.lockPointer();
  world.audio.unlock();
  announce('Bermain sebagai Rook di Solmar. Tekan F untuk menerima pekerjaan dari Mara.');
  if (world.missions.phase === MISSION_IDLE && currentMission(world.missions)) callTimer = 1.5;
}

function endGameOver() {
  screen = 'over';
  input.unlockPointer();
  writeSave();
}

function refreshHud() {
  const p = world.player;
  hud.setMoney(world.state.money);
  hud.setHealth(p.health);
  hud.setStars(world.police.wanted);
  hud.setSpeed(world.speedKmh || 0);
  const slot = p.ammo[p.weapon];
  hud.setAmmo(p.weapon, slot.mag, slot.reserve);
  hud.setCrosshair(!p.inCar && screen === 'play');
  const m = currentMission(world.missions);
  if (world.missions.phase === 'active') {
    hud.setObjective(world.missions.objective);
    hud.setTimer(world.missions.timeLeft || 0);
  } else if (m) {
    hud.setObjective(`Tekan F — pekerjaan berikutnya: ${m.name} ($${m.reward}).`);
    hud.setTimer(0);
  } else {
    hud.setObjective('Semua misi selesai. Solmar milikmu — free roam.');
    hud.setTimer(0);
  }
  hud.drawMinimap(world);
}

function drainEvents() {
  if (world.phoneEvent) {
    hud.toast(world.phoneEvent.title, world.phoneEvent.text);
    world.phoneEvent = null;
  }
  if (world.bannerEvent) {
    hud.banner(world.bannerEvent.title, world.bannerEvent.sub);
    world.bannerEvent = null;
  }
  if (world.wastedEvent) {
    const w = world.wastedEvent;
    world.wastedEvent = null;
    hud.showOver(w.title, w.stats);
    endGameOver();
  }
}

function step(dt) {
  if (callTimer > 0) {
    callTimer -= dt;
    if (callTimer <= 0) {
      callTimer = -1;
      startCall(world.missions, world.audio);
    }
  }
  const mouse = input.takeMouse();
  if (mouse.dx !== 0 || mouse.dy !== 0) {
    camYaw -= mouse.dx * 0.0032;
    camPitch = Math.max(-0.3, Math.min(0.55, camPitch + mouse.dy * 0.0022));
    lastMouseDX = performance.now();
  }
  // While driving, the camera drifts back behind the car when the mouse rests.
  const car = world.player.inCar;
  if (car && performance.now() - lastMouseDX > 900) {
    const want = car.heading + Math.PI;
    let diff = want - camYaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    camYaw += diff * Math.min(1, dt * 1.4);
  }
  const view = { camYaw, camPitch, camera: render.camera };
  world.update(dt, input, view);
  render.updateSun(dt);
  const target = car
    ? { x: car.x, y: 1.2, z: car.z }
    : { x: world.player.x, y: world.player.y + 1.2, z: world.player.z };
  render.updateCamera(target, camYaw, camPitch, !!car, dt);
  drainEvents();
  refreshHud();
  saveTimer += dt;
  if (saveTimer > 2) {
    saveTimer = 0;
    writeSave();
  }
}

function handleKeys() {
  if (input.justPressed('KeyM')) {
    world.audio.setMuted(!world.audio.muted);
    announce(world.audio.muted ? 'Suara dimatikan.' : 'Suara dinyalakan.');
  }
  if (screen === 'title' && (input.justPressed('Enter') || input.justPressed('Space') || input.takeClick())) {
    startGame();
  } else if (screen === 'play' && (input.justPressed('KeyP') || input.justPressed('Escape'))) {
    screen = 'pause';
    hud.showScreen('pause');
    input.unlockPointer();
    world.audio.engineOff();
    announce('Jeda.');
  } else if (screen === 'pause' && (input.justPressed('KeyP') || input.justPressed('Escape') || input.justPressed('Enter'))) {
    screen = 'play';
    hud.showScreen('play');
    input.lockPointer();
    announce('Lanjut bermain.');
  } else if (screen === 'over' && (input.justPressed('KeyR') || input.justPressed('Enter'))) {
    window.location.reload();
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, MAX_FRAME);
  last = now;
  handleKeys();
  if (screen === 'title') {
    titleT += dt;
    render.titleCamera(titleT);
    render.updateSun(dt);
    render.render();
  } else if (screen === 'play') {
    accumulator += dt;
    let guard = 0;
    while (accumulator >= STEP && guard < 8) {
      step(STEP);
      accumulator -= STEP;
      guard += 1;
    }
    if (guard >= 8) accumulator = 0;
    render.render();
  } else {
    render.render();
  }
  input.endFrame();
}

function runShot(name) {
  const view = { camYaw: 0, camPitch: 0.12, camera: render.camera };
  const staged = stageShot(name, world, view);
  hud.setMoney(world.state.money);
  hud.setHealth(world.player.health);
  hud.setStars(world.police.wanted);
  hud.setSpeed(world.speedKmh || 0);
  const slot = world.player.ammo[world.player.weapon];
  hud.setAmmo(world.player.weapon, slot.mag, slot.reserve);
  hud.setCrosshair(!world.player.inCar);
  if (staged.screen === 'title') {
    hud.setTitleStats(world.state.money, world.state.missionsDone, world.state.best);
    hud.showScreen('title');
  } else {
    hud.showScreen('play');
    const m = currentMission(world.missions);
    if (world.missions.phase === 'active') {
      hud.setObjective(world.missions.objective);
      hud.setTimer(world.missions.timeLeft || 0);
    } else if (m) hud.setObjective(`Pekerjaan: ${m.name} ($${m.reward}).`);
    const car = world.player.inCar;
    const target = car
      ? { x: car.x, y: 1.2, z: car.z }
      : { x: world.player.x, y: 1.2, z: world.player.z };
    render.updateCamera(target, staged.camYaw, 0.12, !!car, 1);
  }
  hud.drawMinimap(world);
  let painted = 0;
  function paint() {
    if (staged.screen === 'title') {
      titleT += 0.4;
      render.titleCamera(titleT);
    }
    render.render();
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

if (shot) {
  runShot(shot);
} else {
  hud.setTitleStats(save.money, save.missionsDone, save.best);
  hud.showScreen('title');
  announce('SOLMAR. Klik untuk mulai.');
  // The title overlay covers the canvas, so its own click starts the game.
  document.getElementById('screen-title').addEventListener('click', () => {
    if (screen === 'title') startGame();
  });
  requestAnimationFrame(frame);
}
