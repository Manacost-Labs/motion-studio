// Данные League of Legends из Data Dragon (официальный CDN Riot) → кэш и типы для конфигов роликов:
//   node scripts/games/lol/lol-data.mjs                    — последняя версия DD: скачать в кэш, сгенерировать ids.ts и champions.ts, самопроверка
//   node scripts/games/lol/lol-data.mjs --version 16.19.1  — конкретная версия (скачанное берётся из кэша)
//   node scripts/games/lol/lol-data.mjs --check            — только самопроверка по кэшу последней генерации: без сети и без записи
// Кэш: out/cache/lol/<версия>/{ru_RU,en_US}/{champion,item,runesReforged,summoner}.json (out/ не в git, версия на CDN неизменна),
//      out/cache/lol/<версия>/cdragon/perks.json — руны клиента из CommunityDragon (путь /16.19/): только ради осколков (ShardId).
// Пишет: src/games/lol/data/ids.ts (ChampionId, ItemId, RuneId, KeystoneId, RuneTreeId, ShardId, SpellId, DD_VERSION, PATCH)
//        src/games/lol/data/champions.ts (id → числовой key, ru/en имя, теги, иконка). Файлы перезаписываются только при изменениях.
// Публичный номер патча (26.19) — ddToPublic в lol-lib.mjs; в ролике — только он.
import fs from 'node:fs';
import path from 'node:path';
import {VIDEO} from '../../lib/paths.mjs';
import {cachePath, cachedVersions, cdragonCache, cdragonData, DATA, DD, ddToPublic, ddVersions, FILES, generatedVersion, getJson, isClassicSpell, isRiftItem, isShard, LOCALES, publicToDd, readCache} from './lol-lib.mjs';

process.chdir(VIDEO);
const args = process.argv.slice(2);
const check = args.includes('--check');
const vi = args.indexOf('--version');
const want = vi >= 0 ? args[vi + 1] : undefined;
if (vi >= 0 && !/^\d+\.\d+\.\d+$/.test(want ?? '')) {
  console.error('--version: нужна версия Data Dragon вида 16.19.1');
  process.exit(1);
}

// После fetch нельзя вызывать process.exit: в Node 24 на Windows libuv падает (UV_HANDLE_CLOSING) — main() возвращает код выхода
const main = async () => {
  // ── Версия и загрузка ──
  let versions;
  let version = want;
  if (check) {
    versions = cachedVersions();
    version ??= generatedVersion() ?? versions[0];
    if (!version) {
      console.error('кэш пуст — сначала node scripts/games/lol/lol-data.mjs');
      return 1;
    }
  } else {
    versions = await ddVersions();
    version ??= versions[0];
    if (!versions.includes(version)) {
      console.error(`версии ${version} нет в Data Dragon (последняя ${versions[0]})`);
      return 1;
    }
    const realm = await getJson(`${DD}/realms/ru.json`).catch(() => null); // поле v — версия клиента RU; поле n.rune (7.23.1) устарело
    if (realm?.v && realm.v !== version) console.log(`! realms/ru.json: v = ${realm.v}, берём ${version}`);
    let fetched = 0;
    for (const locale of LOCALES)
      for (const file of FILES) {
        const f = cachePath(version, locale, file);
        if (fs.existsSync(f)) continue;
        const json = await getJson(`${DD}/cdn/${version}/data/${locale}/${file}.json`);
        fs.mkdirSync(path.dirname(f), {recursive: true});
        fs.writeFileSync(f, JSON.stringify(json));
        fetched++;
      }
    console.log(`Data Dragon ${version}: скачано файлов ${fetched}, из кэша ${LOCALES.length * FILES.length - fetched}`);
    // Осколки рун есть только в данных клиента (CommunityDragon); путь закреплён за патчем, как и кэш DD
    const perks = cdragonCache(version, 'perks.json');
    if (!fs.existsSync(perks)) {
      const json = await getJson(cdragonData(version, 'ru_ru', 'perks.json')).catch((e) => {
        console.error(`CommunityDragon: ${e.message} — патча ещё нет на raw.communitydragon.org? Повторите позже`);
        return null;
      });
      if (!json) return 1;
      fs.mkdirSync(path.dirname(perks), {recursive: true});
      fs.writeFileSync(perks, JSON.stringify(json));
      console.log(`CommunityDragon ${cdragonData(version, 'ru_ru', 'perks.json')}: скачан`);
    }
  }
  for (const locale of LOCALES)
    for (const file of FILES)
      if (!fs.existsSync(cachePath(version, locale, file))) {
        console.error(`нет в кэше: ${path.relative(VIDEO, cachePath(version, locale, file))} — запустите без --check`);
        return 1;
      }
  if (!fs.existsSync(cdragonCache(version, 'perks.json'))) {
    console.error(`нет в кэше: ${path.relative(VIDEO, cdragonCache(version, 'perks.json'))} — запустите без --check`);
    return 1;
  }

  const ru = Object.fromEntries(FILES.map((f) => [f, readCache(version, 'ru_RU', f)]));
  const en = Object.fromEntries(FILES.map((f) => [f, readCache(version, 'en_US', f)]));

  // ── Сборка ──
  const champs = Object.values(ru.champion.data).sort((a, b) => a.id.localeCompare(b.id, 'en'));
  const itemsAll = Object.entries(ru.item.data);
  const items = itemsAll.filter(([, it]) => isRiftItem(it)).sort(([a], [b]) => Number(a) - Number(b));
  const trees = ru.runesReforged;
  const runes = trees.flatMap((t) => t.slots.flatMap((s, slot) => s.runes.map((r) => ({...r, tree: t, keystone: slot === 0}))));
  const shards = JSON.parse(fs.readFileSync(cdragonCache(version, 'perks.json'), 'utf8')).filter(isShard).sort((a, b) => a.id - b.id);
  const spellsAll = Object.values(ru.summoner.data);
  const spells = spellsAll.filter(isClassicSpell).sort((a, b) => Number(a.key) - Number(b.key));

  // ── Самопроверка ──
  const problems = [];
  const enIds = new Set(Object.keys(en.champion.data));
  const ruIds = new Set(champs.map((c) => c.id));
  for (const id of ruIds) if (!enIds.has(id)) problems.push(`чемпион ${id} есть в ru_RU, нет в en_US`);
  for (const id of enIds) if (!ruIds.has(id)) problems.push(`чемпион ${id} есть в en_US, нет в ru_RU`);
  const keys = new Map();
  for (const c of champs) {
    if (!/^[A-Za-z]+$/.test(c.id)) problems.push(`id чемпиона «${c.id}» — не латиница без знаков`);
    if (keys.has(c.key)) problems.push(`числовой key ${c.key} у ${keys.get(c.key)} и ${c.id}`);
    keys.set(c.key, c.id);
  }
  const runeIds = new Set();
  for (const r of runes) {
    if (runeIds.has(r.id)) problems.push(`руна ${r.id} повторяется`);
    runeIds.add(r.id);
  }
  if (!shards.length) problems.push('осколков рун (id 5001–5013) нет в perks.json CommunityDragon');
  for (const s of shards) if (runeIds.has(s.id)) problems.push(`осколок ${s.id} совпал по id с руной Data Dragon`);
  for (const [id] of items) if (!/^\d+$/.test(id)) problems.push(`id предмета «${id}» — не число`);
  const sameName = new Map();
  for (const [id, it] of items) sameName.set(it.name, [...(sameName.get(it.name) ?? []), id]);
  const dupNames = [...sameName].filter(([, ids]) => ids.length > 1);
  // Нумерация патча: пример и обратное преобразование по списку версий
  const pub = ddToPublic(version);
  let roundTrip;
  try {
    roundTrip = publicToDd(pub, versions.length ? versions : [version]);
  } catch (e) {
    roundTrip = e.message;
  }
  if (roundTrip !== version) problems.push(`publicToDd(${pub}) = ${roundTrip}, ожидалось ${version}`);

  console.log(`версия ${version} → публичный патч ${pub}; publicToDd('${pub}') = ${roundTrip}; пример: ddToPublic('16.5.1') = ${ddToPublic('16.5.1')}`);
  console.log(`чемпионы: ${champs.length} (en_US ${enIds.size})`);
  const dupShort = dupNames.filter(([, ids]) => ids.filter((id) => id.length <= 4).length > 1);
  console.log(
    `предметы: всего ${itemsAll.length}, на Ущелье ${items.length} (6-значных вариантов ${items.filter(([id]) => id.length > 4).length}); ` +
      `имён с дублями на Ущелье ${dupNames.length}${dupShort.length ? `, из них 4-значные пары: ${dupShort.map(([n, ids]) => `${n} ${ids.join('/')}`).join('; ')}` : ''}`,
  );
  console.log(`руны: деревьев ${trees.length}, ключевых ${runes.filter((r) => r.keystone).length}, всего ${runes.length}; осколков ${shards.length} (CommunityDragon: ${shards.map((s) => s.id).join(', ')})`);
  console.log(`заклинания призывателя: всего ${spellsAll.length}, для обычной игры ${spells.length}`);
  if (problems.length) {
    console.error(`ПРОБЛЕМЫ (${problems.length}):\n  ${problems.join('\n  ')}`);
    return 1;
  }
  if (check) {
    const stale = generatedVersion();
    console.log(stale === version ? `ids.ts сгенерирован из ${version}` : `! ids.ts сгенерирован из ${stale ?? '—'}, а проверялась ${version}`);
    return 0;
  }

  // ── Генерация ──
  const str = (s) => (s.includes("'") ? JSON.stringify(s) : `'${s}'`);
  const note = (s) => String(s).replace(/\s+/g, ' ').replace(/\*\//g, '');
  const union = (name, list) => `export type ${name} =\n${list.map(([v, comment], i) => `  | ${v}${i === list.length - 1 ? ';' : ''} // ${note(comment)}`).join('\n')}\n`;
  const twin = new Map(items.filter(([id]) => id.length <= 4).map(([id, it]) => [it.name, id])); // имя → 4-значный id
  const head = `// СГЕНЕРИРОВАН: node scripts/games/lol/lol-data.mjs — руками не править, перезапишется.
// Data Dragon ${version} = публичный патч ${pub}. Источник: ${DD}/cdn/${version}/data/ru_RU/
`;

  const ids = `${head}
export const DD_VERSION = '${version}';
// Публичный номер патча — только он в заголовке, на обложке и в голосе
export const PATCH = '${pub}';

// Чемпион — id Data Dragon (латиница, как в путях картинок). Не имя: 'MonkeyKing' — это Вуконг. Имена — champions.ts
${union('ChampionId', champs.map((c) => [str(c.id), c.name]))}
// Предмет Ущелья призывателей (карта 11, продаётся в магазине, не предмет чемпиона); в комментарии — имя ru_RU.
// 6-значные id — варианты предметов (в Data Dragon только карта 11, без 12 и 453), часто с тем же именем: в сборках брать 4-значный
${union('ItemId', items.map(([id, it]) => [id, id.length > 4 ? `${it.name} · вариант${twin.has(it.name) ? `, обычный — ${twin.get(it.name)}` : ''}` : it.name]))}
// Дерево рун
${union('RuneTreeId', trees.map((t) => [t.id, t.name]))}
// Ключевая руна (первый ряд дерева)
${union('KeystoneId', runes.filter((r) => r.keystone).map((r) => [r.id, `${r.name} · ${r.tree.name}`]))}
// Руна: ключевые и малые. Осколки — ShardId ниже: их нет в Data Dragon
${union('RuneId', runes.map((r) => [r.id, `${r.name} · ${r.tree.name}${r.keystone ? ' · ключевая' : ''}`]))}
// Осколок руны (StatMods) — из perks.json CommunityDragon ${cdragonData(version, 'ru_ru', 'perks.json').replace(/^https:\/\//, '')}.
// В списке и устаревшие (5002 броня, 5003 сопротивление магии, 5012) — какие стоят в рядах сейчас, сверять по клиенту или патчноуту
${union('ShardId', shards.map((s) => [s.id, `${s.name} · ${s.shortDesc.replace(/<[^>]+>/g, '').trim()}`]))}
// Заклинание призывателя для обычной игры
${union('SpellId', spells.map((s) => [str(s.id), s.name]))}`;

  const TAGS = [...new Set(champs.flatMap((c) => c.tags))].sort();
  const iconOdd = champs.filter((c) => c.image.full !== `${c.id}.png`);
  const champion = (c) =>
    `  ${c.id}: {key: ${Number(c.key)}, ru: ${str(c.name)}, en: ${str(en.champion.data[c.id].name)}, tags: [${c.tags.map(str).join(', ')}]${c.image.full !== `${c.id}.png` ? `, icon: ${str(c.image.full)}` : ''}},`;
  const champions = `${head}
import type {ChampionId} from './ids';

// Теги Data Dragon (класс в клиенте; русские подписи — отдельно, не здесь)
export type ChampionTag = ${TAGS.map(str).join(' | ')};

// key — числовой id: CommunityDragon (champions/<key>.json), видео умений (ability_0103_Q1), id образа = key × 1000 + номер (103000).
// Картинки Data Dragon: иконка ${DD}/cdn/<версия>/img/champion/<icon>, где icon = '<id>.png'${iconOdd.length ? ', кроме указанных' : ''};
// сплэш, центрированный и квадрат — ${DD}/cdn/img/champion/{splash,centered,tiles}/<id>_<номер образа>.jpg (качает lol-assets.mjs)
export type Champion = {key: number; ru: string; en: string; tags: ChampionTag[]; icon?: string};

export const CHAMPIONS: Record<ChampionId, Champion> = {
${champs.map(champion).join('\n')}
};
`;

  const write = (name, text) => {
    const f = path.join(DATA, name);
    if (fs.existsSync(f) && fs.readFileSync(f, 'utf8') === text) return console.log(`${path.relative(VIDEO, f)} — без изменений`);
    fs.mkdirSync(DATA, {recursive: true});
    fs.writeFileSync(f, text);
    console.log(`${path.relative(VIDEO, f)} — записан`);
  };
  write('ids.ts', ids);
  write('champions.ts', champions);
  return 0;
};
process.exitCode = await main();
