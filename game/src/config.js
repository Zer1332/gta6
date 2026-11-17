// Every tuning number and colour in one place. Solmar is a sun-soaked coastal city on a
// 40 m road grid; the playable area runs -200..200 on both axes, the beach and sea past +200 z.

export const STEP = 1 / 60;

/** The city grid: roads every GRID metres, road surface ROAD_W wide, sidewalks either side. */
export const GRID = 40;
export const CITY_HALF = 200;
export const ROAD_W = 10;
export const SIDEWALK_W = 3;

export const PLAYER = {
  walkSpeed: 6,
  sprintSpeed: 10.5,
  radius: 0.6,
  hp: 100,
  punchRange: 2.2,
  punchDamage: 25,
  punchRate: 0.45,
};

export const CAR = {
  accel: 16,
  brake: 34,
  reverseMax: 11,
  maxSpeed: 38,
  steerMax: 0.55,
  grip: 0.92,
  radius: 2.1,
  enterRange: 4.5,
};

export const TRAFFIC_COUNT = 10;
export const PED_COUNT = 18;

export const POLICE = {
  carSpeed: 34,
  carRamDamage: 8,
  footSpeed: 7.2,
  punchDamage: 6,
  punchRange: 1.8,
  spawnRange: 90,
  despawnRange: 160,
};

export const COMBAT = {
  pistolRange: 42,
  pistolDamage: 34,
  pistolRate: 0.22,
  rivalHp: 68,
  copHp: 100,
  pedHp: 50,
  enemyShotDamage: 3,
  enemyShotRate: 1.6,
};

/** Wanted stars 0..5: heat rises with crime and cools when unseen and quiet. */
export const WANTED = {
  stealCar: 1,
  hitPed: 1,
  shoot: 0.5,
  killCop: 1,
  coolRate: 0.03,
  quietSeconds: 8,
};

/** Mission rewards in dollars. */
export const MISSIONS = [
  { id: 'first-gear', name: 'First Gear', reward: 300 },
  { id: 'sunset-run', name: 'Sunset Run', reward: 500 },
  { id: 'dockside', name: 'Dockside', reward: 800 },
];

export const PALETTE = {
  sky: '#8ec9e8',
  sun: '#fff2cf',
  sea: '#2e7f9e',
  sand: '#e8d49a',
  grass: '#7fae5a',
  asphalt: '#3a3f46',
  sidewalk: '#b9b3a4',
  building: ['#f2e3c6', '#e8b48a', '#d98a6a', '#f7f3ea', '#c9a37e', '#e5cfa8', '#b8c4c9'],
  glass: '#9fd4e8',
  player: '#2f6fd0',
  traffic: ['#c0392b', '#2e86c1', '#f1c40f', '#7d3c98', '#e67e22', '#95a5a6', '#16a085'],
  police: '#f4f6f7',
  minimapRoad: '#5a6068',
  minimapBlock: '#2c313a',
  text: '#f5f1e6',
  muted: '#c9c2ae',
  gold: '#f2c94c',
  red: '#e5534b',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Save key: cash, missions done, best score (this browser only). */
export const SAVE_KEY = 'solmar.save.v1';
