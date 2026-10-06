// Проверка закреплённых роликов (src/studios/frozen.json): рендерит контрольные кадры и сравнивает с эталоном
// в src/studios/<студия>/<ролик>/ref. Запускать после любых правок в src/hearthpulse — готовые ролики не должны меняться.
//   node scripts/check-ads.mjs                    — сверить все ролики
//   node scripts/check-ads.mjs launch30           — только один
//   node scripts/check-ads.mjs --update <ролик>   — переснять эталон (только если ролик меняли намеренно)
// Расхождения кладутся в out/check/<композиция>/diff-*.jpg: слева эталон, справа сейчас.
import {openBrowser, renderStill, selectComposition} from '@remotion/renderer';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {VIDEO} from './lib/paths.mjs';
import {bundleStudio, CHROME} from './lib/remotion.mjs';
import {studioDir} from './lib/studios.mjs';

process.chdir(VIDEO);

const MIN_PSNR = 40; // дБ; одинаковый кадр даёт inf, заметная правка — меньше 35

const args = process.argv.slice(2);
const update = args.includes('--update');
const only = args.filter((a) => !a.startsWith('--'));
const ads = JSON.parse(fs.readFileSync('src/studios/frozen.json', 'utf8')).filter((a) => !only.length || only.includes(a.ad));
if (!ads.length) throw new Error(`Нет таких роликов в src/studios/frozen.json: ${only.join(', ')}`);
if (update && !only.length) throw new Error('--update переснимает эталон: укажи ролик явно, например --update launch30');

const psnr = (a, b) => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', a, '-i', b, '-lavfi', 'psnr', '-f', 'null', '-'], {encoding: 'utf8'});
  const m = /average:(inf|[\d.]+)/.exec(r.stderr);
  return !m ? 0 : m[1] === 'inf' ? Infinity : Number(m[1]);
};

const browserExecutable = CHROME;
const bundles = {}; // по сборке на студию
const browser = await openBrowser('chrome', {browserExecutable});
const problems = [];

for (const ad of ads) {
  const serveUrl = (bundles[ad.studio] ??= await bundleStudio(ad.studio));
  const refDir = path.join(studioDir(ad.studio), ad.ad, 'ref');
  const metaPath = path.join(refDir, 'meta.json');
  const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : {};
  for (const id of ad.comps) {
    const composition = await selectComposition({serveUrl, id, browserExecutable, puppeteerInstance: browser});
    const dur = composition.durationInFrames;
    const frames = [];
    for (let f = ad.offset; f < dur; f += ad.step) frames.push(f);
    frames.push(dur - 1);

    const refComp = path.join(refDir, id);
    const outComp = path.resolve('out/check', id);
    fs.rmSync(update ? refComp : outComp, {recursive: true, force: true});
    fs.mkdirSync(update ? refComp : outComp, {recursive: true});
    if (update) {
      meta[id] = {durationInFrames: dur, width: composition.width, height: composition.height, frames};
    } else if (meta[id] && meta[id].durationInFrames !== dur) {
      problems.push(`${id}: длина ${dur} кадров, в эталоне ${meta[id].durationInFrames}`);
    }

    let bad = 0;
    for (const frame of frames) {
      const name = `f${String(frame).padStart(4, '0')}.jpg`;
      const output = path.join(update ? refComp : outComp, name);
      await renderStill({serveUrl, composition, frame, output, imageFormat: 'jpeg', jpegQuality: 80, scale: 0.5, browserExecutable, puppeteerInstance: browser});
      if (update) continue;
      const ref = path.join(refComp, name);
      if (!fs.existsSync(ref)) {
        problems.push(`${id} кадр ${frame}: нет эталона`);
        bad++;
        continue;
      }
      const db = psnr(ref, output);
      if (db < MIN_PSNR) {
        bad++;
        problems.push(`${id} кадр ${frame}: отличается от эталона (PSNR ${db.toFixed(1)} дБ)`);
        spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', ref, '-i', output, '-filter_complex', 'hstack', path.join(outComp, `diff-${name}`)]);
      }
    }
    console.log(`${update ? 'эталон' : bad ? 'ОТЛИЧИЯ' : 'ок'}  ${id}  (${frames.length} кадров${bad ? `, отличаются ${bad}` : ''})`);
  }
  if (update) fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
}

await browser.close({silent: true}).catch(() => {});
if (problems.length) {
  console.log('\n' + problems.join('\n'));
  console.log('\nЕсли изменение не задумано — чини src/hearthpulse (новое поведение только через опции со старым по умолчанию).');
  process.exit(1);
}
console.log(update ? '\nЭталон записан.' : '\nЗакреплённые ролики не изменились.');
