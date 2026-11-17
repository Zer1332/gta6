// The HUD: DOM panels for cash, wanted stars, the clock, the mission objective and prompts,
// a health bar, a speedometer, and a 2D minimap canvas (roads, blocks, the sea, the player
// arrow, cars, police and the mission marker). The minimap is redrawn every frame from the
// world state; the text panels only when their value changes.
import { CITY_HALF, GRID, PALETTE } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const MAP_SIZE = 220;

export function createHud() {
  const root = document.getElementById('hud');
  const cashEl = document.getElementById('hud-cash');
  const starsEl = document.getElementById('hud-stars');
  const clockEl = document.getElementById('hud-clock');
  const objectiveEl = document.getElementById('hud-objective');
  const promptEl = document.getElementById('hud-prompt');
  const healthFill = document.getElementById('hud-health-fill');
  const speedEl = document.getElementById('hud-speed');
  const titleEl = document.getElementById('screen-title');
  const pausedEl = document.getElementById('screen-paused');
  const overEl = document.getElementById('screen-over');
  const overStatsEl = document.getElementById('over-stats');
  const toastEl = document.getElementById('hud-toast');
  const mapCanvas = document.getElementById('minimap');
  mapCanvas.width = MAP_SIZE;
  mapCanvas.height = MAP_SIZE;
  const map = mapCanvas.getContext('2d');

  let lastCash = -1;
  let lastStars = -1;
  let lastClock = '';
  let lastObjective = '';
  let lastPrompt = '';
  let lastSpeed = -1;
  let lastHp = -1;
  let toastTimer = 0;

  function toMap(x, z) {
    return [((x + CITY_HALF + 20) / (CITY_HALF * 2 + 40)) * MAP_SIZE, ((z + CITY_HALF + 20) / (CITY_HALF * 2 + 40)) * MAP_SIZE];
  }

  function drawMinimap(state) {
    map.fillStyle = '#20262e';
    map.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
    // Sea and beach to the south.
    const [, seaY] = toMap(0, CITY_HALF);
    map.fillStyle = '#2e7f9e';
    map.fillRect(0, seaY, MAP_SIZE, MAP_SIZE - seaY);
    map.fillStyle = '#e8d49a';
    map.fillRect(0, seaY - 8, MAP_SIZE, 8);
    // Blocks and roads.
    for (let line = -CITY_HALF; line <= CITY_HALF; line += GRID) {
      const [rx] = toMap(line, 0);
      const [, rz] = toMap(0, line);
      map.fillStyle = PALETTE.minimapRoad;
      map.fillRect(rx - 2, 0, 4, MAP_SIZE);
      map.fillRect(0, rz - 2, MAP_SIZE, 4);
    }
    map.fillStyle = PALETTE.minimapBlock;
    for (let bx = -CITY_HALF + GRID / 2; bx < CITY_HALF; bx += GRID) {
      for (let bz = -CITY_HALF + GRID / 2; bz < CITY_HALF; bz += GRID) {
        const [x, y] = toMap(bx - 13, bz - 13);
        map.fillRect(x, y, 12, 12);
      }
    }
    // Mission marker: a pulsing gold diamond.
    if (state.missionTarget) {
      const [mx, my] = toMap(state.missionTarget.x, state.missionTarget.z);
      const pulse = 5 + Math.sin(performance.now() / 240) * 2;
      map.fillStyle = PALETTE.gold;
      map.beginPath();
      map.moveTo(mx, my - pulse);
      map.lineTo(mx + pulse, my);
      map.lineTo(mx, my + pulse);
      map.lineTo(mx - pulse, my);
      map.closePath();
      map.fill();
    }
    // Traffic cars as grey dots, police as flashing blue/red.
    for (const car of state.cars) {
      if (car.dead) continue;
      const [cx, cy] = toMap(car.x, car.z);
      if (car.kind === 'police') {
        map.fillStyle = Math.floor(performance.now() / 200) % 2 === 0 ? '#ff2a1e' : '#2a6cff';
      } else if (car.kind === 'player') {
        continue;
      } else {
        map.fillStyle = '#9aa3ad';
      }
      map.fillRect(cx - 2, cy - 2, 4, 4);
    }
    // Player arrow, pointing along the heading.
    const [px, py] = toMap(state.player.x, state.player.z);
    map.save();
    map.translate(px, py);
    // The arrow is drawn pointing up (north, -z on the map); rotate it by the heading so it
    // points along the player's direction of travel.
    map.rotate(state.player.heading);
    map.fillStyle = '#ffffff';
    map.beginPath();
    map.moveTo(0, -7);
    map.lineTo(5, 6);
    map.lineTo(-5, 6);
    map.closePath();
    map.fill();
    map.restore();
    // North marker.
    map.fillStyle = '#e8e6df';
    map.font = 'bold 11px system-ui, sans-serif';
    map.fillText('N', 8, 14);
  }

  return {
    showScreen(screen, stats) {
      titleEl.style.display = screen === SCREEN_TITLE ? 'flex' : 'none';
      pausedEl.style.display = screen === SCREEN_PAUSED ? 'flex' : 'none';
      overEl.style.display = screen === SCREEN_OVER ? 'flex' : 'none';
      root.style.display = screen === SCREEN_PLAY ? 'block' : 'none';
      if (screen === SCREEN_OVER && stats) {
        overStatsEl.textContent = `Cash $${stats.cash} · Missions ${stats.missionsDone}/3 · Wanted best ${stats.bestWanted}★`;
      }
    },
    toast(text) {
      toastEl.textContent = text;
      toastEl.style.opacity = '1';
      toastTimer = 2.6;
    },
    draw(state, dt) {
      if (toastTimer > 0) {
        toastTimer -= dt;
        if (toastTimer <= 0) toastEl.style.opacity = '0';
      }
      if (state.cash !== lastCash) {
        lastCash = state.cash;
        cashEl.textContent = `$${state.cash}`;
      }
      const stars = Math.ceil(state.wanted);
      if (stars !== lastStars) {
        lastStars = stars;
        starsEl.textContent = '★'.repeat(stars) + '☆'.repeat(5 - stars);
        starsEl.style.color = stars > 0 ? '#ff5a4e' : '#f5f1e6';
      }
      const hours = Math.floor(state.clock) % 24;
      const minutes = Math.floor((state.clock % 1) * 60);
      const clock = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      if (clock !== lastClock) {
        lastClock = clock;
        clockEl.textContent = clock;
      }
      if (state.objective !== lastObjective) {
        lastObjective = state.objective;
        objectiveEl.textContent = state.objective;
      }
      if (state.prompt !== lastPrompt) {
        lastPrompt = state.prompt;
        promptEl.textContent = state.prompt;
        promptEl.style.display = state.prompt ? 'block' : 'none';
      }
      const hp = Math.ceil(state.player.hp);
      if (hp !== lastHp) {
        lastHp = hp;
        healthFill.style.width = `${Math.max(0, hp)}%`;
        healthFill.style.background = hp > 50 ? '#58c96b' : hp > 25 ? '#f2c94c' : '#e5534b';
      }
      const speed = state.playerCar ? Math.round(Math.abs(state.playerCar.speed) * 3.6) : 0;
      if (speed !== lastSpeed) {
        lastSpeed = speed;
        speedEl.textContent = state.playerCar ? `${speed} km/h` : '';
      }
      drawMinimap(state);
    },
  };
}
