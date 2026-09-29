// Докачивает картинки карт в public/hs (готовые пропускаются):
//   node scripts/hs-assets.mjs CAP_107 CAP_103 …          — рендер карты (ruRU) и арт
//   node scripts/hs-assets.mjs --art CATA_473 …            — только арт (для фонов)
//   node scripts/hs-assets.mjs --trim                      — обрезать белые поля у уже скачанных артов и полосок
import fs from 'node:fs';
import path from 'node:path';
import {download, HS, trimTile, trimWhite} from './hs-lib.mjs';

const args = process.argv.slice(2);
if (args.includes('--trim')) {
  const art = path.join(HS, 'art');
  const arts = fs.readdirSync(art).filter((f) => f.endsWith('.jpg') && trimWhite(path.join(art, f)));
  const tiles = path.join(HS, 'tiles');
  const strips = fs.readdirSync(tiles).filter((f) => f.endsWith('.png') && trimTile(path.join(tiles, f)));
  console.log(`арты обрезаны: ${arts.length}, полоски обрезаны: ${strips.length}`);
  process.exit(0);
}
const artOnly = args.includes('--art');
for (const id of args.filter((a) => !a.startsWith('--'))) {
  if (!artOnly) console.log(`render/${id}.png — ${await download(`https://art.hearthstonejson.com/v1/render/latest/ruRU/512x/${id}.png`, `render/${id}.png`)}`);
  console.log(`art/${id}.jpg — ${await download(`https://art.hearthstonejson.com/v1/512x/${id}.jpg`, `art/${id}.jpg`)}`);
}
