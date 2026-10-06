// Удержание зрителей по сценам после публикации: node scripts/yt-metrics.mjs <id> <retention.csv> [--pos <столбец>] [--ret <столбец>]
// CSV — график «Удержание аудитории» из YouTube Studio (как выгрузить — подсказка при запуске без файла). Позиция в ролике
// (доля, проценты, секунды или м:сс) сопоставляется со сценами по таймингу композиции — так видно, на какой колоде, врезке
// или разделителе уходят зрители. Пишет out/<id>/retention.md: удержание в начале и конце каждой сцены, потеря и потеря
// в минуту (⚠ — три самых крутых спада), контрольные точки 0:30, 1:00, середина, начало финала.
// Выводы (что работает, что нет) — в LEARNINGS.md вручную: через 7 и 28 дней после публикации.
import fs from 'node:fs';
import path from 'node:path';
import {userPath, VIDEO} from './lib/paths.mjs';
import {openComposition, quietFonts} from './lib/remotion.mjs';
import {mmss} from './lib/text.mjs';

const args = process.argv.slice(2);
const [id, csvArg] = args;
const opt = (n) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : undefined);
const HOW = [
  'Как выгрузить удержание из YouTube Studio:',
  '  1. Studio → «Контент» → ролик → «Аналитика» → вкладка «Вовлечённость».',
  '  2. Карточка «Удержание аудитории» → «Подробнее» (откроется расширенный режим с графиком удержания).',
  '  3. Справа сверху значок «Экспорт» → «Значения, разделённые запятыми (.csv)».',
  '  4. В скачанном архиве — файл с данными графика («Данные диаграммы.csv» / «Chart data.csv»): позиция в ролике и удержание, %.',
  `  5. node scripts/yt-metrics.mjs ${id ?? '<id>'} "<путь к этому csv>"`,
  'Столбцы находятся сами (позиция — «позиция»/«position»/«время», удержание — «удержание»/«retention»); иначе --pos и --ret с их названиями.',
].join('\n');
if (!id || id.startsWith('--')) {
  console.error(`node scripts/yt-metrics.mjs <id> <retention.csv>\n\n${HOW}`);
  process.exit(1);
}
const csvFile = csvArg && !csvArg.startsWith('--') ? userPath(csvArg) : null; // путь — от папки запуска
if (!csvFile || !fs.existsSync(csvFile)) {
  console.error(`${csvFile ? `нет файла ${csvFile}` : 'не указан CSV с удержанием'}\n\n${HOW}`);
  process.exit(1);
}
process.chdir(VIDEO);
quietFonts();

// ── CSV: разделитель , или ; (или табуляция), кавычки, BOM ──
const text = fs.readFileSync(csvFile, 'utf8').replace(/^\uFEFF/, '');
const first = text.split(/\r?\n/)[0];
const sep = [',', ';', '\t'].sort((a, b) => first.split(b).length - first.split(a).length)[0];
const parseLine = (line) => {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q && c === '"' && line[i + 1] === '"') (cur += '"'), i++;
    else if (c === '"') q = !q;
    else if (c === sep && !q) out.push(cur.trim()), (cur = '');
    else cur += c;
  }
  return [...out, cur.trim()];
};
const rows = text.split(/\r?\n/).filter((l) => l.trim()).map(parseLine);
const head = rows[0].map((h) => h.toLowerCase());
const col = (name, re, avoid) => {
  if (name) {
    const i = head.indexOf(name.toLowerCase());
    if (i < 0) throw new Error(`нет столбца «${name}»: ${rows[0].join(' | ')}`);
    return i;
  }
  return head.findIndex((h) => re.test(h) && !(avoid && avoid.test(h)));
};
const ip = col(opt('pos'), /позиц|position|время|time|момент/);
const ir = col(opt('ret'), /удерж|retention|зрител|audience/, /относит|relative|позиц|position/);
if (ip < 0 || ir < 0) {
  console.error(`не нашёл столбцы позиции и удержания в «${rows[0].join(' | ')}» — укажите --pos «…» --ret «…»\n\n${HOW}`);
  process.exit(1);
}
const num = (s) => Number(String(s).replace(/%/g, '').replace(/\s/g, '').replace(',', '.'));
const clockSec = (s) => s.split(':').map(Number).reduce((a, x) => a * 60 + x, 0);

// ── Тайминг сцен из композиции ──
const {composition} = await openComposition(id, {fallback: 'youtube', logLevel: 'error'});
const {config, timing} = /** @type {{config: any, timing: any}} */ (composition.props);
const base = timing.base ?? 30;
const total = timing.total / base;
const raw = rows.slice(1).filter((r) => r[ip] !== undefined && r[ir] !== undefined && r[ip] !== '');
const posRaw = raw.map((r) => r[ip]);
const posVals = posRaw.map(num);
// позиция: м:сс → секунды; явные секунды; доля 0..1; проценты 0..100
const asSec = posRaw.some((p) => /\d:\d/.test(p))
  ? posRaw.map(clockSec)
  : /сек|sec|\(s\)/.test(head[ip])
    ? posVals
    : Math.max(...posVals) <= 1.0001
      ? posVals.map((p) => p * total)
      : posVals.map((p) => (p / 100) * total);
const retVals = raw.map((r) => num(r[ir]));
const retPct = Math.max(...retVals) <= 1.5 ? retVals.map((r) => r * 100) : retVals; // доля → проценты
const points = asSec.map((s, i) => [s, retPct[i]]).filter(([s, r]) => Number.isFinite(s) && Number.isFinite(r)).sort((a, b) => a[0] - b[0]);
if (points.length < 3) throw new Error(`в CSV меньше трёх точек удержания (${points.length}) — тот ли файл?`);
// удержание в момент t: линейно между соседними точками
const at = (t) => {
  if (t <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) if (t <= points[i][0]) {
    const [a, ra] = points[i - 1];
    const [b, rb] = points[i];
    return ra + ((rb - ra) * (t - a)) / (b - a || 1);
  }
  return points.at(-1)[1];
};

// ── По сценам ──
const scenes = config.segments.map((s, i) => {
  const t = timing.segments[i];
  const a = t.from / base;
  const b = (t.from + t.dur) / base;
  const r0 = at(a);
  const r1 = at(b);
  return {id: s.id, title: t.chapter || s.kind, a, b, r0, r1, drop: r0 - r1, perMin: ((r0 - r1) / Math.max(1e-6, b - a)) * 60};
});
const steep = new Set([...scenes].filter((s) => s.a > 0).sort((x, y) => y.perMin - x.perMin).slice(0, 3).map((s) => s.id));
const pct = (x) => `${x.toFixed(1)} %`;
const outro = scenes.find((s) => config.segments.find((c) => c.id === s.id)?.kind === 'outro');
const lines = [
  `# Удержание «${config.title}»`,
  '',
  `Файл: ${path.basename(csvFile)} · ${points.length} точек · длина ролика ${mmss(total)} · ${new Date().toLocaleString('ru-RU')}`,
  '',
  `Контрольные точки: 0:30 — ${pct(at(30))} · 1:00 — ${pct(at(60))} · середина (${mmss(total / 2)}) — ${pct(at(total / 2))}${outro ? ` · начало финала (${mmss(outro.a)}) — ${pct(outro.r0)}` : ''} · конец — ${pct(at(total))}`,
  '',
  '| сцена | глава | начало | длина | удержание в начале | в конце | потеря | потеря в минуту |',
  '|---|---|---|---|---|---|---|---|',
  ...scenes.map((s) => `| ${steep.has(s.id) ? '⚠️ ' : s.drop < 0 ? 'ℹ️ ' : ''}${s.id} | ${s.title} | ${mmss(s.a)} | ${Math.round(s.b - s.a)} с | ${pct(s.r0)} | ${pct(s.r1)} | ${s.drop.toFixed(1)} | ${s.perMin.toFixed(1)} |`),
  '',
  '⚠️ — три самых крутых спада (кроме первой сцены: там уходят всегда); ℹ️ — удержание выросло (пересматривают или перематывают сюда).',
  'Что дальше: сравнить спады с картой темпа (pace.md) и сценами без «новинки»; выводы — в LEARNINGS.md.',
];
const outFile = path.resolve('out', id, 'retention.md');
fs.mkdirSync(path.dirname(outFile), {recursive: true});
fs.writeFileSync(outFile, lines.join('\n') + '\n');
console.log(lines[4]);
for (const s of scenes.filter((x) => steep.has(x.id))) console.log(`⚠️ ${s.id} (${s.title}, ${mmss(s.a)}): −${s.drop.toFixed(1)} п. п., ${s.perMin.toFixed(1)} в минуту`);
console.log(`→ ${path.relative(process.cwd(), outFile)}`);
process.exit(process.exitCode ?? 0);
