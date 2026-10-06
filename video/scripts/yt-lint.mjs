// Проверка раскладки YouTube-ролика без взгляда человека: node scripts/yt-lint.mjs <id> [сцена…] [--at 0.3,0.6,0.92]
// Рендерит кадры сцен со встроенным зондом (src/core/qa/lint.tsx, REMOTION_LINT) и собирает из браузера настоящие границы
// надписей: текст за краем кадра, текст на тексте из разных блоков, текст поверх постера или карт веера (data-qa-clear).
// Пишет out/<id>/lint-report.md; код выхода 1, если что-то нашлось. Кадры — посередине и к концу сцен, когда всё
// уже появилось (вход и уход страницы не проверяются — там наложения по замыслу).
// Раздел «Читаемость» (телефон) — только ⚠, в код выхода и в число находок не входит: смысловой текст мельче
// LIMITS.readMinPx (px кадра 1080p; мелкий по замыслу — data-qa-small-ok) и контраст с однотонным фоном ниже
// LIMITS.readMinContrast (пороги — VIDEO_LIMITS, src/core/qa/limits.ts). Надпись сцены судится по лучшему из проверенных
// кадров (появление, уход и наезд камеры не в счёт); место — файл компонента (по именам React-компонентов из зонда).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {renderStill} from '@remotion/renderer';
import {VIDEO} from './lib/paths.mjs';
import {CHROME, openComposition, quietFonts} from './lib/remotion.mjs';
import {loadChannel} from './lib/channel.mjs';
import {studio} from './lib/studios.mjs';

process.chdir(VIDEO);
quietFonts();
// строки зонда «YTLINT {…}» Remotion сам печатает в терминал (console.debug из бандла → verbose) — их читает onBrowserLog,
// в терминал не пускаем
const print = console.log;
console.log = (...a) => (a.some((x) => String(x).includes('YTLINT ')) ? undefined : print(...a));
const args = process.argv.slice(2);
const id = args[0];
if (!id || id.startsWith('--')) throw new Error('node scripts/yt-lint.mjs <id> [сцена…] [--at 0.3,0.6,0.92]');
const opt = (n) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : undefined);
const pats = args.slice(1).filter((a) => !a.startsWith('--') && a !== opt('at')).map((a) => new RegExp(a));
const at = (opt('at') ?? '0.3,0.6,0.92').split(',').map(Number);

const browserExecutable = CHROME;
const envVariables = {REMOTION_LINT: '1'};
const {key, serveUrl, composition} = await openComposition(id, {envVariables, logLevel: 'error'});
const {LIMITS} = await loadChannel(key, 'yt-lint'); // пороги читаемости — readMinPx, readMinContrast (VIDEO_LIMITS)
const {timing} = /** @type {any} */ (composition.props); // props YouTube-композиции: {config, timing}
const K = composition.fps / (timing.base ?? 30);
const tmp = path.join(os.tmpdir(), 'yt-lint.jpg');

const found = [];
const read = []; // замеры читаемости (src/core/qa/lint.tsx → readDom)
let checked = 0;
for (const t of timing.segments.filter((s) => !pats.length || pats.some((p) => p.test(s.id)))) {
  for (const q of at) {
    const frame = Math.min(composition.durationInFrames - 1, Math.round((t.from + q * t.dur) * K));
    let report;
    await renderStill({
      serveUrl,
      composition,
      frame,
      output: tmp,
      scale: 0.25,
      browserExecutable,
      envVariables,
      logLevel: 'error',
      onBrowserLog: (log) => {
        if (log.text.startsWith('YTLINT ')) report = JSON.parse(log.text.slice(7));
      },
    });
    checked++;
    if (!report) {
      found.push({seg: t.id, sec: frame / composition.fps, kind: 'probe', text: 'зонд не ответил'});
      continue;
    }
    for (const i of report.issues) found.push({seg: t.id, sec: frame / composition.fps, ...i});
    for (const r of report.read?.samples ?? []) read.push({seg: t.id, sec: frame / composition.fps, ...r, comp: report.read.chains[r.comp] ?? []});
  }
}

const what = {edge: 'текст за краем кадра', overlap: 'текст на тексте', clear: 'текст на', probe: 'нет данных'};
const fmt = (i) => `${i.seg} · ${i.sec.toFixed(1)} с — ${what[i.kind]}${i.kind === 'clear' ? ` «${i.other}»` : ''}: «${i.text.slice(0, 40)}»${i.kind === 'overlap' ? ` и «${(i.other ?? '').slice(0, 40)}»` : ''}${i.box ? ` [${Math.round(i.box.left)},${Math.round(i.box.top)}–${Math.round(i.box.right)},${Math.round(i.box.bottom)}]` : ''}`;
// одинаковые находки на соседних кадрах — одной строкой
const uniq = [...new Map(found.map((i) => [`${i.seg}|${i.kind}|${i.text}|${i.other ?? ''}`, i])).values()];
const lines = [`# Раскладка «${id}»`, '', `Кадров проверено: ${checked} · находок: ${uniq.length}`, '', ...uniq.map((i) => `- ${fmt(i)}`)];
const layoutText = lines.slice(2).join('\n');

// ── Читаемость (⚠): надпись сцены — по лучшему кадру (наибольший кегль, наибольший контраст) ──
const best = new Map();
for (const r of read) {
  const k = `${r.seg}|${r.text}`;
  const b = best.get(k) ?? {...r, sizeSec: r.sec, ratioSec: r.sec};
  if (r.size !== null && (b.size === null || r.size > b.size)) Object.assign(b, {size: r.size, sizeSec: r.sec, comp: r.comp});
  if (r.ratio !== null && (b.ratio === null || r.ratio > b.ratio)) Object.assign(b, {ratio: r.ratio, fg: r.fg, bg: r.bg, halo: r.halo, ratioSec: r.sec});
  best.set(k, b);
}
// имя React-компонента → файл: объявления «const|function Имя» в общих слоях и своей студии (зонд знает только имена)
const SRC = path.resolve('src');
const defs = new Map();
const ownDirs = ['core', 'looks', 'games', 'brands', `studios/${studio(key).dir}`];
for (const f of fs.readdirSync(SRC, {recursive: true}).map(String)) {
  const posix = f.replace(/\\/g, '/');
  if (!/\.tsx?$/.test(f) || !ownDirs.some((d) => posix.startsWith(`${d}/`))) continue;
  const rel = `src/${posix}`;
  for (const m of fs.readFileSync(path.join(SRC, f), 'utf8').matchAll(/^(?:export\s+)?(?:default\s+)?(?:const|function)\s+([A-Z]\w*)/gm)) defs.set(m[1], [...(defs.get(m[1]) ?? []), rel]);
}
const SKIP = new Set(['VoicedVideo', 'LintProbe']); // движок и сам зонд — не место надписи
// место надписи: ближайший свой компонент и следующий за ним другой свой файл (обычно деталь ← сцена)
const placeOf = (comp = []) => {
  const out = [];
  for (const n of comp.filter((x) => defs.has(x) && !SKIP.has(x))) {
    const files = defs.get(n).join(' | ');
    if (!out.some((o) => o.files === files)) out.push({files, where: `${files} (${n})`});
    if (out.length === 2) break;
  }
  return out.map((o) => o.where).join(' ← ') || `файл не найден (компоненты: ${comp.slice(0, 3).join(' ← ') || 'нет данных'})`;
};
const minPx = LIMITS.readMinPx;
const minRatio = LIMITS.readMinContrast;
const all = [...best.values()];
const small = all.filter((b) => b.size !== null && b.size < minPx);
const pale = all.filter((b) => b.ratio !== null && b.ratio < minRatio);
const unmeasured = all.filter((b) => b.ratio === null);
const num = (x, d = 1) => x.toFixed(d).replace('.', ',');
const readFound = [
  ...small.map((b) => ({place: placeOf(b.comp), line: `${b.seg} · ${b.sizeSec.toFixed(1)} с — мелкий текст ${num(b.size)} px (< ${minPx}): «${b.text.slice(0, 40)}»`})),
  ...pale.map((b) => ({
    place: placeOf(b.comp),
    line: `${b.seg} · ${b.ratioSec.toFixed(1)} с — контраст ${num(b.ratio, 2)}:1 (< ${num(minRatio)}): «${b.text.slice(0, 40)}» ${b.fg} на ${b.bg}, ${b.size === null ? 'мелкий по замыслу' : `${num(b.size)} px`}${b.halo ? ', есть тень или обводка' : ''}`,
  })),
];
const byPlace = new Map();
for (const r of readFound) byPlace.set(r.place, [...(byPlace.get(r.place) ?? []), r.line]);
const why = new Map();
for (const b of unmeasured) why.set(b.why ?? 'нет данных', (why.get(b.why ?? 'нет данных') ?? 0) + 1);
lines.push(
  '',
  '## Читаемость (телефон, ⚠)',
  '',
  `Только предупреждения: в код выхода и в число находок выше не входят. Порог — смысловой текст от ${minPx} px при 1080p (мелкий по замыслу — data-qa-small-ok), контраст с однотонным фоном от ${num(minRatio)}:1. Надпись сцены — по лучшему из проверенных кадров.`,
  '',
  `Мест: ${readFound.length} · мелкий текст: ${small.length} · низкий контраст: ${pale.length} · надписей: ${all.length}, контраст не мерился у ${unmeasured.length}${unmeasured.length ? ` (${[...why].map(([w, n]) => `${w} — ${n}`).join('; ')})` : ''}`,
  ...[...byPlace].flatMap(([place, ls]) => ['', `### ${place}`, '', ...ls.map((l) => `- ⚠ ${l}`)]),
);

fs.mkdirSync(path.resolve('out', id), {recursive: true});
fs.writeFileSync(path.resolve('out', id, 'lint-report.md'), lines.join('\n') + '\n');
console.log(layoutText);
console.log(`⚠ читаемость (код выхода не меняет): мест ${readFound.length} — мелкий текст ${small.length}, низкий контраст ${pale.length}`);
console.log(`→ out/${id}/lint-report.md`);
process.exit(uniq.length ? 1 : (process.exitCode ?? 0));
