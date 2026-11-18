// SOLMAR — config.js
// Satu-satunya tempat angka balance dan titik-titik penting kota tinggal.
// Semua modul lain membaca dari sini supaya balance bisa diubah di satu file.

export const CONFIG = {
  title: 'SOLMAR',
  version: '1.0.0',
  worldSize: 800, // kota 800 x 800 meter, koordinat -400..400
  roadStep: 60, // jarak antar jalan grid
  roadWidth: 12,
  waterZ: 300, // z > 300 adalah laut; dermaga di z 240..300
  dockZ: 272,

  player: {
    hpMax: 100,
    walkSpeed: 6,
    runSpeed: 10,
    jumpSpeed: 8,
    regenDelay: 5, // detik tanpa damage sebelum nyawa pulih
    regenRate: 8, // hp per detik
    eyeHeight: 1.7,
  },

  car: {
    accel: 22,
    brake: 34,
    maxSpeed: 30,
    reverseMax: 10,
    steer: 1.9,
    grip: 6,
    policeMaxSpeed: 26,
  },

  weapons: {
    pistol: { name: 'Pistol', damage: 25, mag: 12, reserve: 72, fireDelay: 0.28, range: 85, auto: false },
    smg: { name: 'SMG', damage: 12, mag: 30, reserve: 150, fireDelay: 0.09, range: 65, auto: true },
  },

  enemy: { hp: 60, damage: 5, shootInterval: 1.4, aggroRange: 45 },

  trafficCount: 24,
  pedCount: 40,

  wanted: {
    max: 5,
    decayAfter: 20, // detik tak terlihat sebelum wanted turun
    bustDistance: 4.5,
    bustTime: 2.5,
  },

  missions: [
    {
      id: 0,
      name: 'First Gear',
      reward: 300,
      briefing:
        'Mara: "Rook, ada sedan biru di parkiran blok timur. Ambil, bawa ke garasiku. Jangan dihancurkan."',
      sedanPos: [180, -120],
      garagePos: [-240, 202], // di depan pintu garasi (bukan di tengah gedung)
      deliverRadius: 10,
    },
    {
      id: 1,
      name: 'Sunset Run',
      reward: 500,
      timeLimit: 90,
      briefing:
        'Mara: "Paket di garasi. Antar ke dermaga, 90 detik. Polisi lagi siaga di pusat kota — jangan ngebut di sana."',
      packagePos: [-240, 202],
      dockPos: [270, 225],
      deliverRadius: 10,
      pickupRadius: 6,
    },
    {
      id: 2,
      name: 'Dockside',
      reward: 800,
      briefing:
        'Mara: "Tiga Vulture nongkrong di dermaga. Bereskan mereka, lalu balik ke aku."',
      vulturePos: [
        [280, 244],
        [315, 246],
        [330, 240],
      ],
      returnPos: [-240, 202],
      returnRadius: 10,
    },
  ],

  // Titik-titik penting lain di kota.
  spots: {
    playerStart: [0, 0],
    hospital: [-300, -240],
    maraGarage: [-240, 202],
    dock: [270, 225],
    plaza: [0, 0],
  },

  saveKey: 'solmar-save-v1',
  startMoney: 50,
};
