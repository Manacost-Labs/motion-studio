// Общее для скриптов League of Legends (lol-data.mjs, lol-assets.mjs). Сеть — официальный CDN Riot (Data Dragon) и, только для
// осколков рун, CommunityDragon с путём, закреплённым за патчем.
// Сырые файлы Data Dragon лежат в кэше out/cache/lol/<версия>/<локаль>/ — out/ не в git, а версия DD на CDN неизменна,
// поэтому кэш всегда можно собрать заново. В git попадает только сгенерированное: src/games/lol/data/{ids,champions}.ts
import fs from 'node:fs';
import path from 'node:path';
import {VIDEO} from '../../lib/paths.mjs';

export const DD = 'https://ddragon.leagueoflegends.com';
export const LOCALES = ['ru_RU', 'en_US'];
export const FILES = ['champion', 'item', 'runesReforged', 'summoner'];
export const CACHE = path.join(VIDEO, 'out', 'cache', 'lol');
export const DATA = path.join(VIDEO, 'src', 'games', 'lol', 'data');
export const PUBLIC = path.join(VIDEO, 'public', 'lol');

// JSON по адресу с повторами (CDN иногда отвечает 5xx)
export const getJson = async (url, retries = 3) => {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return await res.json();
    } catch (err) {
      if (attempt >= retries) throw new Error(`${url}: ${err.message}`);
      await new Promise((r) => setTimeout(r, 700 * attempt));
    }
  }
};

// Файл по адресу → путь на диске; готовый файл не перезаписывается (сплэши по адресу без версии меняются после
// визуальных обновлений — скачанное для ролика должно остаться прежним). Возвращает 'есть' | 'скачан' | 'нет на CDN'
export const download = async (url, file) => {
  if (fs.existsSync(file) && fs.statSync(file).size > 0) return 'есть';
  const res = await fetch(url);
  if (res.status === 404 || res.status === 403) return 'нет на CDN';
  if (!res.ok) throw new Error(`${url}: ${res.status} ${res.statusText}`);
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(`${file}.part`, Buffer.from(await res.arrayBuffer()));
  fs.renameSync(`${file}.part`, file);
  return 'скачан';
};

// Версии Data Dragon по убыванию, только вида 16.19.1 (в конце списка есть старые lolpatch_*)
export const ddVersions = async () => (await getJson(`${DD}/api/versions.json`)).filter((v) => /^\d+\.\d+\.\d+$/.test(v));

// ── Номер патча ──
// Data Dragon 16.19.1 = публичный «патч 26.19»: с 2025 года публичный номер — год (15.x → 25.x, 16.x → 26.x).
// В ролике (заголовок, обложка, голос) — только публичный номер. Однозначные патчи пишем с нулём (26.05), как 25.05 в 2025;
// для 26.1–26.9 формат не сверен по патчноуту — проверить при первом таком ролике (publicToDd понимает оба).
// 15.1–15.3 публично назывались 25.S1.1–25.S1.3 — не поддерживаем (ролики про старые патчи не делаем).
export const ddToPublic = (v) => {
  const m = /^(\d+)\.(\d+)(?:\.\d+)?$/.exec(String(v));
  if (!m) throw new Error(`ddToPublic: «${v}» — не версия Data Dragon (16.19.1)`);
  const major = Number(m[1]);
  const minor = Number(m[2]);
  if (major < 15 || (major === 15 && minor <= 3)) throw new Error(`ddToPublic: ${v} — до 15.4 своя публичная нумерация, не поддерживается`);
  return `${major + 10}.${String(minor).padStart(2, '0')}`;
};

// Публичный «26.19» (или «26.9», «26.09», «патч 26.19») → версия Data Dragon из списка versions ('16.19.1'); нет — ошибка
export const publicToDd = (pub, versions) => {
  const m = /(\d{2})\.(\d{1,2})\b/.exec(String(pub));
  if (!m) throw new Error(`publicToDd: «${pub}» — не номер патча (26.19)`);
  const prefix = `${Number(m[1]) - 10}.${Number(m[2])}.`;
  const v = versions.find((x) => x.startsWith(prefix));
  if (!v) throw new Error(`publicToDd: патча ${pub} (${prefix}x) ещё нет в Data Dragon — его обновляют вручную, с задержкой`);
  return v;
};

// ── Кэш данных ──
export const cachePath = (version, locale, file) => path.join(CACHE, version, locale, `${file}.json`);
export const readCache = (version, locale, file) => JSON.parse(fs.readFileSync(cachePath(version, locale, file), 'utf8'));
export const cachedVersions = () =>
  fs.existsSync(CACHE)
    ? fs
        .readdirSync(CACHE)
        .filter((v) => /^\d+\.\d+\.\d+$/.test(v))
        .sort((a, b) => b.localeCompare(a, 'en', {numeric: true}))
    : [];

// Версия последней генерации ids.ts (src/games/lol/data/ids.ts: DD_VERSION) — по ней lol-assets берёт данные из кэша
export const generatedVersion = () => {
  const f = path.join(DATA, 'ids.ts');
  return fs.existsSync(f) ? /DD_VERSION = '([\d.]+)'/.exec(fs.readFileSync(f, 'utf8'))?.[1] : undefined;
};

// ── CommunityDragon (сообщество, не Riot): только то, чего нет в Data Dragon — осколки рун ──
// Путь закрепляется за патчем (/16.19/, не /latest/): файлы под /latest/ меняются с каждым патчем
export const CDRAGON = 'https://raw.communitydragon.org';
export const cdragonPatch = (version) => String(version).split('.').slice(0, 2).join('.'); // '16.19.1' → '16.19'
export const cdragonData = (version, locale, file) => `${CDRAGON}/${cdragonPatch(version)}/plugins/rcp-be-lol-game-data/global/${locale}/v1/${file}`;
// iconPath из данных клиента ('/lol-game-data/assets/v1/perk-images/StatMods/…png') → адрес картинки (в CDragon пути в нижнем регистре)
export const cdragonAsset = (version, iconPath) =>
  `${CDRAGON}/${cdragonPatch(version)}/plugins/rcp-be-lol-game-data/global/default/${String(iconPath).replace(/^\/lol-game-data\/assets\//i, '').toLowerCase()}`;
export const cdragonCache = (version, file) => path.join(CACHE, version, 'cdragon', file);
// Осколок руны (StatMods, id 5001–5013): их нет в runesReforged.json Data Dragon — только в perks.json клиента
export const isShard = (perk) => perk.id >= 5000 && perk.id < 6000;

// Предмет Ущелья призывателей: есть на карте 11, покупается в магазине и не принадлежит чемпиону.
// Без фильтра в item.json сотни дублей для Арены и других режимов (Пояс великана 1011 / 221011 …)
export const isRiftItem = (it) => !!it.maps?.['11'] && !!it.gold?.purchasable && it.inStore !== false && !it.requiredChampion;

// Заклинание призывателя для обычной игры (не АРАМ, не Арена и т. п.)
export const isClassicSpell = (s) => (s.modes ?? []).includes('CLASSIC');

// Поиск чемпиона по id Data Dragon, английскому или русскому имени: 'MonkeyKing', 'Wukong', 'Вуконг', «кайса» → id
export const championIndex = (ru, en) => {
  const norm = (s) => String(s).toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]/gu, '');
  const map = new Map();
  for (const c of Object.values(ru.data)) {
    map.set(norm(c.id), c.id);
    map.set(norm(c.name), c.id);
    map.set(norm(en.data[c.id]?.name ?? c.id), c.id);
  }
  return (q) => map.get(norm(q));
};
