// SOLMAR — the wanted system: 0 to 5 stars. Stealing a car, firing a gun
// or speeding past a patrol raises it; staying unseen for twenty seconds
// drops a star. Each star keeps a police car in the chase (up to five), and
// at three stars officers join on foot. Get caught standing still next to a
// patrol car, or lose all health, and Rook wakes up at the hospital minus
// ten percent of his cash.
import { PLACES } from './config.js';
import { makePoliceCar, updatePoliceCar } from './vehicles.js';
import { intRange } from './random.js';

const UNSEEN_DROP_SECONDS = 20;
const BUSTED_HOLD_SECONDS = 2;

export function createPolice(scene, rng) {
  return {
    wanted: 0,
    unseenTimer: 0,
    bustedTimer: 0,
    cars: [],
    officers: [],
    rng,
    scene,
  };
}

export function addWanted(police, amount) {
  police.wanted = Math.max(0, Math.min(5, police.wanted + amount));
  police.unseenTimer = 0;
  police.bustedTimer = 0;
}

export function wantedCarCount(police) {
  return Math.min(police.wanted, 5);
}

function spawnChaser(police, nearX, nearZ) {
  const car = makePoliceCar(police.scene);
  const angle = police.rng() * Math.PI * 2;
  car.x = nearX + Math.sin(angle) * 55;
  car.z = nearZ + Math.cos(angle) * 55;
  car.x = Math.max(-390, Math.min(390, car.x));
  car.z = Math.max(-390, Math.min(330, car.z));
  police.cars.push(car);
  return car;
}

export function updatePolice(police, dt, player, audio) {
  const target = player.inCar ? { x: player.inCar.x, z: player.inCar.z } : { x: player.x, z: player.z };
  const wanted = police.wanted;
  const wantCars = wantedCarCount(police);
  // Keep the chase fleet at the wanted level's size.
  while (police.cars.length < wantCars) spawnChaser(police, target.x, target.z);
  while (police.cars.length > wantCars) {
    const car = police.cars.pop();
    car.alive = false;
    police.scene.remove(car.mesh);
  }
  let nearest = Infinity;
  for (const car of police.cars) {
    const dist = updatePoliceCar(car, target.x, target.z, dt, audio);
    nearest = Math.min(nearest, dist);
  }
  audio.siren(dt, police.cars.length > 0);

  // Wanted cools off after twenty seconds out of every patrol car's sight.
  // Sight here is simple and fair: a patrol car within 45 m sees Rook.
  const seen = nearest < 45;
  if (wanted > 0) {
    if (seen) police.unseenTimer = 0;
    else {
      police.unseenTimer += dt;
      if (police.unseenTimer >= UNSEEN_DROP_SECONDS) {
        police.wanted -= 1;
        police.unseenTimer = 0;
      }
    }
  }

  // Busted: on foot, slow, and a patrol car right on top of Rook.
  let busted = false;
  if (wanted > 0 && !player.inCar && player.speed < 2 && nearest < 4) {
    police.bustedTimer += dt;
    if (police.bustedTimer >= BUSTED_HOLD_SECONDS) busted = true;
  } else {
    police.bustedTimer = 0;
  }
  return { nearest, seen, busted };
}

export function clearPolice(police) {
  for (const car of police.cars) police.scene.remove(car.mesh);
  police.cars = [];
  police.wanted = 0;
  police.unseenTimer = 0;
  police.bustedTimer = 0;
}

export function hospitalRespawn(player) {
  player.x = PLACES.hospital.x + 20;
  player.z = PLACES.hospital.z + 18;
  player.y = 0;
  player.vy = 0;
  player.health = 100;
  player.alive = true;
  player.mesh.position.set(player.x, 0, player.z);
  player.mesh.visible = true;
  if (player.inCar) {
    player.inCar.driver = null;
    player.inCar = null;
  }
}

export { intRange };
