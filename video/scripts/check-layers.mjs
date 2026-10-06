// Правила импортов между слоями src/ (без зависимостей, по тексту файлов):
//   node scripts/check-layers.mjs            — отчёт: все нарушения, код выхода 0
//   node scripts/check-layers.mjs --strict   — код 1, если есть НОВЫЕ нарушения (известные печатаются, но не блокируют)
//   node scripts/check-layers.mjs --quiet    — печатать только новые нарушения (для хуков; пусто — всё чисто)
//   node scripts/check-layers.mjs --test     — самопроверка разбора импортов (комментарии, строки, регулярки)
// --strict блокирует: git-хук pre-commit (коммит не пройдёт) и Stop-хук Claude Code (hooks/stop-typecheck.mjs).
// Слои src/ (целевое дерево — video/STUDIO.md, src/studios/README.md):
//   - src/hearthpulse (бренд рекламы) импортирует только пакеты; его импортируют только студии с brand "hearthpulse" (studios.json);
//   - студии не импортируют друг друга; студия берёт только свои игру, стиль и бренд — поля game, look, brand в studios.json;
//   - общий код студии (Root, channel, videos, витрины) не импортирует данные ролика (<студия>/<ролик>/…), кроме реестра
//     роликов: файлы в корне студии (Root.tsx, videos.ts, index.ts) регистрируют свои ролики — можно;
//   - ролик студии-канала (в корне студии есть channel.ts — YouTube) импортирует только корень своей студии (channel.ts)
//     и свои файлы (article.json, meta.json): не core, looks, games, brands напрямую, не витрины и не другой ролик
//     (ролики рекламы HearthPulse — по прежним правилам: они закреплены);
//   - импорты только относительные или пакеты из node_modules: алиасы tsconfig paths запрещены (webpack Remotion их не читает);
//   - core (src/core) → только core и пакеты remotion/react/@remotion/*: не импортирует looks, games, brands, studios, hearthpulse;
//   - looks/<стиль> → core и свой стиль; games/<игра>/data → core; brands/<канал> → core;
//   - games/<игра>/scenes → core, своя игра (data, scenes) и «свои» стили — look студий этой игры в studios.json
//     (игра рисуется в стиле канала; чужой стиль — через новую студию в реестре);
//   - games/<игра>/fixtures (образцы данных для демо, витрин и стендов) → core и своя игра (data, fixtures);
//     образцы берут только студии: data и scenes игры их не импортируют;
//   - никто из них не импортирует studios/ и hearthpulse.
import fs from 'node:fs';
import path from 'node:path';
import {VIDEO} from './lib/paths.mjs';
import {STUDIOS} from './lib/studios.mjs';

process.chdir(VIDEO);
const args = process.argv.slice(2);
const strict = args.includes('--strict');
const quiet = args.includes('--quiet');

// Текст файла → тот же текст той же длины, где комментарии (// … и /* … */), содержимое строк ('…', "…", `…`) и регулярных
// выражений заменены пробелами (переводы строк сохраняются). Так «from '…'» в хвостовом комментарии или внутри строки
// не принимается за импорт. Кавычки строк остаются — по ним находится путь импорта в исходном тексте
const mask = (src) => {
  const blank = (s) => s.replace(/[^\n]/g, ' ');
  const n = src.length;
  let out = '';
  let prev = ''; // последний значимый символ кода: после него «/» — регулярка или деление
  let i = 0;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '/' && (d === '/' || d === '*')) {
      const j = d === '/' ? src.indexOf('\n', i) : src.indexOf('*/', i + 2);
      const e = j < 0 ? n : d === '/' ? j : j + 2;
      out += blank(src.slice(i, e));
      i = e;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      // строка в '…' и "…" не переносится: незакрытая кавычка (апостроф в тексте JSX) гасится до конца строки
      let j = i + 1;
      while (j < n && src[j] !== c && (c === '`' || src[j] !== '\n')) j += src[j] === '\\' ? 2 : 1;
      const closed = src[j] === c;
      out += c + blank(src.slice(i + 1, Math.min(j, n))) + (closed ? c : '');
      i = closed ? j + 1 : Math.min(j, n);
      prev = c;
      continue;
    }
    if (c === '/' && (!prev || /[(,=:[!&|?{};+\-*%<>~^]/.test(prev) || /\b(return|typeof|case)\s*$/.test(out.slice(-16)))) {
      let j = i + 1;
      let cls = false;
      while (j < n && src[j] !== '\n' && (cls || src[j] !== '/')) {
        if (src[j] === '\\') j++;
        else if (src[j] === '[') cls = true;
        else if (src[j] === ']') cls = false;
        j++;
      }
      if (src[j] === '/') {
        out += '/' + blank(src.slice(i + 1, j)) + '/';
        i = j + 1;
        prev = '/';
        continue;
      }
    }
    out += c;
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  return out;
};

// Импорты файла: from '…', import '…' / import('…'), require('…') — только в коде, не в комментариях и строках
const importsOf = (src) => {
  const masked = mask(src);
  const re = /\bfrom\s*(['"])[^'"\n]*\1|\bimport\s*\(?\s*(['"])[^'"\n]*\2|\brequire\(\s*(['"])[^'"\n]*\3/g;
  const out = [];
  for (const m of masked.matchAll(re)) {
    const q = m[1] ?? m[2] ?? m[3];
    const open = m.index + m[0].indexOf(q);
    const close = m.index + m[0].length - 1;
    const spec = src.slice(open + 1, close);
    if (spec.trim()) out.push({spec, index: m.index});
  }
  return out;
};

// Самопроверка разбора импортов: node scripts/check-layers.mjs --test (код 1 — разбор сломан)
if (args.includes('--test')) {
  const cases = [
    ["x(); // из '../../games/hearthstone/data' — from '../../games/x'", []],
    ["import {a} from '../time/fps'; // from '../../brands/manacost/channel'", ['../time/fps']],
    ['/* from "../x" */ import b from \'remotion\';', ['remotion']],
    ["/*\n import x from '../../looks/compendium'\n*/\nexport * from \"./a\";", ['./a']],
    ["const s = \"import('../../brands/x')\";", []],
    ["const t = `from '../../looks/x'`;", []],
    ["const re = /from '..\\/x'/g; const r2 = x.replace(/'/g, '\"');", []],
    ["const k = a / 2; import('./lazy'); const q = b / c;", ['./lazy']],
    ["<p>Кель'Тас</p>\nimport y from './y';", ['./y']],
    ["const z = require( './z' );", ['./z']],
  ];
  let bad = 0;
  for (const [src, want] of cases) {
    const got = importsOf(src).map((x) => x.spec);
    const ok = JSON.stringify(got) === JSON.stringify(want);
    if (!ok) bad++;
    console.log(`${ok ? '✓' : '✗'} ${JSON.stringify(src).slice(0, 70)} → ${JSON.stringify(got)}${ok ? '' : ` (ждали ${JSON.stringify(want)})`}`);
  }
  console.log(bad ? `✗ разбор импортов: ${bad} из ${cases.length} не совпали` : `✓ разбор импортов: ${cases.length} случаев`);
  process.exit(bad ? 1 : 0);
}
const SRC = path.join(VIDEO, 'src');

// Известные нарушения: печатаются отдельно и не блокируют --strict. Убрать строку, когда нарушение исправлено
// (формат: {from: /путь от src/, to: /путь от src/, why: '…'}; шаблон и витрина Манакоста брали статью ролика как образец —
// исправлено на шаге B-6: образец теперь games/hearthstone/fixtures)
const KNOWN = [];

const frozen = JSON.parse(fs.readFileSync(path.join(SRC, 'studios', 'frozen.json'), 'utf8'));
const byDir = new Map(STUDIOS.map((s) => [s.dir, s]));
// Стили, в которых рисуется игра: look студий этой игры (studios.json)
const looksOf = (game) => new Set(STUDIOS.filter((s) => s.game === game).map((s) => s.look));
// Студия-канал: ролики собираются из реестра сцен (channel.ts в корне студии)
const isChannel = (s) => fs.existsSync(path.join(SRC, 'studios', s.dir, 'channel.ts'));
const isVideo = (s, sub) =>
  !!sub && (fs.existsSync(path.join(SRC, 'studios', s.dir, sub, 'config.ts')) || (s.idPrefix && sub.startsWith(s.idPrefix)) || frozen.some((f) => f.studio === s.key && f.ad === sub));

// Слой файла по пути от src/ (posix)
const layerOf = (rel) => {
  const p = rel.split('/');
  if (p[0] === 'hearthpulse') return {name: 'hearthpulse'};
  if (p[0] === 'core') return {name: 'core'};
  if (p[0] === 'looks') return {name: 'look', look: p[1]};
  if (p[0] === 'brands') return {name: 'brand', brand: p[1]};
  if (p[0] === 'games') return {name: p[2] === 'data' ? 'game-data' : p[2] === 'fixtures' ? 'game-fixtures' : 'game-scenes', game: p[1]};
  if (p[0] === 'studios') {
    const s = byDir.get(p[1]);
    if (!s) return {name: 'studios-root'}; // studios.json, frozen.json, README
    if (p.length === 3) return {name: 'studio-root', studio: s};
    if (isVideo(s, p[2])) return {name: 'video', studio: s, id: p[2]};
    return {name: 'studio-shared', studio: s, part: p[2]};
  }
  return {name: 'root'};
};

const PKG_CORE = /^(remotion|react|react-dom|react\/jsx-runtime)$|^@remotion\//;
const pkgName = (spec) => (spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]);
const installed = (spec) => spec.startsWith('node:') || fs.existsSync(path.join(VIDEO, 'node_modules', pkgName(spec)));

// Нарушение импорта from → to (оба — слои); null — можно
const rule = (A, B, toRel) => {
  const studioLike = (L) => ['studio-root', 'studio-shared', 'video'].includes(L.name);
  if (A.name === 'hearthpulse') return B.name === 'hearthpulse' ? null : 'src/hearthpulse импортирует только пакеты (remotion, react) и себя';
  if (B.name === 'hearthpulse' && !(studioLike(A) && A.studio.brand === 'hearthpulse')) return `src/hearthpulse импортируют только студии бренда hearthpulse (studios.json), а здесь ${A.studio?.dir ?? A.name}`;
  if (studioLike(B) && !studioLike(A)) return `слой ${A.name} не импортирует студии (src/studios/${B.studio.dir})`;
  if (studioLike(A) && studioLike(B) && A.studio !== B.studio) return `студии не импортируют друг друга: ${A.studio.dir} → ${B.studio.dir}`;
  if (A.name === 'studio-shared' && B.name === 'video') return `общий код студии (${A.part}/) не импортирует данные ролика ${B.id}`;
  if (A.name === 'video' && B.name === 'video' && A.id !== B.id) return `ролик ${A.id} не импортирует данные чужого ролика ${B.id}`;
  if (A.name === 'video' && isChannel(A.studio) && !(B.name === 'video' || B.name === 'studio-root')) return `ролик ${A.id} импортирует только канал студии (${A.studio.dir}/channel.ts) и свои файлы, а не ${toRel}`;
  if (studioLike(A) && B.name.startsWith('game') && B.game !== A.studio.game) return `студия ${A.studio.dir} — игра ${A.studio.game} (studios.json), а не games/${B.game}`;
  if (studioLike(A) && B.name === 'look' && B.look !== A.studio.look) return `студия ${A.studio.dir} — стиль ${A.studio.look} (studios.json), а не looks/${B.look}`;
  if (studioLike(A) && B.name === 'brand' && B.brand !== A.studio.brand) return `студия ${A.studio.dir} — бренд ${A.studio.brand} (studios.json), а не brands/${B.brand}`;
  if (A.name === 'core' && B.name !== 'core') return `core не импортирует ${B.name} (${toRel})`;
  if (A.name === 'look' && !(B.name === 'core' || (B.name === 'look' && B.look === A.look))) return `looks/${A.look} импортирует только core и себя`;
  if (A.name === 'game-data' && !(B.name === 'core' || (B.name === 'game-data' && B.game === A.game))) return `games/${A.game}/data импортирует только core и свою data`;
  if (A.name === 'game-scenes' && B.name === 'look' && !looksOf(A.game).has(B.look)) return `games/${A.game}/scenes импортирует только свои стили (look студий игры ${A.game} в studios.json), а не looks/${B.look}`;
  if (A.name === 'game-scenes' && !(B.name === 'core' || B.name === 'look' || (['game-data', 'game-scenes'].includes(B.name) && B.game === A.game))) return `games/${A.game}/scenes импортирует только core, свой стиль и games/${A.game} (не fixtures)`;
  if (A.name === 'game-fixtures' && !(B.name === 'core' || (['game-data', 'game-fixtures'].includes(B.name) && B.game === A.game))) return `games/${A.game}/fixtures импортирует только core и games/${A.game}/data`;
  if (A.name === 'brand' && !(B.name === 'core' || (B.name === 'brand' && B.brand === A.brand))) return `brands/${A.brand} импортирует только core (типы)`;
  return null;
};

const files = [];
const walk = (dir) => {
  for (const d of fs.readdirSync(dir, {withFileTypes: true})) {
    const f = path.join(dir, d.name);
    if (d.isDirectory()) {
      if (d.name !== 'node_modules' && d.name !== 'ref') walk(f);
    } else if (/\.(tsx?|jsx?|mjs)$/.test(d.name)) files.push(f);
  }
};
walk(SRC);

const found = [];
let imports = 0;
const tsconfig = fs.readFileSync(path.join(VIDEO, 'tsconfig.json'), 'utf8');
if (/"paths"\s*:/.test(tsconfig)) found.push({where: 'tsconfig.json', spec: 'compilerOptions.paths', why: 'алиасы путей запрещены: tsc их примет, а сборка Remotion и скрипты — нет'});
for (const file of files) {
  const rel = path.relative(SRC, file).replace(/\\/g, '/');
  const A = layerOf(rel);
  const text = fs.readFileSync(file, 'utf8');
  for (const {spec, index} of importsOf(text)) {
    const line = text.slice(0, index).split('\n').length;
    const where = `src/${rel}:${line}`;
    imports++;
    if (!spec.startsWith('.')) {
      if (!installed(spec)) found.push({where, spec, why: 'не относительный путь и не пакет из node_modules — алиас путей или неустановленный пакет'});
      else if (A.name === 'core' && !PKG_CORE.test(spec)) found.push({where, spec, why: 'core знает только remotion, react и @remotion/*'});
      continue;
    }
    const toRel = path.posix.normalize(path.posix.join(path.posix.dirname(rel), spec));
    if (toRel.startsWith('..')) {
      found.push({where, spec, why: 'импорт за пределы src/'});
      continue;
    }
    const why = rule(A, layerOf(toRel), toRel);
    if (why) found.push({where, spec, why, from: rel, to: toRel});
  }
}

const known = found.filter((f) => f.from && KNOWN.some((k) => k.from.test(f.from) && k.to.test(f.to)));
const fresh = found.filter((f) => !known.includes(f));
const show = (f) => `  ${f.where} → '${f.spec}': ${f.why}`;
if (!quiet) {
  console.log(`check-layers: файлов ${files.length}, импортов ${imports}`);
  console.log(fresh.length ? `✗ новые нарушения (${fresh.length}):` : '✓ новых нарушений нет');
}
if (fresh.length) console.log((quiet ? 'check-layers — нарушения слоёв импортов:\n' : '') + fresh.map(show).join('\n'));
if (!quiet && known.length) {
  console.log(`· известные (${known.length}, не блокируют --strict):`);
  for (const f of known) console.log(`${show(f)} — ${KNOWN.find((k) => k.from.test(f.from) && k.to.test(f.to)).why}`);
}
process.exit(strict && fresh.length ? 1 : 0);
