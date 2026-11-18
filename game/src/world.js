// SOLMAR — the world: everything the loop steps. It owns the city, the
// traffic, the pedestrians, Rook, the police, the missions and the combat,
// and wires them together: E steals or leaves a car, click fires the held
// weapon, F answers Mara's call, and every crime feeds the wanted level.
// The mission sedan waits in the parking lot; the three Vulture rivals only
// exist once Dockside begins.
import * as THREE from 'three';
import { CAR_TUNE, PED_COUNT, PLACES, SOLMAR, TRAFFIC_COUNT } from './config.js';
import { buildCity } from './city.js';
import { createAudio } from './audio.js';
import { createCombat, makeRival, testShot, updateRival } from './combat.js';
import { addWanted, createPolice, updatePolice, clearPolice, hospitalRespawn } from './police.js';
import { createMissions, currentMission, rivalDown, startCall, updateMissions, MISSION_IDLE } from './missions.js';
import { createPlayer, damagePlayer, enterCar, exitCar, playerShootOrigin, spawnPlayerCar, updatePlayerOnFoot, weaponOf } from './player.js';
import { driveCar, makeTrafficCar, updateTrafficCar } from './vehicles.js';
import { intRange, pick, range } from './random.js';
import { PALETTE } from './config.js';

function makePedestrian(scene, rng) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: pick(rng, PALETTE.shirt) });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 1.0, 8), shirt);
  body.position.y = 1.0;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8), new THREE.MeshLambertMaterial({ color: 0xc89878 }));
  head.position.y = 1.75;
  group.add(head);
  scene.add(group);
  // Pedestrians walk along one road, on its sidewalk edge.
  const alongZ = rng() < 0.5;
  const road = intRange(rng, -4, 4) * SOLMAR.roadGap;
  return {
    mesh: group,
    x: alongZ ? range(rng, -380, 380) : road + 10,
    z: alongZ ? road + 10 : range(rng, -380, 300),
    alongZ,
    dir: rng() < 0.5 ? 1 : -1,
    speed: range(rng, 1.2, 2.2),
    flee: 0,
    alive: true,
    hp: 100,
  };
}

export function createWorld(scene, rng) {
  const audio = createAudio();
  const city = buildCity(scene, rng);
  const player = createPlayer(scene);
  player.x = PLACES.start.x;
  player.z = PLACES.start.z;
  player.mesh.position.set(player.x, 0, player.z);

  const traffic = [];
  for (let i = 0; i < TRAFFIC_COUNT; i += 1) traffic.push(makeTrafficCar(scene, rng, city.colliders));

  const peds = [];
  for (let i = 0; i < PED_COUNT; i += 1) peds.push(makePedestrian(scene, rng));

  // The mission sedan: a gold car parked in the lot, marked for First Gear.
  const missionSedan = spawnPlayerCar(scene, PLACES.parking.x, PLACES.parking.z, 0xe0a92e, 0.6);
  missionSedan.kind = 'mission';
  const markerRing = new THREE.Mesh(
    new THREE.TorusGeometry(3.2, 0.18, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd24c }),
  );
  markerRing.rotation.x = Math.PI / 2;
  markerRing.position.set(PLACES.parking.x, 0.25, PLACES.parking.z);
  scene.add(markerRing);

  const police = createPolice(scene, rng);
  const combat = createCombat(scene);
  const state = { money: 0, best: 0, missionsDone: 0, time: 0, shotsFired: 0 };

  const world = {
    scene, rng, audio, city, player, traffic, peds, police, combat,
    missionSedan, markerRing,
    state,
    rivals: [],
    speedTrapTimer: 0,
    prevCarSpeed: 0,
    missions: null,
  };

  world.spawnRivals = () => {
    for (const old of world.rivals) scene.remove(old.mesh);
    const spots = [
      { x: PLACES.dock.x - 14, z: PLACES.dock.z - 8 },
      { x: PLACES.dock.x + 10, z: PLACES.dock.z + 4 },
      { x: PLACES.dock.x + 2, z: PLACES.dock.z - 18 },
    ];
    world.rivals = spots.map((s) => makeRival(scene, s.x, s.z));
  };

  world.missions = createMissions((event) => {
    if (event.type === 'call') {
      world.phoneEvent = event;
    } else if (event.type === 'complete') {
      state.missionsDone += 1;
      // The event fires before the reward lands in state.money, so count
      // the reward here or the best cash would lag one job behind.
      state.best = Math.max(state.best, state.money + (event.amount || 0));
      audio.pickup();
      world.bannerEvent = { title: event.title, sub: `+$${event.amount} — total $${state.money}` };
    } else if (event.type === 'failed') {
      world.bannerEvent = { title: event.title, sub: event.text };
    } else if (event.type === 'objective') {
      world.bannerEvent = null;
    }
  });
  world.phoneEvent = null;
  world.bannerEvent = null;
  world.update = (dt, input, view) => updateWorld(world, dt, input, view);
  return world;
}

function nearestCar(world, x, z, maxDist) {
  let best = null;
  let bestDist = maxDist;
  const all = [...world.traffic, world.missionSedan, ...world.police.cars];
  for (const car of all) {
    if (!car.alive) continue;
    const d = Math.hypot(car.x - x, car.z - z);
    if (d < bestDist) {
      bestDist = d;
      best = car;
    }
  }
  return best;
}

function updatePeds(world, dt) {
  for (const ped of world.peds) {
    if (!ped.alive) continue;
    let speed = ped.speed;
    if (ped.flee > 0) {
      ped.flee -= dt;
      speed = 6;
    }
    if (ped.alongZ) {
      ped.x += ped.dir * speed * dt;
      if (ped.x > 380 || ped.x < -380) ped.dir *= -1;
    } else {
      ped.z += ped.dir * speed * dt;
      if (ped.z > 300 || ped.z < -380) ped.dir *= -1;
    }
    ped.mesh.position.set(ped.x, 0, ped.z);
    ped.mesh.rotation.y = ped.alongZ ? (ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (ped.dir > 0 ? 0 : Math.PI);
  }
}

export function updateWorld(world, dt, input, view) {
  const player = world.player;
  const audio = world.audio;
  world.state.time += dt;
  world.shotWantedTimer = Math.max(0, (world.shotWantedTimer ?? 0) - dt);
  world.markerRing.rotation.z += dt * 1.5;
  world.markerRing.visible = world.missions.index === 0;
  const pulse = 1 + Math.sin(world.state.time * 3) * 0.12;
  world.markerRing.scale.set(pulse, pulse, 1);

  // --- Player: on foot or driving.
  if (player.inCar) {
    const ctl = input.drive();
    const car = player.inCar;
    const before = car.speed;
    const kmh = driveCar(car, ctl, dt, world.city.colliders) * 3.6;
    world.speedKmh = kmh;
    // A hard crash wrecks the mission sedan.
    if (before - car.speed > 14 && car === world.missionSedan) {
      car.hp = (car.hp ?? 100) - 25;
      audio.crash();
      if (car.hp <= 0) {
        car.alive = false;
        car.mesh.rotation.z = 0.5;
      }
    }
    // Speeding past a patrol car draws attention.
    world.speedTrapTimer -= dt;
    if (Math.abs(car.speed) > 25 && world.police.cars.length > 0 && world.speedTrapTimer <= 0) {
      addWanted(world.police, 1);
      world.speedTrapTimer = 10;
    }
    audio.engine(Math.abs(car.speed) / CAR_TUNE.maxSpeed);
    if (input.justPressed('KeyE')) {
      const left = exitCar(player);
      if (left) {
        left.driver = null;
        if (left.kind === 'traffic') left.parked = true;
      }
      audio.engineOff();
    }
  } else {
    world.speedKmh = 0;
    const walk = input.walk();
    updatePlayerOnFoot(player, walk, view.camYaw, dt, world.city.colliders, input.justPressed('Space'));
    if (input.justPressed('KeyE')) {
      const car = nearestCar(world, player.x, player.z, 4.5);
      if (car) {
        enterCar(player, car);
        if (car.kind === 'traffic') {
          addWanted(world.police, 1);
          world.bannerEvent = { title: 'Mobil dicuri!', sub: 'Wanted naik — polisi mengejarmu.' };
        }
        audio.click();
      }
    }
  }

  // --- Shooting.
  player.fireTimer -= dt;
  player.reloadTimer -= dt;
  const weapon = weaponOf(player);
  const wantsFire = weapon.auto ? input.mouseHeld : input.takeClick();
  if (wantsFire && !player.inCar && player.alive && player.reloadTimer <= 0 && player.fireTimer <= 0) {
    const slot = player.ammo[player.weapon];
    if (slot.mag > 0) {
      player.fireTimer = weapon.rate;
      slot.mag -= 1;
      world.state.shotsFired += 1;
      const from = playerShootOrigin(player);
      const dir = new THREE.Vector3();
      view.camera.getWorldDirection(dir);
      world.combat.fire(from, dir, weapon.range);
      audio.shot();
      // Gunfire draws the law: one star per burst, at most every 8 seconds.
      if ((world.shotWantedTimer ?? 0) <= 0) {
        addWanted(world.police, 1);
        world.shotWantedTimer = 8;
      }
      const bodies = [...world.rivals, ...world.peds];
      const hit = testShot(from, dir, weapon.range, bodies);
      if (hit) {
        hit.hp -= weapon.damage;
        if (hit.hp <= 0 && hit.alive) {
          hit.alive = false;
          hit.mesh.rotation.x = -Math.PI / 2;
          hit.mesh.position.y = 0.3;
          if (world.rivals.includes(hit)) {
            rivalDown(world.missions);
            addWanted(world.police, 1);
          } else {
            addWanted(world.police, 1);
          }
        } else if (!world.rivals.includes(hit)) {
          hit.flee = 4;
        }
      }
    } else {
      player.fireTimer = 0.3;
      audio.click();
    }
  }
  if (input.justPressed('KeyR') && !player.inCar) {
    const slot = player.ammo[player.weapon];
    if (slot.mag < weapon.mag && slot.reserve > 0) {
      const need = weapon.mag - slot.mag;
      const take = Math.min(need, slot.reserve);
      slot.mag += take;
      slot.reserve -= take;
      player.reloadTimer = 0.9;
      audio.reload();
    }
  }
  if (input.justPressed('Digit1')) { player.weapon = 'pistol'; audio.click(); }
  if (input.justPressed('Digit2')) { player.weapon = 'smg'; audio.click(); }

  // --- F starts the next job when Mara is not already on the line.
  if (input.justPressed('KeyF') && world.missions.phase === MISSION_IDLE && currentMission(world.missions)) {
    startCall(world.missions, audio);
  }

  // --- Traffic, pedestrians, rivals, police.
  for (const car of world.traffic) {
    if (car.driver === 'player' || car.parked) continue;
    updateTrafficCar(car, dt);
  }
  updatePeds(world, dt);
  for (const rival of world.rivals) {
    updateRival(rival, player.inCar ? { x: player.inCar.x, z: player.inCar.z } : player, dt, (r) => {
      const from = new THREE.Vector3(r.x, 1.4, r.z);
      const target = player.inCar
        ? new THREE.Vector3(player.inCar.x, 1, player.inCar.z)
        : new THREE.Vector3(player.x, 1.2, player.z);
      const dir = target.clone().sub(from).normalize();
      world.combat.fire(from, dir, 40);
      audio.rivalShot();
      // Deterministic hit roll from the rival's position and the clock, so a
      // seeded run always lands the same shots. On foot Rook is an easier
      // target than a moving car, but not a guaranteed one: a Vulture who
      // never misses would kill him in seconds, and the mission would be
      // unwinnable.
      const hitRoll = Math.abs(Math.sin(r.x * 7.3 + r.z * 3.1 + world.state.time * 1.7));
      if (player.inCar) {
        if (hitRoll < 0.4) damagePlayer(player, 4);
      } else if (hitRoll < 0.55) {
        damagePlayer(player, 6);
      }
    });
  }
  const policeResult = updatePolice(world.police, dt, player, audio);
  world.policeSeen = policeResult.seen;
  world.policeBusted = policeResult.busted;

  // --- Missions and combat tracers.
  updateMissions(world.missions, world, dt);
  world.combat.update(dt);

  // --- Death and bust.
  if (!player.alive || policeResult.busted) {
    const lost = Math.floor(world.state.money * 0.1);
    world.state.money -= lost;
    world.wastedEvent = {
      title: player.alive ? 'Tertangkap!' : 'Rook tumbang!',
      stats: `Kehilangan $${lost} (10%). Uang sekarang $${world.state.money}. Misi selesai: ${world.state.missionsDone}/3.`,
    };
    clearPolice(world.police);
    hospitalRespawn(player);
    audio.engineOff();
    audio.busted();
  }
  return world;
}
