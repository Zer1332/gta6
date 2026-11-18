[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Zer1332/gta6/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Zer1332/gta6/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# SOLMAR

Game open-world crime 3D orisinal yang berjalan sepenuhnya offline di browser
desktop, dari file statis. Kamu adalah **Rook**, sopir sewaan di kota pesisir
fiksi **Solmar**. Seorang fixer bernama **Mara Solano** meneleponmu dengan
pekerjaan — dan pekerjaan itu tidak pernah legal.

Tidak ada satu pun nama, karakter, peta, atau aset dari game komersial di sini:
kota, orang, mobil, cerita, dan suara semuanya dibuat prosedural di dalam game
ini.

## Yang ada di dalam game

- **Kota Solmar 800×800 meter** — jalan grid, menara pusat kota, blok
  perumahan, jalan lingkar, dan distrik dermaga di tepi laut, dengan cahaya
  senja yang bergeser perlahan.
- **Lalu lintas dan pejalan kaki** — 24 mobil sipil yang berputar mengikuti
  blok kota dan berhenti di persimpangan, 40 pejalan kaki di trotoar yang lari
  saat mendengar tembakan.
- **Mencuri dan mengemudi** — dekati mobil apa pun, tekan E, dan mobil itu
  milikmu (polisi akan tahu).
- **Wanted 0–5 bintang** — mencuri mobil, menembak, dan ngebut di dekat
  patroli menaikkan wanted. Mobil polisi mengejar; bersembunyi 20 detik
  menurunkan satu bintang. Tertangkap atau tumbang berarti bangun di rumah
  sakit dan kehilangan 10% uang.
- **3 misi cerita dari Mara Solano** — *First Gear* (curi sedan, antar ke
  garasi, $300), *Sunset Run* (antar paket ke dermaga dalam 90 detik, $500),
  dan *Dockside* (kalahkan 3 anggota geng rival Vulture, $800). Sesudah itu
  free roam tetap terbuka.
- **Combat** — pistol dan SMG, isi ulang, nyawa yang pulih setelah 5 detik
  tanpa damage.
- **HUD lengkap** — bar nyawa, uang, bintang wanted, objektif misi, timer,
  kecepatan, amunisi, crosshair, dan minimap dengan pemain, penanda misi,
  polisi, dan lalu lintas.
- **Suara sintetis** — dengung mesin, sirene, tembakan, dan dering telepon,
  semuanya dibuat lewat WebAudio. Tanpa file audio.
- **Save** — uang, misi selesai, dan uang terbanyak tersimpan di localStorage.

## Cara main

Buka `game/index.html` lewat server statis apa pun (misalnya
`node serve.ts`, lalu buka http://localhost:8080). Klik layar awal untuk
mulai. Tekan **F** untuk menerima pekerjaan pertama dari Mara.

| Kontrol | Fungsi |
| --- | --- |
| WASD | Jalan kaki / gas, rem, setir |
| Mouse | Melihat (pointer lock) |
| Shift | Lari |
| Space | Lompat / rem tangan |
| E | Masuk / keluar mobil |
| F | Terima misi |
| Klik mouse | Tembak |
| R | Isi ulang |
| 1 / 2 | Pistol / SMG |
| P / Esc | Jeda |
| M | Mute |
| R (di layar game over) | Main lagi |

## Mode screenshot

URL query `?shot=start|drive|chase|mission&seed=1` menampilkan satu adegan
deterministik (kamera dan posisi tetap untuk tiap mode) untuk keperluan
screenshot.

## Teknologi

- three.js r160 (satu file minified di `game/vendor/three.min.js`)
- JavaScript vanilla modular — satu tanggung jawab per file di `game/src/`:
  `config`, `random`, `audio`, `input`, `city`, `vehicles`, `player`,
  `police`, `missions`, `combat`, `hud`, `render`, `world`, `shots`, `main`
- Tanpa network request saat dimainkan; semua aset prosedural

## Entri make.fun

Program `main.ts` di root menyalin `game/` dan `screenshots/` ke `/output`
dan menulis `/output/dossier.json` memakai library kit
`vendor/makefun-game.ts`. Jalankan secara lokal dengan:

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Lisensi

MIT — lihat `LICENSE`.
