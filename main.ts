// SOLMAR — the entry program for make.fun gta6-01 (Node 22, standard library
// only). It hands the game in: it copies this directory's game/ folder (plain
// static files a desktop browser loads offline: game/index.html and its ES
// modules, three.js vendored under game/vendor/) and screenshots/ (four JPEG
// renders of the game itself) to /output, and writes /output/dossier.json,
// the summary the judge reads, with the vendored make.fun library.
//
// The game itself is SOLMAR, an original open-world crime game: Rook, a hired
// driver in the fictional coastal city of Solmar, takes three jobs from the
// fixer Mara Solano — First Gear, Sunset Run and Dockside — while traffic,
// pedestrians, a five-star wanted system and the police answer everything he
// does. Nothing in it comes from any commercial game.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Solmar's own pre-flight: the gate refuses more than four screenshots or one
// over 256 KiB, so count and weigh them here and fail loudly instead of
// handing in an entry the scorer would refuse.
const shotDir = join(here, 'screenshots');
const shotNames = existsSync(shotDir) ? readdirSync(shotDir).filter((n) => !n.startsWith('.')) : [];
if (shotNames.length < 3 || shotNames.length > 4) {
  throw new Error(`SOLMAR needs 3 or 4 screenshots, found ${shotNames.length}`);
}
for (const name of shotNames) {
  const bytes = statSync(join(shotDir, name)).size;
  if (bytes > 262144) throw new Error(`SOLMAR screenshot ${name} is ${bytes} bytes, over the 256 KiB cap`);
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(shotDir)) cpSync(shotDir, join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the
// bytes; the others refuse an entry the scorer would refuse (more than 4
// screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of
// game files, in all, or a path under game/ over 1000 bytes: game/ counts
// beside /output's own 1000-entry cap, its screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

// One line in the run log so a human can see the hand-in landed.
console.log(`SOLMAR handed in: ${shotNames.length} screenshots, dossier written to ${join(out, 'dossier.json')}`);
