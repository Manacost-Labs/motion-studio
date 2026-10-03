// Раскадровка YouTube-ролика: кадры каждой сцены по долям её длительности (или по кадрам сцены) и листы для просмотра
// глазами — так видны пустые зоны, наложения и переносы во всём ролике сразу, без полного рендера.
//   node scripts/yt-board.mjs <id> [сцена…] [--at 0.1,0.32,0.55,0.78,0.96] [--frames 74,100] [--scale 0.25]
//   сцена — регулярное выражение по id сегмента (deck, ^deck-0[13]$, hook); без них — все сцены.
//   --at — доли длительности сцены; --frames — кадры от начала сцены в «кадрах-30» (fps.ts), вместо --at.
// Пишет out/<id>/board/<сцена>_<доля|кадр>.jpg и листы sheet-<n>.jpg (кадры сцены в ряд, по 4 сцены на лист).
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import {entryPoint} from './studios.mjs';

process.on('unhandledRejection', () => {}); // шрифты шаблона в Node не грузятся — для кадров они грузятся в браузере

const args = process.argv.slice(2);
const id = args[0];
if (!id || id.startsWith('--')) throw new Error('node scripts/yt-board.mjs <id> [сцена…] [--at доли | --frames кадры] [--scale 0.25]');
const opt = (n) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : undefined);
const optVals = new Set(['at', 'frames', 'scale'].map(opt).filter(Boolean));
const pats = args.slice(1).filter((a) => !a.startsWith('--') && !optVals.has(a)).map((a) => new RegExp(a));
const frames = opt('frames')?.split(',').map(Number);
const at = (opt('at') ?? '0.1,0.32,0.55,0.78,0.96').split(',').map(Number);
const scale = Number(opt('scale') ?? 0.25);
const out = path.resolve('out', id, 'board');
fs.mkdirSync(out, {recursive: true});

const browserExecutable = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const serveUrl = await bundle({entryPoint: entryPoint('youtube')});
const composition = await selectComposition({serveUrl, id, browserExecutable});
const {timing} = composition.props;
const K = composition.fps / (timing.base ?? 30);
const segs = timing.segments.filter((t) => !pats.length || pats.some((p) => p.test(t.id)));

const rows = [];
for (const t of segs) {
  const row = [];
  for (const q of frames ?? at) {
    const frame = Math.min(composition.durationInFrames - 1, Math.round((t.from + (frames ? q : q * t.dur)) * K));
    const file = path.join(out, `${t.id}_${q}.jpg`);
    await renderStill({serveUrl, composition, frame, output: file, imageFormat: 'jpeg', jpegQuality: 82, scale, browserExecutable});
    row.push(file);
  }
  rows.push(row);
  console.log(`${t.id.padEnd(10)} ${(t.from / 30).toFixed(1).padStart(6)} с  +${(t.dur / 30).toFixed(1)} с`);
}

// листы: по 4 сцены, кадры сцены — в ряд
const w = Math.round(1920 * scale);
const h = Math.round(1080 * scale);
for (let s = 0; s * 4 < rows.length; s++) {
  const part = rows.slice(s * 4, s * 4 + 4);
  const files = part.flat();
  const layout = part.flatMap((row, r) => row.map((_, c) => `${c * w}_${r * h}`)).join('|');
  const sheet = path.join(out, `sheet-${s + 1}.jpg`);
  const ff = files.length > 1 ? ['-filter_complex', `${files.map((_, i) => `[${i}]`).join('')}xstack=inputs=${files.length}:layout=${layout}:fill=black`] : [];
  spawnSync('ffmpeg', ['-v', 'error', '-y', ...files.flatMap((f) => ['-i', f]), ...ff, sheet]);
  console.log(`→ ${path.relative(process.cwd(), sheet)}`);
}
