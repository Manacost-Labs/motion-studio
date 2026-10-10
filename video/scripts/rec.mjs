// Нарезка своих записей Hearthstone (OBS). Записи лежат в video/recordings/ (в git не идут; настройка OBS — README там же).
// Во время игры сразу ПОСЛЕ удачного момента (летал, большой розыгрыш, комбо) нажать горячую клавишу «Добавить метку
// главы» — метка попадает в запись, скрипт вырежет клип вокруг неё.
//   node scripts/rec.mjs [--before 12] [--after 3] [--all]
//        новые записи → клипы recordings/clips/<запись>-m<n>.mp4 (1080p, со звуком игры): вокруг каждой метки
//        [−before, +after] с; запись без меток — самые активные моменты (до 8, не ближе 30 с друг к другу; кандидаты).
//        Обзор — recordings/clips/index.md: у каждого клипа полоска из 4 кадров. --all — переделать и старые записи
//   node scripts/rec.mjs take <клип> --name <имя> [--trim 2-9] [--tight] [--deck "<колода>"] [--context "<что в кадре>"]
//        клип в ролик: public/clips/<имя>.mp4 + паспорт (своя запись, дата записи, колода) через eyes.mjs cut --own;
//        --trim — только часть клипа (секунды от его начала). Во врезке: {kind: 'clip', src: 'clips/<имя>.mp4', start: 0, credit: …}
//        --tight — срезать простой в начале и конце (по движению, как idle; флаги idle тоже действуют)
//   node scripts/rec.mjs idle <запись | клип> [--threshold 0.08] [--min-idle 3] [--margin 1]
//        где простой — ход соперника, ожидание, муллиган — по движению в кадре (auto-editor; музыка игры звучит всегда,
//        по тишине не найти). Отчёт recordings/clips/<имя>.idle.md (+ .json): активное и простой (м:сс), итоги, метки
//        глав в простое и клип вокруг метки плотнее. Ничего не режет и не удаляет — только подсказки
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
const before = Number(opt('before', 12));
const after = Number(opt('after', 3));
// метки глав OBS (гибридный MP4); глава с нуля — начало записи, не метка
const chapters = (file) => JSON.parse(run('ffprobe', ['-v', 'error', '-show_chapters', '-of', 'json', file]).stdout).chapters?.map((c) => Number(c.start_time)).filter((t) => t > 2) ?? [];

// Простой по движению: auto-editor levels --edit motion (бинарник в tools/auto-editor, версия — в doctor.mjs) — доля
// пикселей, изменившихся с прошлого кадра (кадр 400 px, серый, размытый), 30 значений в секунду. Окно 0,5 с — медиана:
// одиночный всплеск (ключевой кадр, рывок курсора) окно не будит. Порог 0.08 подобран 10.10.2026 на геймплее
// Hearthstone (recordings/README.md): ниже — стол стоит (ход соперника, муллиган, соперник выбирает карту), выше —
// розыгрыш, атака, баннер хода. Короткое наведение на карту — до ~0.075, остаётся простоем
const AE_LOCAL = path.resolve('tools', 'auto-editor', 'auto-editor.exe');
const AE = fs.existsSync(AE_LOCAL) ? AE_LOCAL : 'auto-editor';
const TB = 30;
const WIN = 0.5;
const idleOpts = () => {
  const o = {threshold: Number(opt('threshold', 0.08)), minIdle: Number(opt('min-idle', 3)), margin: Number(opt('margin', 1))};
  if (!Object.values(o).every((x) => Number.isFinite(x) && x >= 0)) throw new Error('--threshold, --min-idle, --margin — числа ≥ 0');
  return o;
};
const motion = (file) => {
  const r = spawnSync(AE, ['levels', file, '--edit', 'motion', '--timebase', String(TB)], {encoding: 'utf8', maxBuffer: 1 << 28});
  if (r.error) throw new Error(`нет auto-editor (${AE}) — как поставить: recordings/README.md, проверка: node scripts/doctor.mjs`);
  const v = r.stdout.split(/\r?\n/).filter((l) => /^[\d.]+$/.test(l)).map(Number);
  if (!v.length) throw new Error(`auto-editor: ${(r.stderr || '').slice(-500)}`);
  if (r.status) console.warn('⚠ auto-editor пропустил битые пакеты — там движение не измерено');
  const win = [];
  for (let i = 0; i < v.length; i += TB * WIN) {
    const s = v.slice(i, i + TB * WIN).sort((x, y) => x - y);
    win.push(s[s.length >> 1]);
  }
  return {dur: v.length / TB, win};
};
// Простой — окна ниже порога подряд, минус поле margin с каждой стороны, где рядом активное (медленная анимация карты,
// хвост эффекта остаются в активном), не короче minIdle. spans — все отрезки по порядку: активное между простоями
const idleOf = (file, {threshold, minIdle, margin}) => {
  const {dur, win} = motion(file);
  const quiet = [];
  win.forEach((m, i) => {
    if (m >= threshold) return;
    const last = quiet.at(-1);
    if (last && last.to === i * WIN) last.to = Math.min(dur, (i + 1) * WIN);
    else quiet.push({from: i * WIN, to: Math.min(dur, (i + 1) * WIN)});
  });
  const idle = quiet.map((q) => ({from: q.from > 0 ? q.from + margin : 0, to: q.to < dur ? q.to - margin : dur})).filter((q) => q.to - q.from >= minIdle);
  const spans = [];
  let t = 0;
  for (const q of idle) {
    if (q.from > t) spans.push({kind: 'active', from: t, to: q.from});
    spans.push({kind: 'idle', ...q});
    t = q.to;
  }
  if (t < dur) spans.push({kind: 'active', from: t, to: dur});
  const mean = (a, b) => {
    const s = win.slice(Math.floor(a / WIN), Math.ceil(b / WIN));
    return s.length ? s.reduce((x, y) => x + y, 0) / s.length : 0;
  };
  const sorted = [...win].sort((x, y) => x - y);
  const pct = (p) => +sorted[Math.floor(p * (sorted.length - 1))].toFixed(3);
  return {dur, idle, spans: spans.map((s) => ({...s, from: +s.from.toFixed(2), to: +s.to.toFixed(2), motion: +mean(s.from, s.to).toFixed(3)})), motion: {p10: pct(0.1), p50: pct(0.5), p90: pct(0.9)}};
};
// Плотнее: срезать простой, в который попали начало и конец отрезка [a, b] (поля уже в нём); простой внутри не трогать.
// null — весь отрезок простой
const tighten = (idle, a, b) => {
  const head = idle.find((q) => q.from <= a && q.to > a);
  const tail = idle.find((q) => q.from < b && q.to >= b);
  const from = head ? head.to : a;
  const to = tail ? tail.from : b;
  return to - from >= 1 ? {from, to} : null;
};

if (args[0] === 'take') {
  const name = opt('name');
  const clip = index().find((c) => c.clip === args[1] || c.clip === path.basename(args[1] ?? '', '.mp4'));
  if (!clip || !name) {
    console.error('✗ node scripts/rec.mjs take <клип из recordings/clips/index.md> --name <имя> [--trim 2-9] [--tight] [--deck "<колода>"] [--context "<что в кадре>"]');
    process.exit(1);
  }
  const [a, b] = (opt('trim') ?? `0-${clip.to - clip.from}`).split('-').map(Number);
  let from = clip.from + a;
  let to = clip.from + b;
  if (args.includes('--tight')) {
    // простой ищем в самом клипе (он и есть отрезок записи clip.from…clip.to — быстро); клипа нет — во всей записи
    const own = path.join(CLIPS, `${clip.clip}.mp4`);
    const has = fs.existsSync(own);
    const off = has ? clip.from : 0;
    const t = tighten(idleOf(has ? own : path.join(REC, clip.rec), idleOpts()).idle.map((q) => ({from: q.from + off, to: q.to + off})), from, to);
    if (!t) console.warn('⚠ --tight: весь отрезок — простой, беру как есть');
    else {
      console.log(`--tight: ${mmss(from)}–${mmss(to)} → ${mmss(t.from)}–${mmss(t.to)} (начало +${(t.from - from).toFixed(1)} с, конец −${(to - t.to).toFixed(1)} с)`);
      ({from, to} = t);
    }
  }
  const pass = ['deck', 'context'].flatMap((k) => (opt(k) ? [`--${k}`, opt(k)] : [])); // в паспорт: какая колода, что в кадре
  const r = spawnSync('node', ['scripts/eyes.mjs', 'cut', path.join(REC, clip.rec), '--from', String(+from.toFixed(2)), '--to', String(+to.toFixed(2)), '--name', name, '--own', ...pass], {stdio: 'inherit'});
  process.exit(r.status ?? 1);
}

if (args[0] === 'idle') {
  const want = args[1];
  const file = want && [want, path.join(REC, want), path.join(CLIPS, want), path.join(CLIPS, `${want}.mp4`)].find((f) => fs.existsSync(f) && fs.statSync(f).isFile());
  if (!file) {
    console.error('✗ node scripts/rec.mjs idle <запись (файл или имя в recordings/) | клип> [--threshold 0.08] [--min-idle 3] [--margin 1]');
    process.exit(1);
  }
  const o = idleOpts();
  console.log(`${path.basename(file)}: движение по кадрам (auto-editor)…`);
  const res = idleOf(file, o);
  const total = (k) => res.spans.filter((s) => s.kind === k).reduce((x, s) => x + s.to - s.from, 0);
  const share = (k) => `${mmss(total(k), true)} (${Math.round((total(k) / res.dur) * 100)} %)`;
  // метка нажата ПОСЛЕ момента: клип rec.mjs — [−before, +after] с вокруг неё; сколько в нём простоя и как плотнее
  const marks = chapters(file).map((t) => {
    const clip = {from: Math.max(0, t - before), to: Math.min(res.dur, t + after)};
    const idleSec = res.idle.reduce((x, q) => x + Math.max(0, Math.min(q.to, clip.to) - Math.max(q.from, clip.from)), 0);
    return {t, inIdle: res.idle.some((q) => q.from <= t && t < q.to), clip, clipIdle: +idleSec.toFixed(1), tight: tighten(res.idle, clip.from, clip.to)};
  });
  const base = path.join(CLIPS, `${slug(path.basename(file))}.idle`);
  fs.mkdirSync(CLIPS, {recursive: true});
  const rel = path.relative(process.cwd(), file);
  const json = {file: rel.startsWith('..') ? path.resolve(file) : rel, date: new Date().toISOString().slice(0, 10), params: o, clipSpan: {before, after}, dur: +res.dur.toFixed(2), motion: res.motion};
  fs.writeFileSync(`${base}.json`, JSON.stringify({...json, totals: {active: +total('active').toFixed(1), idle: +total('idle').toFixed(1)}, spans: res.spans, marks}, null, 1) + '\n');
  const span = (s) => `${mmss(s.from)}–${mmss(s.to)}`;
  const nIdle = res.spans.filter((s) => s.kind === 'idle').length;
  const md = [
    `# Простой: ${path.basename(file)}`,
    '',
    `\`node scripts/rec.mjs idle ${/\s/.test(want) ? `"${want}"` : want}\` · порог ${o.threshold}, простой от ${o.minIdle} с, поля ${o.margin} с · движение — auto-editor levels --edit motion.`,
    'Ничего не вырезано — это подсказки, где сократить. Простоя мало или в нём видно действие — порог ниже (`--threshold 0.06`); стоящий стол попал в активное — выше.',
    '',
    `**Итого:** ${mmss(res.dur, true)} · активное ${share('active')} · простой ${share('idle')} — отрезков простоя ${nIdle}.`,
    `Движение (медиана окна 0,5 с): p10 ${res.motion.p10} · p50 ${res.motion.p50} · p90 ${res.motion.p90}.`,
    '',
    ...(marks.length
      ? ['## Метки глав', '', `| метка | где | клип −${before}…+${after} с | простоя в клипе | плотнее (take --tight) |`, '|---|---|---|---|---|', ...marks.map((m) => `| ${mmss(m.t)} | ${m.inIdle ? 'в простое' : 'в активном'} | ${span(m.clip)} | ${m.clipIdle} с | ${m.tight ? (m.tight.from === m.clip.from && m.tight.to === m.clip.to ? '—' : span(m.tight)) : 'весь клип — простой'} |`), '']
      : ['Меток глав нет.', '']),
    '## Отрезки',
    '',
    '| # | что | с | по | длина | движение |',
    '|---|---|---|---|---|---|',
    ...res.spans.map((s, i) => `| ${i + 1} | ${s.kind === 'idle' ? '**простой**' : 'активное'} | ${mmss(s.from)} | ${mmss(s.to)} | ${s.to - s.from < 60 ? `${(s.to - s.from).toFixed(1)} с` : mmss(s.to - s.from, true)} | ${s.motion} |`),
  ];
  fs.writeFileSync(`${base}.md`, md.join('\n') + '\n');
  console.log(`${mmss(res.dur, true)}: активное ${share('active')}, простой ${share('idle')} — отрезков простоя ${nIdle} (порог ${o.threshold}, от ${o.minIdle} с, поля ${o.margin} с)`);
  console.log(`движение: p10 ${res.motion.p10} · p50 ${res.motion.p50} · p90 ${res.motion.p90}`);
  for (const s of res.spans.filter((x) => x.kind === 'idle').slice(0, 12)) console.log(`  простой ${span(s)}  ${(s.to - s.from).toFixed(1)} с  (${s.motion})`);
  if (nIdle > 12) console.log(`  … ещё ${nIdle - 12} — в отчёте`);
  for (const m of marks) console.log(`  метка ${mmss(m.t)}: ${m.inIdle ? 'в простое' : 'в активном'}, в клипе простоя ${m.clipIdle} с${m.tight && (m.tight.from !== m.clip.from || m.tight.to !== m.clip.to) ? `, плотнее ${span(m.tight)}` : ''}`);
  console.log(`→ ${path.relative(process.cwd(), base)}.md (+ .json)`);
  process.exit(0);
}

fs.mkdirSync(CLIPS, {recursive: true});
const old = args.includes('--all') ? [] : index();
const recs = fs.existsSync(REC) ? fs.readdirSync(REC).filter((f) => VIDEO.test(f) && fs.statSync(path.join(REC, f)).isFile()) : [];
const fresh = recs.filter((f) => !old.some((c) => c.rec === f && c.mtime === fs.statSync(path.join(REC, f)).mtimeMs));
if (!fresh.length) console.log(recs.length ? 'новых записей нет (--all — переделать)' : `записей нет: положите их в ${REC}`);

const out = old.filter((c) => recs.includes(c.rec) && !fresh.includes(c.rec));
for (const f of fresh) {
  const file = path.join(REC, f);
  const mtime = fs.statSync(file).mtimeMs;
  const dur = Number(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).stdout);
  const marks = chapters(file);
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
