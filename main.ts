// SOLMAR — main.ts (entrypoint program/v1)
// Menyerahkan game ke folder output: menyalin game/ dan screenshots/ dari
// repo lalu menulis dossier.json dengan buildDossier dari
// vendor/makefun-game.ts (kit make.fun, tidak diubah).
//
// ATURAN PALING PENTING: program ini TIDAK PERNAH menghapus direktori
// output itu sendiri. Di mesin grader folder output milik root dan program
// berjalan sebagai user 65534 — menghapus foldernya melempar EPERM.
// Yang dibersihkan hanyalah ISI di dalam folder output (tiap anak dihapus
// satu per satu); foldernya sendiri hanya dibuat bila belum ada.

import { mkdirSync, readdirSync, rmSync, cpSync, writeFileSync, lstatSync, chmodSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repoDir = process.env.MAKEFUN_BOT_DIR ? resolve(process.env.MAKEFUN_BOT_DIR) : here;
const outDir = process.env.MAKEFUN_OUTPUT_DIR ? resolve(process.env.MAKEFUN_OUTPUT_DIR) : '/output';

// 1. Buat folder output bila belum ada (rekursif). Jangan pernah hapus folder ini.
mkdirSync(outDir, { recursive: true });

// 2. Bersihkan HANYA ISI folder output: baca isinya, hapus tiap anak satu per satu.
// Salinan dari repo read-only ikut membawa mode read-only, jadi sebelum
// menghapus, buat tiap anak bisa ditulis dulu (rekursif) — kalau tidak,
// jalan kedua ke output yang sama akan gagal EACCES saat membersihkan.
function makeWritable(p: string): void {
  const st = lstatSync(p);
  if (st.isDirectory()) {
    for (const child of readdirSync(p)) makeWritable(join(p, child));
    chmodSync(p, 0o755);
  } else if (st.isFile()) {
    chmodSync(p, 0o644);
  }
}
for (const child of readdirSync(outDir)) {
  const p = join(outDir, child);
  try {
    makeWritable(p);
  } catch (e) {}
  rmSync(p, { recursive: true, force: true });
}

// 3. Salin game/ dan screenshots/ dari repo ke output.
for (const name of ['game', 'screenshots']) {
  const src = join(repoDir, name);
  const dst = join(outDir, name);
  cpSync(src, dst, { recursive: true });
}

// 4. Tulis dossier.json persis seperti yang ditulis buildDossier.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);

console.log('SOLMAR handed in to ' + outDir);
