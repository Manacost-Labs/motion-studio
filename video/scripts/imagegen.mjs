// Одна картинка через imagegen в Codex CLI (подписка ChatGPT: без поштучной оплаты, но с лимитами подписки) — основной путь
// для статики с 10.10.2026 вместо GPT Image в Higgsfield.
//   node scripts/imagegen.mjs "<промпт>" --out <файл.png> [--ref <картинка> …] [--aspect 3:2|2:3|1:1] [--force] [--timeout 300]
// Codex кладёт результат в ~/.codex/generated_images/<сессия>/ — скрипт находит его по thread_id из событий `codex exec --json`
// и копирует в --out. Файл в public/lib/ → запись в public/lib/manifest.json (модель, промпт, размер, сессия, дата); ассет в другой
// папке public/ — строка в ASSETS.md руками. Нельзя: интерфейс, текст и цифры сайта и игры (нейросеть их искажает — только
// настоящие снимки), чужие персонажи и логотипы. Готовый --out не перезаписывается без --force (лимит подписки не тратится зря).
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {userPath, VIDEO} from './lib/paths.mjs';

const args = process.argv.slice(2);
const opt = (k) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const refs = args.flatMap((a, i) => (a === '--ref' ? [userPath(args[i + 1])] : []));
const flagged = new Set(args.flatMap((a, i) => (['--out', '--ref', '--aspect', '--timeout'].includes(a) ? [i, i + 1] : a.startsWith('--') ? [i] : [])));
const prompt = args.find((a, i) => !flagged.has(i));
const out = opt('out') && userPath(opt('out'));
const aspect = opt('aspect') ?? '3:2';
const timeoutSec = Number(opt('timeout') ?? 300);

if (!prompt || !out) {
  console.error('node scripts/imagegen.mjs "<промпт>" --out <файл.png> [--ref <картинка> …] [--aspect 3:2|2:3|1:1] [--force]');
  process.exit(1);
}
if (!['3:2', '2:3', '1:1'].includes(aspect)) throw new Error(`--aspect: 3:2, 2:3 или 1:1 (у модели три размера), а не ${aspect}`);
if (fs.existsSync(out) && !args.includes('--force')) {
  console.error(`✗ ${path.relative(VIDEO, out)} уже есть — перезаписать: --force`);
  process.exit(1);
}
for (const r of refs) if (!fs.existsSync(r)) throw new Error(`референс не найден: ${r}`);

// codex — npm-пакет; запускаем его JS напрямую через node: .cmd без shell Node не запускает, а через shell ломаются кавычки промпта
const CODEX = path.join(process.env.APPDATA ?? path.join(os.homedir(), 'AppData/Roaming'), 'npm/node_modules/@openai/codex/bin/codex.js');
if (!fs.existsSync(CODEX)) throw new Error(`нет Codex CLI (${CODEX}): npm i -g @openai/codex, затем codex login`);

const task =
  `Use your image generation tool to create exactly one image${refs.length ? ', using the attached image(s) as reference' : ''}, ` +
  `then reply with one short line. Do not run shell commands or write files. Aspect ratio ${aspect}. Image: ${prompt}`;

// read-only: Codex не трогает файлы, картинку забираем сами; папка запуска — временная, чтобы он не читал проект
const child = spawn(process.execPath, [CODEX, 'exec', '--json', '--skip-git-repo-check', '-s', 'read-only', ...refs.flatMap((r) => ['-i', r]), task], {
  cwd: os.tmpdir(),
  stdio: ['ignore', 'pipe', 'pipe'],
});
const timer = setTimeout(() => child.kill(), timeoutSec * 1000);
let thread = null;
let said = '';
let failed = '';
let buf = '';
child.stdout.on('data', (d) => {
  buf += d;
  for (let n; (n = buf.indexOf('\n')) >= 0; buf = buf.slice(n + 1)) {
    const line = buf.slice(0, n).trim();
    if (!line) continue;
    const e = JSON.parse(line);
    if (e.type === 'thread.started') thread = e.thread_id;
    if (e.type === 'item.completed' && e.item?.type === 'agent_message') said = e.item.text.trim();
    if (e.type === 'turn.failed' || e.type === 'error') failed = e.error?.message ?? e.message ?? JSON.stringify(e);
  }
});
let err = '';
child.stderr.on('data', (d) => (err += d));
const code = await new Promise((resolve) => child.on('close', resolve));
clearTimeout(timer);

const dir = thread && path.join(os.homedir(), '.codex', 'generated_images', thread);
const made = dir && fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.png')).map((f) => path.join(dir, f)) : [];
if (!made.length) {
  console.error(`✗ картинки нет (код ${code}${thread ? `, сессия ${thread}` : ''})${failed ? `: ${failed}` : ''}${said ? `\n  Codex: ${said}` : ''}`);
  if (!thread) console.error(err.trim().split('\n').slice(-3).join('\n'));
  process.exit(1);
}
const src = made.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
fs.mkdirSync(path.dirname(out), {recursive: true});
fs.copyFileSync(src, out);

// размер — из заголовка PNG (IHDR), без ffprobe
const head = fs.readFileSync(out).subarray(16, 24);
const [width, height] = [head.readUInt32BE(0), head.readUInt32BE(4)];
console.log(`✓ ${path.relative(VIDEO, out)} — ${width}×${height}, сессия Codex ${thread}`);

const LIB = path.join(VIDEO, 'public', 'lib');
const rel = path.relative(LIB, out).replace(/\\/g, '/');
if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
  const MANIFEST = path.join(LIB, 'manifest.json');
  const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {};
  manifest[rel] = {
    category: rel.split('/')[0],
    model: 'codex-imagegen',
    thread,
    width,
    height,
    date: new Date().toISOString().slice(0, 10),
    prompt,
    ...(refs.length ? {refs: refs.map((r) => path.relative(VIDEO, r).replace(/\\/g, '/'))} : {}),
  };
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
  console.log(`  записано в public/lib/manifest.json: ${rel}`);
} else console.log('  вне public/lib: если ассет пойдёт в ролик — строка в ASSETS.md');
