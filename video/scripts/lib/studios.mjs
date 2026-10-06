// Реестр студий — единственный источник: src/studios/studios.json (его читают скрипты, render.ps1 и pre-commit через
// node scripts/studios.mjs). Поля: key, dir (папка в src/studios), kind (ads | features | youtube), title, game, brand,
// look, idPrefix (префикс id роликов, у рекламы null), port (Remotion Studio), freeze (check-ads | golden).
// Новая студия = строка в studios.json + папка src/studios/<dir> с index.ts и Root.tsx.
import fs from 'node:fs';
import path from 'node:path';
import {VIDEO} from './paths.mjs';

export const STUDIOS_DIR = path.join(VIDEO, 'src', 'studios');
export const REGISTRY = path.join(STUDIOS_DIR, 'studios.json');
if (!fs.existsSync(REGISTRY)) {
  throw new Error('Нет src/studios/studios.json — это единственный реестр студий (пишется руками или new-direction.mjs, не генерируется). Верни его: из коммита (git show HEAD:video/src/studios/studios.json), а если он ещё не закоммичен — по строкам студий из src/studios/*/README.md («Ключ … в studios.json») и package.json (studio:*); пустым не создавать');
}
export const STUDIOS = Object.freeze(JSON.parse(fs.readFileSync(REGISTRY, 'utf8')).map((s) => Object.freeze(s)));

const keys = () => STUDIOS.map((s) => s.key).join(', ');

// Запись реестра по ключу: studio('youtube') → {key, dir: 'manacost-youtube', kind: 'youtube', …}
export const studio = (key) => {
  const s = STUDIOS.find((x) => x.key === key);
  if (!s) throw new Error(`Нет студии «${key}» в src/studios/studios.json: ${keys()}`);
  return s;
};
// Папка студии: studioDir('youtube') → абсолютный путь к src/studios/manacost-youtube
export const studioDir = (key) => path.join(STUDIOS_DIR, studio(key).dir);
export const entryPoint = (key) => path.join(studioDir(key), 'index.ts');
export const youtubeStudios = () => STUDIOS.filter((s) => s.kind === 'youtube');

// Ролики студии — папки с config.ts (у YouTube — только с префиксом студии): videosOf('youtube') → ['yt-legend-decks-sep26']
export const videosOf = (key) => {
  const s = studio(key);
  const dir = studioDir(key);
  return fs
    .readdirSync(dir, {withFileTypes: true})
    .filter((d) => d.isDirectory() && (!s.idPrefix || d.name.startsWith(s.idPrefix)) && fs.existsSync(path.join(dir, d.name, 'config.ts')))
    .map((d) => d.name)
    .sort();
};

const describe = (s, id) => {
  const dir = path.join(STUDIOS_DIR, s.dir, id);
  return {studio: s, key: s.key, dir, studioDir: path.join(STUDIOS_DIR, s.dir), entry: path.join(STUDIOS_DIR, s.dir, 'index.ts'), game: s.game, configPath: path.join(dir, 'config.ts')};
};

// Ролик по id: ищет src/studios/*/<id>/config.ts → {studio (запись реестра), key, dir (папка ролика), studioDir, entry, game, configPath}
export const findVideo = (id) => {
  if (!id || id.startsWith('-')) throw new Error(`Нужен id ролика (папка в src/studios/<студия>/), получено «${id ?? ''}»`);
  const hits = STUDIOS.filter((s) => fs.existsSync(path.join(STUDIOS_DIR, s.dir, id, 'config.ts')));
  if (hits.length > 1) throw new Error(`Ролик «${id}» есть в нескольких студиях: ${hits.map((s) => s.dir).join(', ')} — id должен быть уникальным`);
  if (!hits.length) {
    const near = STUDIOS.flatMap((s) => videosOf(s.key)).filter((v) => v.includes(id) || id.includes(v));
    throw new Error(`Нет ролика «${id}»: не нашёл src/studios/<студия>/${id}/config.ts${near.length ? ` (похожие: ${near.join(', ')})` : ''}`);
  }
  return describe(hits[0], id);
};

// Папка ролика, даже если config.ts ещё нет (fetch-article, deck-posters, meta-stats до заготовки yt-new):
// существующая папка src/studios/*/<id>, иначе — в студии по префиксу id (fallback — ключ студии по умолчанию)
export const videoDir = (id, fallback) => {
  if (!id || id.startsWith('-') || /[\\/]/.test(id)) throw new Error(`Нужен id ролика (имя папки), получено «${id ?? ''}»`);
  const hits = STUDIOS.filter((s) => fs.existsSync(path.join(STUDIOS_DIR, s.dir, id)));
  if (hits.length > 1) throw new Error(`Папка «${id}» есть в нескольких студиях: ${hits.map((s) => s.dir).join(', ')}`);
  return path.join(STUDIOS_DIR, (hits[0] ?? studioOf(id, fallback)).dir, id);
};

// Студия композиции по её id (у композиции может не быть папки: yt-template-demo, *-thumb, витрины):
// сначала папка ролика с config.ts, затем самый длинный idPrefix из реестра, иначе fallback (ключ) или ошибка
export const studioOf = (id, fallback) => {
  const own = STUDIOS.filter((s) => fs.existsSync(path.join(STUDIOS_DIR, s.dir, id, 'config.ts')));
  if (own.length === 1) return own[0];
  const byPrefix = STUDIOS.filter((s) => s.idPrefix && id.startsWith(s.idPrefix)).sort((a, b) => b.idPrefix.length - a.idPrefix.length);
  if (byPrefix.length) return byPrefix[0];
  if (fallback) return studio(fallback);
  throw new Error(`Не понял, из какой студии композиция «${id}»: нет папки с config.ts и префикса из studios.json — укажи студию явно (${keys()})`);
};
