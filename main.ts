// NEON VOID's entrypoint (Node 22, standard library only). The game lives in this
// repository as plain static files under game/ — index.html plus ES modules, no
// library, no network request — and this program hands it in: it copies game/ and
// screenshots/ from beside this file into /output and writes /output/dossier.json
// with the vendored make.fun dossier builder, so the sealed scorer can check the
// entry byte for byte.
//
// Play it locally first: `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const output = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyTree(name) {
  const from = join(root, name);
  const to = join(output, name);
  if (!existsSync(from)) return 0;
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
  return readdirSync(to, { recursive: true }).length;
}

mkdirSync(output, { recursive: true });
const gameEntries = copyTree('game');
const shotEntries = copyTree('screenshots');
if (gameEntries === 0) throw new Error('game/ is missing: nothing to hand in');
if (shotEntries === 0) throw new Error('screenshots/ is missing: the judge needs 3 or 4 shots');

// The scorer's own caps: only text_max_bytes shapes the bytes; the rest refuse an
// entry the scorer would refuse — more than 4 screenshots or one over 256 KiB; more
// than 993 files in game/ or 48 MiB of game files in all; a path under game/ over
// 1000 bytes. game/ shares /output's own 1000-entry cap with screenshots/ and the
// dossier, so the counts above leave them room.
const dossier = buildDossier(output, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(output, 'dossier.json'), dossier);
