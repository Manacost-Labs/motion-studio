// Постеры колод из api.blizzcore.ru (POST /render {deck_code, image_style}) для YouTube-роликов.
//   node scripts/deck-posters.mjs <папка ролика в src/studios/manacost-youtube> [parchment|classic]
// Для каждой колоды из src/studios/manacost-youtube/<папка>/article.json: скачивает постер в public/decks/<папка>/<место>.jpg и дописывает
// в article.json поле poster: {src, w, h, order, types, rarities, rects, dust}. Порядок сначала по стоимости,
// затем scripts/poster-fit.mjs уточняет его по самому постеру и дописывает rects. По ним камера наезжает на названную карту.
import fs from 'node:fs';
import path from 'node:path';
import {studioDir} from './studios.mjs';
import {spawnSync} from 'node:child_process';
import {cardDb, decodeDeck, download} from './hs-lib.mjs';

const [folder, style = 'parchment'] = process.argv.slice(2);
if (!folder) throw new Error('node scripts/deck-posters.mjs <папка ролика> [parchment|classic]');
const file = path.join(studioDir('youtube'), folder, 'article.json');
const article = JSON.parse(fs.readFileSync(file, 'utf8'));
const byDbf = new Map((await cardDb()).map((c) => [c.dbfId, c]));
const outDir = path.resolve('public/decks', folder);
fs.mkdirSync(outDir, {recursive: true});

for (const d of article.decks) {
  const res = await fetch('https://api.blizzcore.ru/render', {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({deck_code: d.code, image_style: style}),
  });
  const r = await res.json();
  if (!r.success) {
    console.log(`${d.rank}. ${d.name}: ошибка ${r.error ?? res.status}`);
    continue;
  }
  const img = await fetch(r.image_url);
  const name = `${String(d.rank ?? d.name).padStart(2, '0')}.jpg`;
  fs.writeFileSync(path.join(outDir, name), Buffer.from(await img.arrayBuffer()));
  const [w, h] = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', path.join(outDir, name)], {encoding: 'utf8'})
    .stdout.trim()
    .split(',')
    .map(Number);
  // порядок карт на постере: стабильная сортировка порядка кода по стоимости
  const cards = decodeDeck(d.code)
    .cards.map(([dbf], i) => ({id: byDbf.get(dbf).id, cost: byDbf.get(dbf).cost ?? 0, type: byDbf.get(dbf).type, rarity: byDbf.get(dbf).rarity, i}))
    .sort((a, b) => a.cost - b.cost || a.i - b.i);
  // types, rarities — у существ и легендарок на постере чуть другой масштаб рендера (см. poster.ts)
  d.poster = {src: `decks/${folder}/${name}`, w, h, order: cards.map((c) => c.id), types: cards.map((c) => c.type), rarities: cards.map((c) => c.rarity), dust: r.cost};
  // рендеры всех карт колоды: ими poster-fit сверяет постер, и они же лежат поверх него в ролике
  for (const c of cards) await download(`https://art.hearthstonejson.com/v1/render/latest/ruRU/512x/${c.id}.png`, `render/${c.id}.png`);
  console.log(`${String(d.rank).padStart(2)}. ${d.name}: ${w}×${h}, ${cards.length} карт, ${r.cost} пыли`);
}
fs.writeFileSync(file, JSON.stringify(article, null, 1));

// точный порядок и положение каждой карты на постерах
spawnSync('node', ['scripts/poster-fit.mjs', folder], {stdio: 'inherit'});
