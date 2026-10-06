// Ссылки в документах и навыках: существуют ли пути, которые они называют.
//   node scripts/doc-check.mjs            — отчёт, код выхода 0
//   node scripts/doc-check.mjs --strict   — код 1, если есть битые ссылки
//   node scripts/doc-check.mjs <файл.md…> — только эти файлы
// Проверяет CLAUDE.md, video/*.md, video/src/**/README.md, .claude/skills/{manacost-youtube,hearthpulse-video,studio*}/**/*.md:
//   - пути в `обратных кавычках` (в команде — каждое слово, похожее на путь: scripts/yt-qa.mjs, src/studios/README.md, BRAND.md);
//   - ссылки [текст](путь) — от папки документа.
// Путь ищется от папки документа, корня репозитория, video/, video/src, video/src/studios, папок студий, video/scripts и video/public;
// голое имя файла (render.ps1) — где угодно в репозитории. Не проверяются: шаблоны (<id>, {id}, *, …), адреса, флаги, пакеты (@remotion/…),
// создаваемое скриптами (out/…), строки с ":" после пути — номера строк отбрасываются.
import fs from 'node:fs';
import path from 'node:path';
import {ROOT, userPath, VIDEO} from './lib/paths.mjs';
import {STUDIOS_DIR} from './lib/studios.mjs';

const args = process.argv.slice(2);
const strict = args.includes('--strict');
const only = args.filter((a) => !a.startsWith('--')).map(userPath);
process.chdir(VIDEO);

const md = (dir, deep) => {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap((d) => {
    const f = path.join(dir, d.name);
    if (d.isDirectory()) return deep && !['node_modules', 'out', 'ref'].includes(d.name) ? md(f, deep) : [];
    return d.name.endsWith('.md') ? [f] : [];
  });
};
const skills = path.join(ROOT, '.claude', 'skills');
const docs = only.length
  ? only
  : [
      path.join(ROOT, 'CLAUDE.md'),
      ...md(VIDEO, false),
      ...md(path.join(VIDEO, 'src'), true).filter((f) => path.basename(f) === 'README.md'),
      ...(fs.existsSync(skills) ? fs.readdirSync(skills).filter((d) => /^(manacost-youtube|hearthpulse-video|studio.*)$/.test(d)).flatMap((d) => md(path.join(skills, d), true)) : []),
    ].filter((f) => fs.existsSync(f));

// все имена файлов репозитория (для голых имён вроде render.ps1)
const names = new Set();
const index = (dir) => {
  for (const d of fs.readdirSync(dir, {withFileTypes: true})) {
    if (['node_modules', '.git', 'out', '.venv-vo', 'recordings'].includes(d.name)) continue;
    const f = path.join(dir, d.name);
    names.add(d.name);
    if (d.isDirectory()) index(f);
  }
};
index(ROOT);

const studioDirs = fs.readdirSync(STUDIOS_DIR, {withFileTypes: true}).filter((d) => d.isDirectory()).map((d) => path.join(STUDIOS_DIR, d.name));
const bases = (docDir) => [docDir, ROOT, VIDEO, path.join(VIDEO, 'src'), STUDIOS_DIR, ...studioDirs, path.join(VIDEO, 'scripts'), path.join(VIDEO, 'public')];
const EXT = /\.(mjs|cjs|js|ts|tsx|json|md|ps1|py|png|jpe?g|webp|svg|mp4|mp3|wav|m4a|srt|txt|ya?ml|css|html)$/i;
const SKIP = /^(https?:|mailto:|file:|-)|[<>{}*…$%|=?]|\.\.\.|^@|^~|^[a-z]+:\/\//i;
const GENERATED = /^(video\/)?(out|node_modules|recordings|capture|library-preview)\//;

const clean = (t) =>
  t
    .replace(/^[«"'(\[]+|[»"'),.;!\]]+$/g, '')
    .replace(/#.*$/, '')
    .replace(/:\d+(-\d+)?(,\d+(-\d+)?)*$/, '')
    .replace(/\\/g, '/');
// голое имя без папки проверяется только у кода и документов (render.ps1, BRAND.md): description.txt, thumbnail.png и т. п. —
// файлы, которые пишут скрипты в out/<id>/; относительные импорты из примеров кода (../template/x) — не пути документа
const looksLikePath = (t) =>
  !SKIP.test(t) && !/^\.[a-z0-9]+$/i.test(t) && !t.startsWith('../') && (t.includes('/') ? /^[\p{L}\p{N}._-]+(\/[\p{L}\p{N}._ -]*)+$/u.test(t) : /\.(mjs|cjs|js|ts|tsx|ps1|py|md)$/i.test(t));
const exists = (t, docDir) => {
  if (GENERATED.test(t)) return true;
  if (!t.includes('/')) return bases(docDir).some((b) => fs.existsSync(path.join(b, t))) || names.has(t);
  const first = t.replace(/^\.\//, '').split('/')[0];
  const roots = bases(docDir).filter((b) => first === '..' || first === '.' || fs.existsSync(path.join(b, first)));
  if (!roots.length) return true; // первое слово не папка проекта — это не путь («ads/features», «и/или»)
  return roots.some((b) => fs.existsSync(path.join(b, t)));
};

const problems = [];
let checked = 0;
for (const doc of docs) {
  const text = fs.readFileSync(doc, 'utf8');
  const docDir = path.dirname(doc);
  const lines = text.split(/\r?\n/);
  let fence = false;
  lines.forEach((line, i) => {
    if (/^\s*```/.test(line)) fence = !fence;
    const spans = fence ? [line] : [...line.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    for (const span of spans)
      for (const raw of span.split(/\s+/)) {
        const t = clean(raw);
        if (!t || !looksLikePath(t)) continue;
        checked++;
        if (!exists(t, docDir)) problems.push({doc, line: i + 1, t});
      }
    if (fence) return;
    for (const m of line.matchAll(/\]\(([^)\s]+)\)/g)) {
      const t = clean(m[1]);
      if (!t || SKIP.test(t)) continue;
      checked++;
      if (!fs.existsSync(path.resolve(docDir, t)) && !exists(t, docDir)) problems.push({doc, line: i + 1, t, link: true});
    }
  });
}

const rel = (f) => path.relative(ROOT, f).replace(/\\/g, '/');
console.log(`doc-check: документов ${docs.length}, путей проверено ${checked}, не найдено ${problems.length}`);
for (const p of problems) console.log(`  ${rel(p.doc)}:${p.line} — ${p.link ? 'ссылка' : 'путь'} «${p.t}» не найден`);
process.exit(strict && problems.length ? 1 : 0);
