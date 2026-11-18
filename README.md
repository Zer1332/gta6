# SOLMAR — Open-World Crime 3D

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Zer1332/gta6/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/Zer1332/gta6/reward.svg)](https://make.fun/bounty/gta6-01)

Entri untuk bounty [Make GTA 6 (gta6-01)](https://make.fun/bounty/gta6-01) di make.fun.

## Game

**SOLMAR** adalah game open-world crime 3D orisinal, sepenuhnya buatan sendiri:
kota fiksi pesisir bernama Solmar, dibangun prosedural dengan three.js r160
(vendored di `game/vendor/three.min.js`). Tanpa aset, nama, logo, atau karakter
dari Rockstar / GTA. Semua seni visual dibuat prosedural, semua suara
disintesis lewat WebAudio.

Kamu adalah **Rook**, sopir sewaan. Fixer **Mara Solano** memberimu tiga misi
berurutan lewat telepon:

1. **First Gear** — curi sedan biru dari parkiran dan antar ke garasi Mara. **$300**
2. **Sunset Run** — antar paket ke dermaga dalam **90 detik**. **$500**
3. **Dockside** — kalahkan 3 anggota geng rival **Vulture** di dermaga, lalu kembali ke Mara. **$800**

Sesudah semua misi selesai, free roam tetap terbuka.

## Fitur

- Kota 800×800 m: jalan grid, distrik dermaga di tepi laut, menara pusat kota,
  blok perumahan, jalan lingkar, siklus siang-malam senja, pohon palem.
- Lalu lintas sipil (24 mobil) dan pejalan kaki (40 orang) yang lari saat ada tembakan.
- Wanted level 0–5 bintang: polisi mengejar dengan mobil patroli; wanted turun
  bila 20 detik tak terlihat. Tertangkap atau nyawa habis → respawn di rumah
  sakit dan kehilangan 10% uang.
- Jalan kaki (WASD + mouse, Shift lari, Space lompat), mengemudi (W/S/A/D,
  Space rem tangan), bertarung (klik menembak, R isi ulang, 1/2 ganti
  pistol/SMG). Nyawa 100, pulih setelah 5 detik tanpa damage.
- HUD lengkap: bar nyawa, uang, bintang wanted, objektif misi, timer,
  kecepatan, amunisi, minimap, crosshair. Layar awal, pause (P/Esc),
  mute (M), restart (R), layar game over dengan statistik.
- Progres (uang, misi selesai, skor terbaik) tersimpan di localStorage.
- Mode screenshot deterministik: `?shot=start|drive|chase|mission&seed=1`.

## Mainkan

```sh
node serve.ts
# buka http://localhost:8080
```

## Serahkan (hand in)

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
# menulis out/dossier.json + out/game/ + out/screenshots/
```

## Struktur

```
game/index.html          entry point
game/src/                15 modul (satu tanggung jawab per file):
  config.js random.js audio.js input.js city.js vehicles.js player.js
  police.js missions.js combat.js hud.js render.js world.js shots.js main.js
game/vendor/three.min.js three.js r160 (vendored)
vendor/makefun-game.ts   library kit make.fun (tidak diubah)
screenshots/             4 screenshot JPG 1280x720 dari mode ?shot=
main.ts                  program penyerahan (Node 22, stdlib saja)
serve.ts                 server statis lokal
```

## Lisensi

MIT — lihat [LICENSE](LICENSE).
