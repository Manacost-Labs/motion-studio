// Рендерит стартовые кадры для Higgsfield.
// node scripts/plates.mjs        — вертикаль в public/plates
// node scripts/plates.mjs h      — горизонталь 16:9 в public/plates-h
import {getCompositions, renderStill} from '@remotion/renderer';
import path from 'node:path';
import fs from 'node:fs';
import {VIDEO} from './lib/paths.mjs';
import {bundleStudio, CHROME} from './lib/remotion.mjs';

process.chdir(VIDEO);

const wide = process.argv[2] === 'h';
const prefix = wide ? 'plate-h-' : 'plate-';
const outDir = path.resolve(wide ? 'public/plates-h' : 'public/plates');
fs.mkdirSync(outDir, {recursive: true});

const FRAME = {hook: 0, standard: 60, cards: 80, arena: 60, bg: 60, end: 0};
const browserExecutable = CHROME;
const serveUrl = await bundleStudio('ads'); // сборка удаляется при выходе (lib/remotion.mjs)
const comps = (await getCompositions(serveUrl, {browserExecutable})).filter(
  (c) => c.id.startsWith(prefix) && (wide || !c.id.startsWith('plate-h-')),
);

for (const composition of comps) {
  const id = composition.id.replace(prefix, '');
  const output = path.join(outDir, id + '.png');
  await renderStill({serveUrl, composition, frame: FRAME[id], output, imageFormat: 'png', browserExecutable});
  console.log(output);
}
