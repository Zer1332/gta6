// SOLMAR — every tuning number in one place. The city is 800 by 800 metres,
// roads on an 80 m grid, water along the south edge. All money is in dollars.
/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

export const SOLMAR = {
  cityHalf: 400,
  roadGap: 80,
  waterZ: 340,
  step: STEP,
  saveKey: 'solmar.save.v1',
};

export const PLAYER_TUNE = {
  walkSpeed: 6,
  runSpeed: 10,
  jumpSpeed: 8,
  gravity: 22,
  maxHealth: 100,
  regenDelay: 5,
  regenRate: 12,
  eyeHeight: 2.6,
};

export const CAR_TUNE = {
  maxSpeed: 34,
  policeMaxSpeed: 31,
  accel: 16,
  brake: 26,
  reverseMax: 10,
  steer: 1.9,
  handbrake: 30,
  grip: 6,
};

export const WEAPONS = {
  pistol: { name: 'Pistol', damage: 25, mag: 12, reserve: 60, rate: 0.28, range: 90, auto: false },
  smg: { name: 'SMG', damage: 12, mag: 30, reserve: 150, rate: 0.09, range: 70, auto: true },
};

export const RIVAL_HP = 60;
export const TRAFFIC_COUNT = 24;
export const PED_COUNT = 40;

export const MISSIONS = [
  { id: 1, name: 'First Gear', reward: 300, brief: 'Curi sedan yang ditandai dari tempat parkir, lalu antar ke garasi Mara.' },
  { id: 2, name: 'Sunset Run', reward: 500, brief: 'Antar paket ke dermaga dalam 90 detik. Jangan sampai terlambat.', timeLimit: 90 },
  { id: 3, name: 'Dockside', reward: 800, brief: 'Kalahkan 3 anggota geng Vulture di dermaga, lalu kembali ke Mara.' },
];

export const PLACES = {
  parking: { x: -200, z: 160 },
  garage: { x: 200, z: -200 },
  dock: { x: 0, z: 315 },
  hospital: { x: -280, z: -280 },
  mara: { x: 200, z: -200 },
  start: { x: 40, z: 40 },
};

export const SUNSET = {
  skyTop: 0x2e4a7a,
  skyHorizon: 0xff9a52,
  fog: 0xe08a4e,
  sunColor: 0xffb36b,
  sunIntensity: 1.6,
  hemiSky: 0x8a7bb8,
  hemiGround: 0x3a2f28,
};

export const PALETTE = {
  building: [0xb5a894, 0x93a7b8, 0xc4b28a, 0xa394b8, 0x8498a6, 0xcfc0a2, 0x9c8a7a, 0x74a0b5],
  car: [0xc23b2e, 0x2e6bc2, 0xe0a92e, 0x3aa655, 0xd8d8d8, 0x222226, 0x7a4fb0, 0xe07a2e],
  shirt: [0xe0e0e0, 0x3a7bd5, 0xe07a3a, 0x6ab04c, 0xd6457a, 0xf2c94c, 0x8e44ad, 0x2ecc71],
  asphalt: '#4a4d52',
  sidewalk: '#8d8578',
  water: 0x1d5f7a,
};
