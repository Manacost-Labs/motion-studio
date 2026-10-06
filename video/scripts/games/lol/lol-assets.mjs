// Докачивает картинки League of Legends из Data Dragon в public/lol — только для нужных роликов чемпионов (не весь архив;
// dragontail на 2,6 ГБ не качать). Готовые файлы не перезаписываются: сплэши по адресу без версии меняются после визуальных
// обновлений, а ролик должен остаться прежним. Версия данных — та, из которой сгенерирован src/games/lol/data/ids.ts (lol-data.mjs).
//   node scripts/games/lol/lol-assets.mjs Ahri Вуконг "Кай'Са"     — образ 0: splash, centered, tile, icon, abilities (P Q W E R)
//   node scripts/games/lol/lol-assets.mjs Ahri --skins 0,7         — номера образов (неверный номер — печатается список образов)
//   node scripts/games/lol/lol-assets.mjs Ahri --only splash,icon  — только эти виды (+ loading — вертикальный 308×560)
//   node scripts/games/lol/lol-assets.mjs --items 3020,3157 --runes 8112,8100 --spells SummonerFlash   — иконки сборки
//   node scripts/games/lol/lol-assets.mjs --shards 5008,5005,5011   — осколки рун (CommunityDragon, путь закреплён за патчем)
//   --dry — только показать, что будет скачано
// Чемпиона можно назвать id Data Dragon, английским или русским именем (MonkeyKing = Wukong = Вуконг).
// Куда (id образа = key × 1000 + номер, Ари 0 → 103000):
//   splash/<id образа>.jpg 1215×717 · centered/<id образа>.jpg 1280×720 · tiles/<id образа>.jpg 380×380 · loading/<id образа>.jpg 308×560
//   icon/<ChampionId>.png 128×128 · ability/<ChampionId>/{P,Q,W,E,R}.png 64×64 · item/<ItemId>.png 64×64
//   rune/<RuneId>.png (ключевые 256, малые 64, деревья 32) · spell/<SpellId>.png 64×64 · shard/<ShardId>.png 32×32 (CommunityDragon)
// Разрешение мало для 4K: растяжение не больше 1,5× (правило — src/games/lol/GAME.md).
import fs from 'node:fs';
import path from 'node:path';
import {VIDEO} from '../../lib/paths.mjs';
import {cachePath, cdragonAsset, cdragonCache, championIndex, DD, download, generatedVersion, getJson, isShard, PUBLIC, readCache} from './lol-lib.mjs';

process.chdir(VIDEO);
const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? String(args[i + 1] ?? '').split(',').map((s) => s.trim()).filter(Boolean) : null;
};
const OPTS = ['--skins', '--only', '--items', '--runes', '--spells', '--shards'];
const names = args.filter((a, i) => !a.startsWith('--') && !OPTS.includes(args[i - 1]));
const dry = args.includes('--dry');
const KINDS = ['splash', 'centered', 'tile', 'loading', 'icon', 'abilities'];
const only = opt('--only') ?? ['splash', 'centered', 'tile', 'icon', 'abilities'];
const skins = (opt('--skins') ?? ['0']).map(Number);
const bad = only.filter((k) => !KINDS.includes(k));
if (bad.length || skins.some((n) => !Number.isInteger(n) || n < 0)) {
  console.error(`--only: ${KINDS.join(', ')}; --skins: номера образов через запятую (0 — базовый)`);
  process.exit(1);
}
if (!names.length && !opt('--items') && !opt('--runes') && !opt('--spells') && !opt('--shards')) {
  console.error('нужно: <чемпион…> и/или --items/--runes/--spells/--shards (см. шапку скрипта)');
  process.exit(1);
}

const version = generatedVersion();
if (!version || !fs.existsSync(cachePath(version, 'ru_RU', 'champion'))) {
  console.error('нет данных — сначала node scripts/games/lol/lol-data.mjs');
  process.exit(1);
}
const ru = (f) => readCache(version, 'ru_RU', f);
const champions = ru('champion');
const find = championIndex(champions, readCache(version, 'en_US', 'champion'));

// Полные данные чемпиона (образы, умения) — отдельный файл DD, тоже в кэш
const detail = async (id) => {
  const f = path.join(path.dirname(cachePath(version, 'ru_RU', 'champion')), 'champion', `${id}.json`);
  if (!fs.existsSync(f)) {
    const json = await getJson(`${DD}/cdn/${version}/data/ru_RU/champion/${id}.json`);
    fs.mkdirSync(path.dirname(f), {recursive: true});
    fs.writeFileSync(f, JSON.stringify(json));
  }
  return JSON.parse(fs.readFileSync(f, 'utf8')).data[id];
};

const jobs = []; // [адрес, файл в public/lol]
const missing = [];
const ids = [];
for (const name of names) {
  const id = find(name);
  if (!id) missing.push(`чемпион «${name}»`);
  else if (!ids.includes(id)) ids.push(id);
}
for (const id of ids) {
  const c = await detail(id);
  for (const num of skins) {
    const skin = c.skins.find((s) => s.num === num);
    if (!skin) {
      const own = c.skins.filter((s) => !s.name.includes('–')); // без вариантов цвета («Рубин», «Обсидиан»…)
      missing.push(`${id}: образа ${num} нет; есть ${own.map((s) => `${s.num} ${s.name === 'default' ? 'базовый' : s.name.trim()}`).join(', ')} (+ вариантов цвета ${c.skins.length - own.length})`);
      continue;
    }
    const art = {splash: 'splash', centered: 'centered', tile: 'tiles', loading: 'loading'};
    for (const kind of Object.keys(art)) if (only.includes(kind)) jobs.push([`${DD}/cdn/img/champion/${art[kind]}/${id}_${num}.jpg`, `${art[kind]}/${skin.id}.jpg`]);
  }
  if (only.includes('icon')) jobs.push([`${DD}/cdn/${version}/img/champion/${c.image.full}`, `icon/${id}.png`]);
  if (only.includes('abilities')) {
    jobs.push([`${DD}/cdn/${version}/img/passive/${c.passive.image.full}`, `ability/${id}/P.png`]);
    c.spells.forEach((s, i) => jobs.push([`${DD}/cdn/${version}/img/spell/${s.image.full}`, `ability/${id}/${'QWER'[i]}.png`]));
  }
}
const items = ru('item').data;
for (const id of opt('--items') ?? []) {
  if (items[id]) jobs.push([`${DD}/cdn/${version}/img/item/${id}.png`, `item/${id}.png`]);
  else missing.push(`предмет ${id}`);
}
const runes = new Map(ru('runesReforged').flatMap((t) => [[String(t.id), t.icon], ...t.slots.flatMap((s) => s.runes.map((r) => [String(r.id), r.icon]))]));
for (const id of opt('--runes') ?? []) {
  if (runes.has(id)) jobs.push([`${DD}/cdn/img/${runes.get(id)}`, `rune/${id}.png`]);
  else missing.push(`руна ${id}`);
}
const spells = ru('summoner').data;
for (const id of opt('--spells') ?? []) {
  if (spells[id]) jobs.push([`${DD}/cdn/${version}/img/spell/${spells[id].image.full}`, `spell/${id}.png`]);
  else missing.push(`заклинание ${id}`);
}
// Осколки рун — из perks.json CommunityDragon (кэш lol-data.mjs)
if (opt('--shards')) {
  const file = cdragonCache(version, 'perks.json');
  const perks = fs.existsSync(file) ? new Map(JSON.parse(fs.readFileSync(file, 'utf8')).filter(isShard).map((p) => [String(p.id), p.iconPath])) : null;
  if (!perks) missing.push(`осколки: нет ${path.relative(VIDEO, file)} — сначала node scripts/games/lol/lol-data.mjs`);
  else
    for (const id of opt('--shards')) {
      if (perks.has(id)) jobs.push([cdragonAsset(version, perks.get(id)), `shard/${id}.png`]);
      else missing.push(`осколок ${id} (есть: ${[...perks.keys()].join(', ')})`);
    }
}

let counts = {скачан: 0, есть: 0, 'нет на CDN': 0};
for (const [url, rel] of jobs) {
  const file = path.join(PUBLIC, rel);
  if (dry) {
    console.log(`${fs.existsSync(file) ? 'есть   ' : 'скачать'} lol/${rel} ← ${url}`);
    continue;
  }
  const r = await download(url, file);
  counts[r]++;
  if (r !== 'есть') console.log(`lol/${rel} — ${r}`);
}
if (!dry) console.log(`Data Dragon ${version}: скачано ${counts['скачан']}, уже были ${counts['есть']}, нет на CDN ${counts['нет на CDN']}`);
// после fetch не вызывать process.exit: в Node 24 на Windows libuv падает (UV_HANDLE_CLOSING) — только код выхода
if (missing.length) {
  console.error(`не найдено:\n  ${missing.join('\n  ')}`);
  process.exitCode = 1;
}
