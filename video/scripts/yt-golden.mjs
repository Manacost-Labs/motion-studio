// Эталонные кадры шаблона: после правки видно, что изменилось в картинке, без просмотра всего ролика.
//   node scripts/yt-golden.mjs <id> --approve [сцена…] [--at 0.5]  — снять эталон с одобренного состояния → qa/golden/<id>/
//   node scripts/yt-golden.mjs <id> [сцена…]                        — отрендерить те же кадры и сравнить с эталоном (SSIM)
//   --dir <папка> — другой набор эталонов вместо qa/golden: кадры стыков сцен снимаются в отдельную папку
//   (для qa/golden-joints --at по умолчанию 0.03,0.97 — частичное --approve переснимает стыки в тех же долях)
//   node scripts/yt-golden.mjs <id> --at 0.03,0.97 --dir qa/golden-joints --approve   (проверка — с тем же --dir)
// --approve со сценами переснимает только их кадры, эталоны остальных сцен остаются; без сцен — весь эталон заново.
// Кадр изменился, если заметно (> 32 из 255) отличается больше 0,02 % пикселей: рендер детерминирован, одинаковые кадры
// совпадают байт в байт, поэтому ловится даже смена одного слова (SSIM по всему кадру такое пропускает — печатается для справки).
// Изменившийся кадр: out/<id>/golden/diff-<кадр>.jpg = эталон | новый | разница (яркое — изменилось); для --dir — out/<id>/<имя папки>/.
// Код выхода 1, если что-то изменилось. Изменение задумано и одобрено — переснять эталон (--approve) и закоммитить.
import fs from 'node:fs';
import path from 'node:path';
import {renderStill} from '@remotion/renderer';
import {ff} from './lib/media.mjs';
import {VIDEO} from './lib/paths.mjs';
import {CHROME, openComposition, quietFonts} from './lib/remotion.mjs';

process.chdir(VIDEO);
quietFonts();
const args = process.argv.slice(2);
const id = args[0];
if (!id || id.startsWith('--')) throw new Error('node scripts/yt-golden.mjs <id> [сцена…] [--approve] [--at 0.5] [--dir qa/golden]');
const approve = args.includes('--approve');
const opt = (n) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : undefined);
const optVals = new Set(['at', 'dir'].map(opt).filter(Boolean));
const pats = args.slice(1).filter((a) => !a.startsWith('--') && !optVals.has(a)).map((a) => new RegExp(a));
const set = opt('dir') ?? path.join('qa', 'golden');
// набор стыков снят на 0.03,0.97 — без --at переснимаем его в тех же долях, а не в середине сцены
const at = (opt('at') ?? (path.basename(set) === 'golden-joints' ? '0.03,0.97' : '0.5')).split(',').map(Number);
const goldDir = path.resolve(set, id);
const outDir = path.resolve('out', id, path.basename(set));
const PIXELS = 0.0002; // доля заметно изменившихся пикселей
const segOf = (f) => f.replace(/_f\d+\.jpg$/, '');
const picked = (seg) => !pats.length || pats.some((p) => p.test(seg));

const {serveUrl, composition} = await openComposition(id, {logLevel: 'error'});
const {timing} = /** @type {any} */ (composition.props); // props YouTube-композиции: {config, timing}
const K = composition.fps / (timing.base ?? 30);
const shot = (file, frame) => renderStill({serveUrl, composition, frame, output: file, imageFormat: 'jpeg', jpegQuality: 92, scale: 0.5, browserExecutable: CHROME, logLevel: 'error'});

if (approve) {
  fs.mkdirSync(goldDir, {recursive: true});
  // со сценами — удаляются только их кадры; без сцен — эталон снимается целиком заново
  for (const f of fs.readdirSync(goldDir)) if (picked(segOf(f))) fs.rmSync(path.join(goldDir, f));
  let n = 0;
  for (const t of timing.segments.filter((s) => picked(s.id)))
    for (const q of at) {
      const frame = Math.round((t.from + q * t.dur) * K);
      await shot(path.join(goldDir, `${t.id}_f${frame}.jpg`), frame); // номер кадра в имени — проверка рендерит ровно его
      n++;
    }
  console.log(`эталон: ${n} кадров → ${path.relative(process.cwd(), goldDir)}${pats.length ? ` (только сцены ${pats.map((p) => p.source).join(', ')}; остальные не тронуты)` : ''}`);
  process.exit(process.exitCode ?? 0);
}

if (!fs.existsSync(goldDir)) throw new Error(`нет эталона ${path.relative(process.cwd(), goldDir)} — сначала --approve`);
fs.mkdirSync(outDir, {recursive: true});
const changed = [];
const files = fs.readdirSync(goldDir).filter((f) => f.endsWith('.jpg') && picked(segOf(f)));
for (const f of files) {
  const frame = Number(f.match(/_f(\d+)\.jpg$/)[1]);
  const now = path.join(outDir, f);
  if (frame >= composition.durationInFrames) {
    changed.push({f, ssim: 0, note: 'кадра больше нет — ролик стал короче'});
    continue;
  }
  await shot(now, frame);
  const log = ff(['-hide_banner', '-i', path.join(goldDir, f), '-i', now, '-lavfi', 'ssim', '-f', 'null', '-']).stderr;
  const ssim = Number(log.match(/All:([\d.]+)/)?.[1] ?? 0);
  const px = ff(['-hide_banner', '-i', path.join(goldDir, f), '-i', now, '-filter_complex', "[0][1]blend=all_mode=difference,format=gray,lut=y='if(gte(val,32),255,0)',signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-", '-f', 'null', '-']).stdout;
  const yavg = px.match(/YAVG=([\d.]+)/)?.[1];
  if (yavg === undefined) throw new Error(`ffmpeg не дал разницу кадров для ${f}`);
  const share = Number(yavg) / 255;
  if (share > PIXELS) {
    ff(['-v', 'error', '-y', '-i', path.join(goldDir, f), '-i', now, '-filter_complex', "[0]format=rgb24,split[a][a2];[1]format=rgb24,split[b][b2];[a][b]blend=all_mode=difference,curves=all='0/0 0.06/1 1/1'[d];[a2][b2][d]hstack=inputs=3", path.join(outDir, `diff-${f}`)]);
    changed.push({f, ssim, share});
  }
}
const rel = path.relative(VIDEO, outDir).replace(/\\/g, '/');
console.log(`кадров сравнено: ${files.length} · изменилось: ${changed.length}`);
for (const c of changed) console.log(`  ${c.f}: изменилось ${((c.share ?? 1) * 100).toFixed(2)} % пикселей (SSIM ${c.ssim.toFixed(4)})${c.note ? ` — ${c.note}` : ` → ${rel}/diff-${c.f}`}`);
process.exit(changed.length ? 1 : (process.exitCode ?? 0));
