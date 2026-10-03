// Слепок данных YouTube-композиций — проверка «рефакторинг ничего не изменил» без рендера:
//   node scripts/yt-snap.mjs <файл-префикс> [id…]          (по умолчанию все композиции yt-* из студии youtube)
// Пишет <префикс>-<id>.json — канонический JSON props (config + timing), длины и fps — и печатает их sha1.
// Снять до правки и после: хэши совпали — данные ролика те же; нет — diff двух json покажет, что поменялось.
import crypto from 'node:crypto';
import fs from 'node:fs';
import {bundle} from '@remotion/bundler';
import {getCompositions, selectComposition} from '@remotion/renderer';
import {entryPoint} from './studios.mjs';

process.on('unhandledRejection', () => {}); // шрифты шаблона в Node не грузятся — для данных они не нужны
const [prefix, ...ids] = process.argv.slice(2);
if (!prefix) throw new Error('node scripts/yt-snap.mjs <файл-префикс> [id…]');
const browserExecutable = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const serveUrl = await bundle({entryPoint: entryPoint('youtube')});
const list = ids.length ? ids : (await getCompositions(serveUrl, {browserExecutable})).map((c) => c.id).filter((id) => /^yt-/.test(id) && !/-thumb$|calib|showcase/.test(id));
// ключи по алфавиту, без undefined — порядок полей в конфиге не влияет на хэш
const canon = (v) => (Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => [k, canon(v[k])])) : v);
const out = {};
for (const id of list) {
  const c = await selectComposition({serveUrl, id, browserExecutable});
  const s = JSON.stringify(canon({props: c.props, dur: c.durationInFrames, fps: c.fps}), null, 1);
  fs.writeFileSync(`${prefix}-${id}.json`, s);
  out[id] = crypto.createHash('sha1').update(s).digest('hex');
}
console.log(JSON.stringify(out, null, 1));
