// Нарезка своих записей Hearthstone (OBS). Записи лежат в video/recordings/ (в git не идут; настройка OBS — README там же).
// Во время игры сразу ПОСЛЕ удачного момента (летал, большой розыгрыш, комбо) нажать горячую клавишу «Добавить метку
// главы» — метка попадает в запись, скрипт вырежет клип вокруг неё.
//   node scripts/rec.mjs [--before 12] [--after 3] [--all]
//        новые записи → клипы recordings/clips/<запись>-m<n>.mp4 (1080p, со звуком игры): вокруг каждой метки
//        [−before, +after] с; запись без меток — самые активные моменты (до 8, не ближе 30 с друг к другу; кандидаты).
//        Обзор — recordings/clips/index.md: у каждого клипа полоска из 4 кадров. --all — переделать и старые записи
//   node scripts/rec.mjs take <клип> --name <имя> [--trim 2-9] [--deck "<колода>"] [--context "<что в кадре>"]
//        клип в ролик: public/clips/<имя>.mp4 + паспорт (своя запись, дата записи, колода) через eyes.mjs cut --own;
//        --trim — только часть клипа (секунды от его начала). Во врезке: {kind: 'clip', src: 'clips/<имя>.mp4', start: 0, credit: …}
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {mmss, slug as slugOf} from './lib/text.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const REC = path.resolve('recordings');
const CLIPS = path.join(REC, 'clips');
const INDEX = path.join(CLIPS, 'index.json');
const VIDEO = /\.(mp4|mkv|mov)$/i;
const run = (bin, a) => {
  const r = spawnSync(bin, a, {encoding: 'utf8', maxBuffer: 1 << 28});
  if (r.status) throw new Error(`${bin}: ${(r.stderr || r.stdout || '').slice(-500)}`);
  return r;
};
const slug = (s) => slugOf(s, {ext: true}); // имя записи без расширения → начало имени клипа
const index = () => (fs.existsSync(INDEX) ? JSON.parse(fs.readFileSync(INDEX, 'utf8')) : []);

if (args[0] === 'take') {
  const name = opt('name');
  const clip = index().find((c) => c.clip === args[1] || c.clip === path.basename(args[1] ?? '', '.mp4'));
  if (!clip || !name) {
    console.error('✗ node scripts/rec.mjs take <клип из recordings/clips/index.md> --name <имя> [--trim 2-9] [--deck "<колода>"] [--context "<что в кадре>"]');
    process.exit(1);
  }
  const [a, b] = (opt('trim') ?? `0-${clip.to - clip.from}`).split('-').map(Number);
  const pass = ['deck', 'context'].flatMap((k) => (opt(k) ? [`--${k}`, opt(k)] : [])); // в паспорт: какая колода, что в кадре
  const r = spawnSync('node', ['scripts/eyes.mjs', 'cut', path.join(REC, clip.rec), '--from', String(clip.from + a), '--to', String(clip.from + b), '--name', name, '--own', ...pass], {stdio: 'inherit'});
  process.exit(r.status ?? 1);
}

fs.mkdirSync(CLIPS, {recursive: true});
const before = Number(opt('before', 12));
const after = Number(opt('after', 3));
const old = args.includes('--all') ? [] : index();
const recs = fs.existsSync(REC) ? fs.readdirSync(REC).filter((f) => VIDEO.test(f) && fs.statSync(path.join(REC, f)).isFile()) : [];
const fresh = recs.filter((f) => !old.some((c) => c.rec === f && c.mtime === fs.statSync(path.join(REC, f)).mtimeMs));
if (!fresh.length) console.log(recs.length ? 'новых записей нет (--all — переделать)' : `записей нет: положите их в ${REC}`);

const out = old.filter((c) => recs.includes(c.rec) && !fresh.includes(c.rec));
for (const f of fresh) {
  const file = path.join(REC, f);
  const mtime = fs.statSync(file).mtimeMs;
  const dur = Number(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).stdout);
  // метки глав OBS (гибридный MP4); глава с нуля — начало записи, не метка
  const marks = JSON.parse(run('ffprobe', ['-v', 'error', '-show_chapters', '-of', 'json', file]).stdout).chapters?.map((c) => Number(c.start_time)).filter((t) => t > 2) ?? [];
  let spans;
  if (marks.length) spans = marks.map((t, i) => ({n: `m${i + 1}`, from: Math.max(0, t - before), to: Math.min(dur, t + after), why: `метка ${mmss(t)}`}));
  else {
    // без меток: активность по секундам (разница соседних кадров), пики не ближе 30 с — кандидаты
    console.log(`${f}: меток нет — ищу самые активные моменты (${mmss(dur)})…`);
    const log = run('ffmpeg', ['-v', 'error', '-hwaccel', 'auto', '-i', file, '-an', '-vf', 'fps=5,scale=320:-2,tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-', '-f', 'null', '-']).stdout;
    const per = new Map();
    let t = 0;
    for (const line of log.split('\n')) {
      const pt = line.match(/pts_time:([\d.]+)/);
      if (pt) t = +pt[1];
      const y = line.match(/YAVG=([\d.]+)/);
      if (y) per.set(Math.floor(t), (per.get(Math.floor(t)) ?? 0) + +y[1]);
    }
    const peaks = [];
    for (const [s] of [...per.entries()].sort((x, y) => y[1] - x[1])) {
      if (peaks.length >= 8) break;
      if (s > before && peaks.every((p) => Math.abs(p - s) >= 30)) peaks.push(s);
    }
    spans = peaks.sort((x, y) => x - y).map((s, i) => ({n: `a${i + 1}`, from: Math.max(0, s - 8), to: Math.min(dur, s + 3), why: `активность ${mmss(s)}`}));
  }
  for (const s of spans) {
    const clip = `${slug(f)}-${s.n}`;
    const dst = path.join(CLIPS, `${clip}.mp4`);
    run('ffmpeg', ['-v', 'error', '-y', '-ss', s.from.toFixed(2), '-t', (s.to - s.from).toFixed(2), '-i', file, '-vf', 'scale=-2:1080:flags=lanczos', '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', dst]);
    const len = s.to - s.from;
    const pts = [0.1, 0.4, 0.7, 0.95].map((k) => (len * k).toFixed(2));
    run('ffmpeg', ['-v', 'error', '-y', ...pts.flatMap((p) => ['-ss', p, '-i', dst]), '-filter_complex', `${pts.map((_, k) => `[${k}]scale=360:-2,setsar=1[v${k}]`).join(';')};${pts.map((_, k) => `[v${k}]`).join('')}hstack=inputs=4`, '-frames:v', '1', dst.replace(/\.mp4$/, '.jpg')]);
    out.push({clip, rec: f, mtime, from: +s.from.toFixed(2), to: +s.to.toFixed(2), why: s.why});
    console.log(`${clip}.mp4  ${mmss(s.from)}–${mmss(s.to)}  (${s.why})`);
  }
}

fs.writeFileSync(INDEX, JSON.stringify(out, null, 1) + '\n');
const md = [
  '# Клипы из записей',
  '',
  'Взять в ролик: `node scripts/rec.mjs take <клип> --name <имя> [--trim 2-9]`. Кадры — 10 %, 40 %, 70 %, 95 % клипа.',
  '',
  ...out.flatMap((c) => [`## ${c.clip}`, `${c.rec} · ${mmss(c.from)}–${mmss(c.to)} · ${c.why}`, '', `![](${c.clip}.jpg)`, '']),
];
fs.writeFileSync(path.join(CLIPS, 'index.md'), md.join('\n'));
console.log(`→ ${path.relative(process.cwd(), path.join(CLIPS, 'index.md'))} (${out.length} клипов)`);
