// Эталонные кадры шаблона: после правки видно, что изменилось в картинке, без просмотра всего ролика.
//   node scripts/yt-golden.mjs <id> --approve [сцена…] [--at 0.5]  — снять эталон с одобренного состояния → qa/golden/<id>/
//   node scripts/yt-golden.mjs <id>                                 — отрендерить те же кадры и сравнить с эталоном (SSIM)
// Кадр изменился, если заметно (> 32 из 255) отличается больше 0,02 % пикселей: рендер детерминирован, одинаковые кадры
// совпадают байт в байт, поэтому ловится даже смена одного слова (SSIM по всему кадру такое пропускает — печатается для справки).
// Изменившийся кадр: out/<id>/golden/diff-<кадр>.jpg = эталон | новый | разница (яркое — изменилось).
// Код выхода 1, если что-то изменилось. Изменение задумано и одобрено — переснять эталон (--approve) и закоммитить.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import {entryPoint} from './studios.mjs';

process.on('unhandledRejection', () => {});
const args = process.argv.slice(2);
const id = args[0];
if (!id || id.startsWith('--')) throw new Error('node scripts/yt-golden.mjs <id> [--approve [сцена…] [--at 0.5]]');
const approve = args.includes('--approve');
const opt = (n) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : undefined);
const pats = args.slice(1).filter((a) => !a.startsWith('--') && a !== opt('at')).map((a) => new RegExp(a));
const at = (opt('at') ?? '0.5').split(',').map(Number);
const goldDir = path.resolve('qa', 'golden', id);
const outDir = path.resolve('out', id, 'golden');
const PIXELS = 0.0002; // доля заметно изменившихся пикселей

const browserExecutable = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const serveUrl = await bundle({entryPoint: entryPoint('youtube')});
const composition = await selectComposition({serveUrl, id, browserExecutable, logLevel: 'error'});
const {timing} = composition.props;
const K = composition.fps / (timing.base ?? 30);
const shot = (file, frame) => renderStill({serveUrl, composition, frame, output: file, imageFormat: 'jpeg', jpegQuality: 92, scale: 0.5, browserExecutable, logLevel: 'error'});

if (approve) {
  fs.mkdirSync(goldDir, {recursive: true});
  for (const f of fs.readdirSync(goldDir)) fs.rmSync(path.join(goldDir, f)); // эталон снимается целиком заново
  let n = 0;
  for (const t of timing.segments.filter((s) => !pats.length || pats.some((p) => p.test(s.id))))
    for (const q of at) {
      const frame = Math.round((t.from + q * t.dur) * K);
      await shot(path.join(goldDir, `${t.id}_f${frame}.jpg`), frame); // номер кадра в имени — проверка рендерит ровно его
      n++;
    }
  console.log(`эталон: ${n} кадров → ${path.relative(process.cwd(), goldDir)}`);
  process.exit(0);
}

if (!fs.existsSync(goldDir)) throw new Error(`нет эталона qa/golden/${id} — сначала --approve`);
fs.mkdirSync(outDir, {recursive: true});
const changed = [];
const files = fs.readdirSync(goldDir).filter((f) => f.endsWith('.jpg'));
for (const f of files) {
  const frame = Number(f.match(/_f(\d+)\.jpg$/)[1]);
  const now = path.join(outDir, f);
  if (frame >= composition.durationInFrames) {
    changed.push({f, ssim: 0, note: 'кадра больше нет — ролик стал короче'});
    continue;
  }
  await shot(now, frame);
  const log = spawnSync('ffmpeg', ['-hide_banner', '-i', path.join(goldDir, f), '-i', now, '-lavfi', 'ssim', '-f', 'null', '-'], {encoding: 'utf8'}).stderr;
  const ssim = Number(log.match(/All:([\d.]+)/)?.[1] ?? 0);
  const px = spawnSync('ffmpeg', ['-hide_banner', '-i', path.join(goldDir, f), '-i', now, '-filter_complex', "[0][1]blend=all_mode=difference,format=gray,lut=y='if(gte(val,32),255,0)',signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-", '-f', 'null', '-'], {encoding: 'utf8'}).stdout;
  const share = Number(px.match(/YAVG=([\d.]+)/)?.[1] ?? 0) / 255;
  if (share > PIXELS) {
    spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(goldDir, f), '-i', now, '-filter_complex', "[0]format=rgb24,split[a][a2];[1]format=rgb24,split[b][b2];[a][b]blend=all_mode=difference,curves=all='0/0 0.06/1 1/1'[d];[a2][b2][d]hstack=inputs=3", path.join(outDir, `diff-${f}`)]);
    changed.push({f, ssim, share});
  }
}
console.log(`кадров сравнено: ${files.length} · изменилось: ${changed.length}`);
for (const c of changed) console.log(`  ${c.f}: изменилось ${((c.share ?? 1) * 100).toFixed(2)} % пикселей (SSIM ${c.ssim.toFixed(4)})${c.note ? ` — ${c.note}` : ` → out/${id}/golden/diff-${c.f}`}`);
process.exit(changed.length ? 1 : 0);
