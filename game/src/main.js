// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps, and the renderer paints what is there. Screens: title, play, paused, game over.
// Progress (cash, missions done, best wanted) is saved to localStorage between visits.
//
// ?seed=N fixes the city. ?shot=start|drive|chase|mission (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH, ACTION_RESTART, createInput } from './input.js';
import { EVENT_CASH, EVENT_MISSION, EVENT_OVER, createWorld } from './world.js';
import { createHud, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './hud.js';
import { createRenderer } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const hud = createHud();
const input = createInput(canvas);
const audio = createAudio();
const world = createWorld(createRandom(seed), renderer, renderer.scene);
const state = world.state;

function readSave() {
  try {
    return JSON.parse(window.localStorage.getItem(SAVE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function writeSave() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: state.cash,
      missionsDone: state.missionsDone,
      bestWanted: state.bestWanted,
    }));
  } catch {
    // Storage can be off: progress then lasts this visit only.
  }
}

const saved = readSave();
state.cash = saved.cash ?? 0;
state.missionsDone = saved.missionsDone ?? 0;

function runShot(name) {
  const staged = stageShot(name, world, null);
  hud.showScreen(staged.screen, null);
  window.__solmar = { state, world, screen: staged.screen, staged };
  // The HUD (minimap, cash, wanted) is part of the play screenshots.
  if (staged.screen === SCREEN_PLAY) hud.draw(state, 0);
  let painted = 0;
  function paint() {
    const target = world.cameraTarget();
    const yaw = staged.yaw !== undefined ? staged.yaw : target.heading + (staged.yawOffset ?? 0);
    renderer.drawStill(target, yaw, staged.pitch, staged.dist, staged.height);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  let lastMissionIndex = -1;
  let lastObjective = '';

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.reset();
    state.cash = readSave().cash ?? state.cash;
    lastMissionIndex = -1;
    accumulator = 0;
    screen = SCREEN_PLAY;
    hud.showScreen(screen, null);
    announce('Playing. Mara has work for you — check the objective.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    writeSave();
    hud.showScreen(screen, { cash: state.cash, missionsDone: state.missionsDone, bestWanted: state.bestWanted });
    announce(`Busted. Cash $${state.cash}. Missions ${state.missionsDone} of 3.`);
  }

  /** The wish direction on foot, from the keys and the camera yaw. */
  function footWish(drive) {
    const yaw = renderer.yaw();
    const mx = Math.sin(yaw) * drive.throttle + Math.cos(yaw) * drive.steer;
    const mz = Math.cos(yaw) * drive.throttle - Math.sin(yaw) * drive.steer;
    return { mx, mz };
  }

  // One-shot presses are taken exactly once per frame, here, and handed to both the screen
  // handler and the first world step: taking them twice would eat ENTER and PUNCH before the
  // world ever saw them.
  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      audio.setMuted(!audio.isMuted());
      return;
    }
    if (actions & ACTION_RESTART && screen !== SCREEN_TITLE) {
      startGame();
      return;
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) {
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      hud.showScreen(screen, null);
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      hud.showScreen(screen, null);
      announce('Playing.');
    }
  }

  function step(actions) {
    const drive = input.drive();
    // Movement input is relative to the camera when on foot, direct when driving.
    const wish = state.playerCar ? { mx: 0, mz: 0 } : footWish(drive);
    const events = world.step(STEP, { ...drive, ...wish }, actions, screen === SCREEN_PLAY && input.isMouseDown(), audio);
    // Toast the mission brief when a new mission starts.
    const cur = state.missions.current();
    if (cur && cur.missionIndex !== lastMissionIndex) {
      lastMissionIndex = cur.missionIndex;
      hud.toast(cur.mission.brief);
    }
    if (events & EVENT_MISSION) {
      const done = state.missions.list[state.missionsDone - 1];
      if (done) hud.toast(`Job done: ${done.name} — $${done.reward}`);
    }
    if (events & EVENT_CASH) writeSave();
    if (events & EVENT_OVER) endGame();
    if (state.objective !== lastObjective) {
      lastObjective = state.objective;
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    handleActions(actions);
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      let frameActions = screen === SCREEN_PLAY ? actions : 0;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        if (screen === SCREEN_TITLE) {
          // The city lives behind the title: traffic and pedestrians move, nothing scores.
          world.step(STEP, { throttle: 0, steer: 0, sprint: false, mx: 0, mz: 0 }, 0, false, null);
        } else {
          step(frameActions);
          frameActions = 0;
        }
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    if (screen === SCREEN_TITLE) {
      // A fixed high view over the plaza: the whole city reads behind the title.
      renderer.drawStill(
        { x: 0, z: 0, heading: 0, speed: 0, car: null },
        0.8, 0.5, 44, 26,
      );
    } else {
      const orbit = input.takeOrbit();
      renderer.draw(world.cameraTarget(), STEP, orbit, now / 1000);
    }
    if (screen === SCREEN_PLAY) hud.draw(state, STEP);
  }

  // Leaving the tab pauses a running game rather than letting the city run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      hud.showScreen(screen, null);
      announce('Paused.');
    }
  });

  // The playtest and screenshot bots read the live state from here.
  window.__solmar = {
    state,
    world,
    get screen() {
      return screen;
    },
    /** The camera's yaw, so a bot can turn the on-foot wish direction into keys. */
    get camYaw() {
      return renderer.yaw();
    },
    start: startGame,
  };

  hud.showScreen(SCREEN_TITLE, null);
  announce('SOLMAR. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
