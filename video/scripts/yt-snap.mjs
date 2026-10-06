// Слепок данных YouTube-композиций — проверка «рефакторинг ничего не изменил» без рендера:
//   node scripts/yt-snap.mjs <файл-префикс> [id…]   (по умолчанию все композиции роликов YouTube-студий из src/studios/studios.json:
//   id с префиксом студии, без обложек (в т. ч. вариантов *-thumb-b), калибровок и витрин)
// Пишет <префикс>-<id>.json — канонический JSON props (config + timing), длины и fps — и печатает их sha1.
// Снять до правки и после: хэши совпали — данные ролика те же; нет — diff двух json покажет, что поменялось.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {getCompositions, selectComposition} from '@remotion/renderer';
import {userPath, VIDEO} from './lib/paths.mjs';
import {bundleStudio, CHROME, quietFonts} from './lib/remotion.mjs';
import {studioOf, youtubeStudios} from './lib/studios.mjs';

const [prefixArg, ...ids] = process.argv.slice(2);
if (!prefixArg) throw new Error('node scripts/yt-snap.mjs <файл-префикс> [id…]');
const prefix = userPath(prefixArg); // от папки запуска, до chdir
process.chdir(VIDEO);
quietFonts(); // шрифты шаблона в Node не грузятся — для данных они не нужны

// студия → её id: заданные явно — по реестру (папка ролика или префикс), иначе все YouTube-студии
const groups = new Map();
for (const id of ids) {
  const s = studioOf(id);
  groups.set(s, [...(groups.get(s) ?? []), id]);
}
if (!ids.length) for (const s of youtubeStudios()) groups.set(s, null);

// ключи по алфавиту, без undefined — порядок полей в конфиге не влияет на хэш
const canon = (v) => (Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => [k, canon(v[k])])) : v);
const out = {};
fs.mkdirSync(path.dirname(prefix), {recursive: true});
for (const [s, only] of groups) {
  const serveUrl = await bundleStudio(s.key);
  const list = only ?? (await getCompositions(serveUrl, {browserExecutable: CHROME})).map((c) => c.id).filter((id) => s.idPrefix && id.startsWith(s.idPrefix) && !/-thumb(-[a-z0-9]+)?$|calib|showcase/.test(id));
  for (const id of list) {
    const c = await selectComposition({serveUrl, id, browserExecutable: CHROME});
    const json = JSON.stringify(canon({props: c.props, dur: c.durationInFrames, fps: c.fps}), null, 1);
    fs.writeFileSync(`${prefix}-${id}.json`, json);
    out[id] = crypto.createHash('sha1').update(json).digest('hex');
  }
}
console.log(JSON.stringify(out, null, 1));
