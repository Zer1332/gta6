// SOLMAR — config.js
// Satu sumber kebenaran untuk angka balance, tata kota, dan definisi misi.
// Semua nama, tempat, dan karakter di sini orisinal (kota fiksi Solmar).

export const CONFIG = {
  // Dunia
  cityHalf: 400, // kota 800 x 800 meter, pusat di (0, 0)
  roadEvery: 100, // jarak antar jalan grid
  roadWidth: 14,
  waterX: 405, // air mulai di timur kota
  seed: 1,

  // Pemain
  playerHealth: 100,
  healthRegenDelay: 5, // detik tanpa damage sebelum pulih
  healthRegenRate: 8, // HP per detik
  walkSpeed: 6,
  runSpeed: 10,
  jumpSpeed: 7,

  // Mobil pemain
  carTopSpeed: 38, // m/s, sedikit di atas mobil polisi
  carAccel: 16,
  carBrake: 30,
  carTurn: 1.9,
  carHealth: 100,

  // Lalu lintas
  trafficCars: 24,
  trafficSpeedMin: 8,
  trafficSpeedMax: 14,
  pedestrians: 40,

  // Senjata
  pistolDamage: 25,
  pistolMag: 12,
  pistolFireRate: 0.28,
  smgDamage: 12,
  smgMag: 30,
  smgFireRate: 0.09,
  reloadTime: 1.4,

  // Polisi / wanted
  maxWanted: 5,
  wantedDecayTime: 20, // detik tak terlihat sebelum wanted turun
  policeCarSpeed: 34, // sedikit di bawah top speed pemain
  bustDistance: 3,
  bustTime: 2.5,

  // Ekonomi
  startMoney: 50,
  deathPenalty: 0.1, // kehilangan 10% uang saat tertangkap / tewas
  missionRewards: [300, 500, 800],
  mission2TimeLimit: 90, // detik
};

// Lokasi kunci di peta (x, z). Sumbu x ke timur (dermaga), z ke selatan.
export const PLACES = {
  hospital: { x: -320, z: -320, name: 'Rumah Sakit Solmar' },
  parkingLot: { x: -280, z: 220, name: 'Tempat Parkir Marina' },
  maraGarage: { x: 280, z: -220, name: 'Garasi Mara' },
  packagePickup: { x: -100, z: -100, name: 'Kantor Pusat' },
  dockGate: { x: 380, z: 150, name: 'Gerbang Dermaga' },
  dockEnd: { x: 445, z: 150, name: 'Ujung Dermaga' },
  vultureCamp: { x: 415, z: 150, name: 'Dermaga Vulture' },
  downtown: { x: 0, z: 0, name: 'Pusat Kota' },
};

// Definisi tiga misi cerita, berurutan.
export const MISSIONS = [
  {
    id: 0,
    title: 'First Gear',
    reward: 300,
    call: 'Mara Solano: "Rook, ada sedan biru di Tempat Parkir Marina. Ambil, antar ke garasiku. Jangan sampai hancur."',
    objectives: [
      'Curi sedan biru di Tempat Parkir Marina (tekan E di dekatnya)',
      'Antar sedan ke Garasi Mara',
    ],
  },
  {
    id: 1,
    title: 'Sunset Run',
    reward: 500,
    call: 'Mara Solano: "Paket di Kantor Pusat harus sampai ke dermaga dalam 90 detik. Jangan ngebut di pusat kota — polisi sedang siaga."',
    objectives: [
      'Ambil paket di Kantor Pusat',
      'Antar paket ke Ujung Dermaga sebelum waktu habis',
    ],
    timeLimit: 90,
  },
  {
    id: 2,
    title: 'Dockside',
    reward: 800,
    call: 'Mara Solano: "Geng Vulture menguasai dermaga. Habisi ketiganya, lalu kembali ke garasi. Hati-hati, Rook."',
    objectives: [
      'Kalahkan 3 anggota geng Vulture di dermaga',
      'Kembali ke Garasi Mara',
    ],
  },
];

// Palet warna kota saat senja.
export const PALETTE = {
  sky: 0xff9a5c,
  fog: 0xe88a5a,
  ground: 0x9a9a92,
  road: 0x2e2e33,
  sidewalk: 0xb8b8ae,
  sand: 0xd9c08a,
  water: 0x1e5f7a,
  building: [0x8a7f72, 0x6f7f8a, 0x9a8a6a, 0x7a6a7f, 0x5f6f7a, 0xa08a7a, 0x74655a],
  glass: 0x2a3a4a,
  palmTrunk: 0x7a5a3a,
  palmLeaf: 0x2f7a3a,
  police: 0x1a1a2e,
};
