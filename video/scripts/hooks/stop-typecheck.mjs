// Хук Claude Code «Stop» (.claude/settings.json): перед тем как закончить ход, проверить типы, если в рабочем дереве
// изменены .ts/.tsx в video/src. Ошибки возвращаются модели (decision: block) — ход не закончится со сломанной сборкой.
// Те же файлы с теми же датами уже проверены и чисты — не гоняет tsc повторно (отпечаток в node_modules/.cache).
// Заодно — слои импортов (scripts/check-layers.mjs --strict): новое нарушение тоже блокирует ход и видно пользователю
// (systemMessage); чистым (отпечаток в кэше) считается только ход без ошибок типов и без нарушений слоёв.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const input = (() => {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
  } catch {
    return {};
  }
})();
if (input.stop_hook_active) process.exit(0); // уже продолжаем из-за этого хука — не зацикливаться

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const git = spawnSync('git', ['status', '--porcelain', '--untracked-files=all', '--', 'video/src'], {cwd: root, encoding: 'utf8'});
const files = git.stdout
  .split('\n')
  .map((l) => l.slice(3).trim())
  .filter((f) => /\.(ts|tsx)$/.test(f) && fs.existsSync(path.join(root, f)));
if (!files.length) process.exit(0);

const stamp = files.map((f) => `${f}:${fs.statSync(path.join(root, f)).mtimeMs}`).sort().join('|');
const cacheFile = path.join(root, 'video', 'node_modules', '.cache', 'stop-typecheck.json');
const last = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')).stamp : '';
if (stamp === last) process.exit(0);

const tsc = spawnSync('npx tsc --noEmit -p .', {cwd: path.join(root, 'video'), encoding: 'utf8', shell: true});
const out = `${tsc.stdout}${tsc.stderr}`.split('\n').filter((l) => /error TS/.test(l));
// слои: --strict --quiet печатает только новые нарушения и выходит с кодом 1, если они есть
const check = spawnSync(process.execPath, [path.join(root, 'video', 'scripts', 'check-layers.mjs'), '--strict', '--quiet'], {cwd: path.join(root, 'video'), encoding: 'utf8'});
const layers = check.status ? check.stdout.trim() || check.stderr.trim() || `check-layers: код выхода ${check.status}` : '';
if (!out.length && !layers) {
  fs.mkdirSync(path.dirname(cacheFile), {recursive: true});
  fs.writeFileSync(cacheFile, JSON.stringify({stamp}));
  process.exit(0);
}
if (!out.length) {
  const reason = `Слои импортов нарушены (node scripts/check-layers.mjs --strict) — исправь до конца хода:\n${layers}`;
  console.log(JSON.stringify({decision: 'block', reason, systemMessage: layers}));
  process.exit(0);
}
console.log(JSON.stringify({decision: 'block', reason: `Проверка типов (npx tsc --noEmit в video/) нашла ошибки — исправь до конца хода:\n${out.slice(0, 15).join('\n')}${out.length > 15 ? `\n… и ещё ${out.length - 15}` : ''}${layers ? `\n\n${layers}` : ''}`}));
