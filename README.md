# SOLMAR — Open-World Crime

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Zer1332/gta6/rank.svg)](https://make.fun/c/gta6-01)
[![reward](https://make.fun/badge/gta6-01/Zer1332/gta6/reward.svg)](https://make.fun/c/gta6-01)

Game open-world crime 3D orisinal, sepenuhnya buatan sendiri, untuk bounty
make.fun **gta6-01 "Make GTA 6"**. Kota fiksi pesisir **Solmar**: jalan grid,
dermaga, menara pusat kota, taman, dan laut di timur — semuanya prosedural,
semua suara disintesis lewat WebAudio, tanpa aset dari game lain.

## Cerita

Kamu **Rook**, sopir sewaan. Fixer **Mara Solano** memberimu pekerjaan lewat
telepon. Tiga misi cerita berurutan:

1. **First Gear** — curi sedan biru di Tempat Parkir Marina, antar ke Garasi
   Mara. Hadiah **$300**. Gagal bila sedan hancur.
2. **Sunset Run** — antar paket dari Kantor Pusat ke Ujung Dermaga dalam
   **90 detik**. Ngebut di pusat kota menaikkan perhatian polisi. Hadiah
   **$500**.
3. **Dockside** — kalahkan 3 anggota geng rival **Vulture** di dermaga, lalu
   kembali ke Mara. Hadiah **$800**.

Sesudah semua misi selesai, free roam tetap terbuka. Progres (uang, misi,
skor terbaik) tersimpan otomatis di `localStorage`.

## Sistem

- **Kota hidup**: 24 mobil lalu lintas yang mengikuti jalan dan belok di
  persimpangan, 40 pejalan kaki yang lari saat ada tembakan, siklus
  siang-malam dengan cahaya senja.
- **Wanted 0–5 bintang**: mencuri mobil, menembak, dan ngebut dekat polisi
  menaikkan wanted. Mobil patroli dan petugas mengejar; wanted turun bila
  tak terlihat 20 detik. Tertangkap atau tewas = respawn di rumah sakit dan
  kehilangan 10% uang.
- **Combat**: pistol (damage 25) dan SMG (damage 12), isi ulang, musuh yang
  membalas tembakan, tracer dan muzzle flash.
- **HUD**: bar nyawa, uang, bintang wanted, objektif misi, timer, kecepatan,
  amunisi, crosshair, dan **minimap** (pemain, penanda misi, polisi, mobil).

## Kontrol

| Aksi | Tombol |
|---|---|
| Jalan kaki | WASD + mouse (pointer lock), Shift lari, Space lompat |
| Masuk/keluar mobil | E (F juga bisa) |
| Mengemudi | W gas, S rem/mundur, A/D setir, Space rem tangan |
| Menembak / isi ulang / ganti senjata | Klik mouse / R / 1-2 |
| Pause / mute | P atau Esc / M |

## Cara main

```sh
node serve.ts
# buka http://localhost:8080 di desktop Chrome, klik "CLICK TO START"
```

Tanpa build step, tanpa network request: `game/index.html` + `game/src/`
(vanilla JS modular, ~15 file) + `game/vendor/three.min.js` (three.js r160).

## Mode screenshot

`?shot=start|drive|chase|mission&seed=1` — kamera dan posisi tetap untuk
tiap mode, deterministik dari seed. Screenshot di `screenshots/` diambil
dari mode-mode ini (1280×720).

## Lisensi

MIT — lihat `LICENSE`.
