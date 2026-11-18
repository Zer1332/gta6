// SOLMAR — the story: three jobs from Mara Solano, played in order. A job
// starts with a phone call banner, then an objective with a map marker, then
// a payout banner. First Gear: steal the marked sedan from the parking lot
// and bring it to Mara's garage (fail if the sedan is wrecked). Sunset Run:
// deliver the package to the dock in 90 seconds. Dockside: beat the three
// Vulture rivals at the dock, then come back to Mara. After the third payout
// the city stays open for free roam.
import { MISSIONS, PLACES } from './config.js';

export const MISSION_IDLE = 'idle';
export const MISSION_CALL = 'call';
export const MISSION_ACTIVE = 'active';
export const MISSION_DONE = 'done';

export function createMissions(onEvent) {
  return {
    index: 0, // next mission to start; 3 means the story is finished
    phase: MISSION_IDLE,
    phaseTimer: 0,
    timeLeft: 0,
    objective: '',
    marker: null,
    targetCar: null,
    rivalsLeft: 0,
    onEvent,
  };
}

export function currentMission(missions) {
  return MISSIONS[missions.index] || null;
}

export function startCall(missions, audio) {
  const m = currentMission(missions);
  if (!m) return;
  missions.phase = MISSION_CALL;
  missions.phaseTimer = 0;
  audio.phone();
  missions.onEvent({
    type: 'call',
    title: `Mara Solano — ${m.name}`,
    text: m.brief,
  });
}

export function beginMission(missions, world) {
  const m = currentMission(missions);
  if (!m) return;
  missions.phase = MISSION_ACTIVE;
  missions.timeLeft = m.timeLimit || 0;
  if (m.id === 1) {
    missions.objective = 'Curi sedan yang ditandai, antar ke garasi Mara.';
    missions.marker = { x: PLACES.parking.x, z: PLACES.parking.z };
    missions.targetCar = world.missionSedan;
  } else if (m.id === 2) {
    missions.objective = 'Antar paket ke dermaga sebelum waktu habis!';
    missions.marker = { x: PLACES.dock.x, z: PLACES.dock.z };
  } else if (m.id === 3) {
    missions.objective = 'Kalahkan 3 anggota geng Vulture di dermaga.';
    missions.marker = { x: PLACES.dock.x, z: PLACES.dock.z };
    world.spawnRivals();
    missions.rivalsLeft = 3;
  }
  missions.onEvent({ type: 'objective', text: missions.objective });
}

function completeMission(missions, world) {
  const m = currentMission(missions);
  missions.phase = MISSION_DONE;
  missions.phaseTimer = 0;
  missions.marker = null;
  missions.objective = '';
  missions.onEvent({ type: 'complete', title: `Misi selesai: ${m.name}`, amount: m.reward });
  world.state.money += m.reward;
  missions.index += 1;
  if (missions.index < MISSIONS.length) {
    missions.phaseTimer = 0;
  }
}

function failMission(missions, reason) {
  missions.phase = MISSION_CALL;
  missions.phaseTimer = 0;
  missions.timeLeft = 0;
  missions.objective = '';
  missions.marker = null;
  missions.onEvent({ type: 'failed', title: 'Misi gagal', text: reason });
}

function arriveAt(player, x, z, radius = 13) {
  // 13 m, not 10: a car stops 11 m from the garage's centre (its 9.4 m face
  // plus the car's own 1.6 m radius), so a 10 m radius could never trigger.
  const px = player.inCar ? player.inCar.x : player.x;
  const pz = player.inCar ? player.inCar.z : player.z;
  return Math.hypot(px - x, pz - z) < radius;
}

export function updateMissions(missions, world, dt) {
  const m = currentMission(missions);
  const player = world.player;
  if (!m) return;
  if (missions.phase === MISSION_CALL) {
    missions.phaseTimer += dt;
    if (missions.phaseTimer > 4.5) beginMission(missions, world);
    return;
  }
  if (missions.phase === MISSION_DONE) {
    missions.phaseTimer += dt;
    if (missions.phaseTimer > 3 && missions.index < MISSIONS.length) startCall(missions, world.audio);
    return;
  }
  if (missions.phase !== MISSION_ACTIVE) return;

  if (m.id === 1) {
    const sedan = missions.targetCar;
    if (sedan && !sedan.alive) {
      failMission(missions, 'Sedan target hancur. Mara tidak akan membayar mobil rongsokan.');
      return;
    }
    if (player.inCar === sedan) {
      missions.objective = 'Bawa sedan ke garasi Mara.';
      missions.marker = { x: PLACES.garage.x, z: PLACES.garage.z };
      if (arriveAt(player, PLACES.garage.x, PLACES.garage.z, 13)) completeMission(missions, world);
    } else {
      missions.objective = 'Curi sedan yang ditandai dari tempat parkir.';
      missions.marker = { x: PLACES.parking.x, z: PLACES.parking.z };
    }
  } else if (m.id === 2) {
    missions.timeLeft -= dt;
    if (missions.timeLeft <= 0) {
      failMission(missions, 'Waktu habis — paket tidak sampai ke dermaga.');
      return;
    }
    if (arriveAt(player, PLACES.dock.x, PLACES.dock.z, 13)) completeMission(missions, world);
  } else if (m.id === 3) {
    if (missions.rivalsLeft > 0) {
      missions.objective = `Kalahkan geng Vulture: ${missions.rivalsLeft} tersisa.`;
      missions.marker = { x: PLACES.dock.x, z: PLACES.dock.z };
    } else {
      missions.objective = 'Kembali ke Mara di garasi.';
      missions.marker = { x: PLACES.garage.x, z: PLACES.garage.z };
      if (arriveAt(player, PLACES.garage.x, PLACES.garage.z, 13)) completeMission(missions, world);
    }
  }
}

export function rivalDown(missions) {
  missions.rivalsLeft = Math.max(0, missions.rivalsLeft - 1);
}
