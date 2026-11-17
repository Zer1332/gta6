// The game's rules and state: Rook, his cars, the traffic, the pedestrians, the police, the
// missions and the combat, all stepping together in fixed 1/60 s steps. step() advances one
// step and returns what happened as bit flags, so the caller can react (sounds, toasts, the
// game-over screen) without the world knowing about screens. Nothing here allocates after
// createWorld returns, except the occasional police unit and rival.
import * as THREE from 'three';
import { CAR, CITY_HALF, COMBAT, GRID, PALETTE, PED_COUNT, PLAYER, POLICE, STEP, TRAFFIC_COUNT, WANTED } from './config.js';
import { createCity } from './city.js';
import { assignTrafficRoute, collideCar, createCar, driveCar, updateTraffic } from './vehicles.js';
import { createPlayer, movePlayer } from './player.js';
import { addCrime, createPolice, updatePolice } from './police.js';
import { createMissions, PLACES } from './missions.js';
import { createCombat, makeRivalMesh, punch, shoot, updateEnemies } from './combat.js';
import { ACTION_ENTER, ACTION_PUNCH } from './input.js';

export const EVENT_HIT = 1;
export const EVENT_OVER = 2;
export const EVENT_MISSION = 4;
export const EVENT_CASH = 8;
export const EVENT_WANTED = 16;

function makePedMesh(color) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color });
  const skin = new THREE.MeshLambertMaterial({ color: '#d9a06c' });
  const pants = new THREE.MeshLambertMaterial({ color: '#2c3440' });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.65, 4, 10), shirt);
  body.position.y = 1.0;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 10), skin);
  head.position.y = 1.75;
  group.add(head);
  const legGeo = new THREE.BoxGeometry(0.2, 0.58, 0.2);
  const legL = new THREE.Mesh(legGeo, pants);
  legL.position.set(-0.16, 0.29, 0);
  group.add(legL);
  const legR = new THREE.Mesh(legGeo, pants);
  legR.position.set(0.16, 0.29, 0);
  group.add(legR);
  return { group, legL, legR };
}

export function createWorld(random, renderer, scene) {
  const city = createCity(scene, random);
  const combat = createCombat(scene);
  const police = createPolice();
  const missions = createMissions();
  const colliders = city.colliders;

  const player = createPlayer(0, 20);
  scene.add(player.mesh);
  const playerBlob = renderer.makeBlob(0.7, 0.7);

  // Traffic cars on road loops, and parked cars along the kerbs.
  const cars = [];
  const carBlobs = new Map();
  function addCar(car) {
    cars.push(car);
    scene.add(car.mesh);
    carBlobs.set(car.id, renderer.makeBlob(1.6, 2.6));
    return car;
  }
  for (let i = 0; i < TRAFFIC_COUNT; i += 1) {
    const car = createCar({
      x: 0, z: 0, heading: 0,
      color: PALETTE.traffic[Math.floor(random() * PALETTE.traffic.length)],
      kind: 'traffic',
    });
    assignTrafficRoute(car, random);
    car.speed = 6 + random() * 4;
    addCar(car);
  }
  for (let i = 0; i < 8; i += 1) {
    const point = city.randomRoadPoint(random);
    const onXRoad = Math.abs(point.x - Math.round(point.x / GRID) * GRID) < 1;
    const car = createCar({
      x: point.x + (onXRoad ? 6.5 : 0),
      z: point.z + (onXRoad ? 0 : 6.5),
      heading: onXRoad ? Math.PI / 2 : 0,
      color: PALETTE.traffic[Math.floor(random() * PALETTE.traffic.length)],
      kind: 'parked',
    });
    addCar(car);
  }

  // Pedestrians strolling the sidewalks.
  const peds = [];
  const pedBlobs = new Map();
  const pedColors = ['#e8b48a', '#7d3c98', '#16a085', '#c0392b', '#2e86c1', '#e67e22'];
  function spawnPed(ped) {
    const point = city.randomRoadPoint(random);
    ped.x = point.x + (random() - 0.5) * 8;
    ped.z = point.z + (random() - 0.5) * 8;
    ped.tx = ped.x;
    ped.tz = ped.z;
    ped.hp = COMBAT.pedHp;
    ped.down = 0;
    ped.flee = 0;
    ped.mesh.visible = true;
    ped.mesh.rotation.x = 0;
  }
  for (let i = 0; i < PED_COUNT; i += 1) {
    const { group, legL, legR } = makePedMesh(pedColors[i % pedColors.length]);
    const ped = {
      x: 0, z: 0, tx: 0, tz: 0, heading: 0, hp: COMBAT.pedHp,
      speed: 1.2 + random() * 0.8, walkPhase: random() * 6, down: 0, flee: 0,
      mesh: group, legL, legR,
    };
    spawnPed(ped);
    scene.add(ped.mesh);
    peds.push(ped);
    pedBlobs.set(ped, renderer.makeBlob(0.55, 0.55));
  }

  const state = {
    time: 0,
    clock: 15.5,
    cash: 0,
    missionsDone: 0,
    bestWanted: 0,
    player,
    playerCar: null,
    cars,
    peds,
    police,
    missions,
    combat,
    city,
    objective: '',
    prompt: '',
    missionTarget: null,
    wanted: 0,
    rivalsLeft: 0,
  };

  function nearestCar(maxDist) {
    let best = null;
    let bestDist = maxDist;
    for (const car of cars) {
      if (car.dead || car.kind === 'police') continue;
      const d = Math.hypot(car.x - player.x, car.z - player.z);
      if (d < bestDist) {
        bestDist = d;
        best = car;
      }
    }
    return best;
  }

  function enterCar(car) {
    state.playerCar = car;
    car.kind = 'player';
    player.mesh.visible = false;
    playerBlob.visible = false;
  }

  function exitCar() {
    const car = state.playerCar;
    if (!car) return;
    car.kind = 'parked';
    car.speed = 0;
    player.x = car.x - Math.sin(car.heading) * 3;
    player.z = car.z - Math.cos(car.heading) * 3;
    player.heading = car.heading;
    player.mesh.visible = true;
    playerBlob.visible = true;
    state.playerCar = null;
  }

  function spawnRivals() {
    combat.enemies = [];
    for (let i = 0; i < 3; i += 1) {
      const mesh = makeRivalMesh();
      // North of the container rows, on the open dockside apron: the fight happens in
      // the clear, not wedged between shipping containers.
      const enemy = {
        x: PLACES.docks.x - 8 + i * 8,
        z: PLACES.docks.z + 20 + (i % 2) * 6 - 3,
        heading: 0,
        hp: COMBAT.rivalHp,
        shootTimer: 1 + i * 0.5,
        mesh,
      };
      scene.add(mesh);
      combat.enemies.push(enemy);
    }
    state.rivalsLeft = 3;
  }

  function damagePlayer(amount) {
    if (player.hp <= 0) return;
    player.hp -= amount;
    player.hurtTimer = 0.4;
    player.regenTimer = 0;
    if (player.hp <= 0) {
      player.hp = 0;
    }
  }

  function syncMeshes() {
    player.mesh.position.set(player.x, 0, player.z);
    player.mesh.rotation.y = player.heading;
    playerBlob.position.set(player.x, 0.03, player.z);
    for (const car of cars) {
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
      const blob = carBlobs.get(car.id);
      if (blob) blob.position.set(car.x, 0.03, car.z);
    }
    for (const ped of peds) {
      ped.mesh.position.set(ped.x, 0, ped.z);
      ped.mesh.rotation.y = ped.heading;
      const blob = pedBlobs.get(ped);
      if (blob) blob.position.set(ped.x, 0.03, ped.z);
    }
    for (const cop of police.cops) {
      cop.mesh.position.set(cop.x, 0, cop.z);
      cop.mesh.rotation.y = cop.heading;
    }
    for (const copCar of police.cars) {
      copCar.mesh.position.set(copCar.x, 0, copCar.z);
      copCar.mesh.rotation.y = copCar.heading;
    }
    for (const enemy of combat.enemies) {
      enemy.mesh.position.set(enemy.x, 0, enemy.z);
      enemy.mesh.rotation.y = Math.atan2(player.x - enemy.x, player.z - enemy.z);
    }
  }

  function reset() {
    state.time = 0;
    state.clock = 15.5;
    state.cash = 0;
    state.missionsDone = 0;
    state.bestWanted = 0;
    state.playerCar = null;
    player.x = 0;
    player.z = 20;
    player.heading = 0;
    player.hp = PLAYER.hp;
    player.mesh.visible = true;
    playerBlob.visible = true;
    police.stars = 0;
    police.cars = [];
    police.cops = [];
    missions.index = 0;
    missions.stepIndex = 0;
    missions.done = false;
    missions.startStep();
    for (const car of cars) {
      if (car.kind === 'player') car.kind = 'parked';
      car.dead = false;
      car.mesh.visible = true;
      car.hp = 100;
    }
    for (const ped of peds) spawnPed(ped);
    combat.enemies = [];
    state.rivalsLeft = 0;
    syncMeshes();
  }

  function missionText() {
    const cur = missions.current();
    if (!cur) return { objective: 'Solmar is yours. Free roam — cause trouble, or just drive.', target: null };
    let text = `${cur.mission.name}: ${cur.step.text}`;
    if (cur.step.timer) text += ` — ${Math.max(0, Math.ceil(missions.timer))}s left`;
    if (cur.step.kind === 'defeat') text = text.replace('(3 left)', `(${state.rivalsLeft} left)`);
    return { objective: text, target: cur.step.target ?? null };
  }

  /**
   * One fixed step. `drive` is {throttle, steer, sprint} from input; `actions` the one-shot
   * flags; `mouseDown` fires the pistol while held; `audio` plays the sounds.
   */
  function step(dt, drive, actions, mouseDown, audio) {
    let events = 0;
    state.time += dt;
    state.clock = (15.5 + state.time / 120) % 24;
    state.wanted = police.stars;
    state.bestWanted = Math.max(state.bestWanted, Math.ceil(police.stars));

    const cur = missions.current();
    // Mission timers and the wait step tick down while the player is in place.
    if (cur && cur.step.timer) {
      missions.timer -= dt;
      if (missions.timer <= 0) {
        // Too slow: the job fails and restarts from its first step.
        missions.stepIndex = 0;
        missions.startStep();
        if (audio) audio.wantedUp();
        state.objective = 'Too slow — the job failed. Try again.';
        state.missionTarget = null;
        return events;
      }
    }

    // Enter / exit a car.
    if (actions & ACTION_ENTER) {
      if (state.playerCar) {
        exitCar();
      } else {
        const car = nearestCar(CAR.enterRange);
        if (car) {
          enterCar(car);
          addCrime(police, WANTED.stealCar, audio);
          events |= EVENT_WANTED;
          if (audio) audio.pickup();
        }
      }
    }

    // Driving or walking.
    if (state.playerCar) {
      const car = state.playerCar;
      const before = car.speed;
      driveCar(car, drive.throttle, drive.steer, dt);
      if (collideCar(car, colliders) && Math.abs(before) > 12 && audio) audio.crash();
      // Bump into traffic cars: push apart, lose speed.
      for (const other of cars) {
        if (other === car || other.dead) continue;
        const dx = other.x - car.x;
        const dz = other.z - car.z;
        const d = Math.hypot(dx, dz);
        if (d < 4.2 && d > 0.01) {
          const push = (4.2 - d) / d;
          other.x += dx * push * 0.5;
          other.z += dz * push * 0.5;
          car.x -= dx * push * 0.3;
          car.z -= dz * push * 0.3;
          if (Math.abs(car.speed) > 10) {
            car.speed *= 0.6;
            if (audio) audio.crash();
          }
        }
      }
      // Running over a pedestrian: a crime, and the pedestrian goes down.
      for (const ped of peds) {
        if (ped.down > 0) continue;
        const d = Math.hypot(ped.x - car.x, ped.z - car.z);
        if (d < 2.4 && Math.abs(car.speed) > 3) {
          ped.down = 3;
          ped.hp = 0;
          ped.mesh.rotation.x = Math.PI / 2;
          addCrime(police, WANTED.hitPed, audio);
          events |= EVENT_WANTED;
          if (audio) audio.crash();
        }
      }
    } else {
      // On foot: move relative to the camera yaw (passed in as the wish direction already).
      movePlayer(player, drive.mx, drive.mz, drive.sprint, dt, colliders);
    }

    // Traffic keeps to its loops; parked cars stay put.
    for (const car of cars) {
      if (car.kind === 'traffic') {
        updateTraffic(car, dt);
        collideCar(car, colliders);
      }
    }

    // Pedestrians stroll, flee gunfire, and get back up after being knocked down.
    for (const ped of peds) {
      if (ped.down > 0) {
        ped.down -= dt;
        if (ped.down <= 0) {
          ped.mesh.rotation.x = 0;
          spawnPed(ped);
        }
        continue;
      }
      const dx = ped.tx - ped.x;
      const dz = ped.tz - ped.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 1) {
        const point = city.randomRoadPoint(random);
        ped.tx = point.x + (random() - 0.5) * 8;
        ped.tz = point.z + (random() - 0.5) * 8;
      } else {
        const speed = ped.flee > 0 ? ped.speed * 2.6 : ped.speed;
        ped.heading = Math.atan2(dx, dz);
        ped.x += (dx / dist) * speed * dt;
        ped.z += (dz / dist) * speed * dt;
        ped.walkPhase += dt * speed * 2.2;
        ped.legL.rotation.x = Math.sin(ped.walkPhase) * 0.5;
        ped.legR.rotation.x = -Math.sin(ped.walkPhase) * 0.5;
      }
      if (ped.flee > 0) ped.flee -= dt;
    }

    // Combat on foot: punch up close, pistol on click.
    if (!state.playerCar) {
      const aim = { x: Math.sin(player.heading), z: Math.cos(player.heading) };
      if (actions & ACTION_PUNCH && player.punchCooldown <= 0) {
        player.punchCooldown = PLAYER.punchRate;
        const targets = [...combat.enemies, ...police.cops, ...peds.filter((p) => p.down <= 0)];
        const hit = punch(player, player.heading, targets, audio);
        if (hit) {
          if (hit.hp <= 0) {
            if (combat.enemies.includes(hit)) state.rivalsLeft = Math.max(0, state.rivalsLeft - 1);
            if (police.cops.includes(hit)) addCrime(police, WANTED.killCop, audio);
            if (peds.includes(hit)) {
              hit.down = 3;
              hit.mesh.rotation.x = Math.PI / 2;
            } else {
              hit.mesh.rotation.x = Math.PI / 2;
            }
          }
        }
      }
      if (mouseDown) {
        const targets = [...combat.enemies, ...police.cops, ...police.cars, ...peds.filter((p) => p.down <= 0)];
        const hit = shoot(combat, player, aim, targets, audio);
        if (hit) {
          addCrime(police, WANTED.shoot, audio);
          if (hit.hp <= 0) {
            if (combat.enemies.includes(hit)) {
              state.rivalsLeft = Math.max(0, state.rivalsLeft - 1);
              hit.mesh.rotation.x = Math.PI / 2;
            } else if (police.cops.includes(hit)) {
              addCrime(police, WANTED.killCop, audio);
              hit.mesh.rotation.x = Math.PI / 2;
            } else if (police.cars.includes(hit)) {
              hit.dead = true;
              hit.mesh.visible = false;
            } else {
              hit.down = 3;
              hit.mesh.rotation.x = Math.PI / 2;
            }
          }
          // Everyone nearby runs from the gunfire.
          for (const ped of peds) {
            if (Math.hypot(ped.x - player.x, ped.z - player.z) < 30) {
              ped.flee = 4;
              ped.tx = ped.x + (ped.x - player.x);
              ped.tz = ped.z + (ped.z - player.z);
            }
          }
        }
      }
      updateEnemies(combat, player, dt, (amount) => damagePlayer(amount));
    }

    // Police: chase, ram, punch — and take damage from the player's car.
    const target = state.playerCar
      ? { x: state.playerCar.x, z: state.playerCar.z, inCar: true }
      : { x: player.x, z: player.z, inCar: false };
    updatePolice(police, target, dt, random, (amount) => damagePlayer(amount), scene);
    if (state.playerCar) {
      for (const copCar of police.cars) {
        if (copCar.dead) continue;
        const d = Math.hypot(copCar.x - state.playerCar.x, copCar.z - state.playerCar.z);
        if (d < 4.4) {
          const rel = Math.abs(copCar.speed - state.playerCar.speed);
          if (rel > 6 && player.hurtTimer <= 0) {
            damagePlayer(POLICE.carRamDamage);
            copCar.ramCooldown = 1.2;
            if (audio) audio.crash();
          }
          // The ram shoves both cars apart.
          const push = (4.4 - d) / 2;
          const nx = (state.playerCar.x - copCar.x) / (d || 1);
          const nz = (state.playerCar.z - copCar.z) / (d || 1);
          state.playerCar.x += nx * push;
          state.playerCar.z += nz * push;
          copCar.x -= nx * push;
          copCar.z -= nz * push;
          copCar.speed *= 0.7;
        }
      }
    }

    // Mission progress.
    if (cur) {
      const stepDef = cur.step;
      const px = state.playerCar ? state.playerCar.x : player.x;
      const pz = state.playerCar ? state.playerCar.z : player.z;
      if (stepDef.kind === 'enterCar' && state.playerCar) {
        const res = missions.advance();
        if (res.missionDone) events |= EVENT_MISSION;
        missions.startStep();
      } else if (stepDef.kind === 'reach' && stepDef.target) {
        const d = Math.hypot(stepDef.target.x - px, stepDef.target.z - pz);
        if (d < (stepDef.radius ?? 10)) {
          const res = missions.advance();
          if (res.missionDone) {
            events |= EVENT_MISSION;
            state.cash += res.missionDone.reward;
            state.missionsDone += 1;
            events |= EVENT_CASH;
            if (audio) audio.missionDone();
          }
          const wanted = missions.startStep();
          if (wanted) addCrime(police, wanted, audio);
          if (missions.current() && missions.current().step.kind === 'defeat') spawnRivals();
        }
      } else if (stepDef.kind === 'wait') {
        const d = Math.hypot(stepDef.target.x - px, stepDef.target.z - pz);
        if (d < (stepDef.radius ?? 10)) {
          missions.waitLeft -= dt;
          if (missions.waitLeft <= 0) {
            const res = missions.advance();
            if (res.missionDone) {
              events |= EVENT_MISSION;
              state.cash += res.missionDone.reward;
              state.missionsDone += 1;
              events |= EVENT_CASH;
              if (audio) audio.missionDone();
            }
            missions.startStep();
            if (missions.current() && missions.current().step.kind === 'defeat') spawnRivals();
          }
        }
      } else if (stepDef.kind === 'defeat') {
        if (state.rivalsLeft <= 0 && combat.enemies.length > 0) {
          const res = missions.advance();
          if (res.missionDone) {
            events |= EVENT_MISSION;
            state.cash += res.missionDone.reward;
            state.missionsDone += 1;
            events |= EVENT_CASH;
            if (audio) audio.missionDone();
          }
          missions.startStep();
        }
      }
    }

    const text = missionText();
    state.objective = text.objective;
    state.missionTarget = text.target;
    state.prompt = !state.playerCar && nearestCar(CAR.enterRange) ? 'Press E to steal the car' : '';

    // Engine and siren follow the driving and the wanted level.
    if (audio) {
      audio.setEngine(state.playerCar ? Math.abs(state.playerCar.speed) : 0, !!state.playerCar);
      audio.setSiren(police.stars);
    }

    if (player.hp <= 0) events |= EVENT_OVER;
    syncMeshes();
    return events;
  }

  reset();
  return {
    state,
    reset,
    step,
    scene,
    /** Where the camera should look: the player, or their car. */
    cameraTarget() {
      if (state.playerCar) {
        return { x: state.playerCar.x, z: state.playerCar.z, heading: state.playerCar.heading, speed: Math.abs(state.playerCar.speed), car: state.playerCar };
      }
      return { x: player.x, z: player.z, heading: player.heading, speed: player.speed, car: null };
    },
  };
}
