// SOLMAR — main.ts (program penyerahan entri gta6-01, Node 22)
// Menyalin game/ dan screenshots/ dari repo ini ke /output (atau
// MAKEFUN_OUTPUT_DIR di luar grader) lalu menulis /output/dossier.json
// memakai buildDossier dari vendor/makefun-game.ts (salinan kit, tak diubah).
// Hanya memakai Node standard library: tanpa install, tanpa network.

import { buildDossier } from './vendor/makefun-game.ts';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname);
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
  }),
);
console.log(`SOLMAR entry written to ${outDir}`);
