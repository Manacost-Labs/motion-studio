// Несколько дублей только для ключевых фраз (начало, объявление №1, финал): каждый кусок пишется 2–3 раза,
// скрипт мерит дубли и берёт лучший. Весь ролик заново не записываем — кредиты тратятся только на важное.
//   1) node scripts/vo-align.mjs <id> --prepare --only hook,deck-01,outro   → out/<id>/vo-raw/chunk-<n>.txt
//   2) каждый кусок записать 2–3 раза (коннектор ElevenLabs, generations_count 1, тот же текст) и сохранить как
//      out/<id>/vo-raw/chunk-<n>.take-1.mp3, chunk-<n>.take-2.mp3 … (подойдут и .wav)
//   3) node scripts/vo-takes.mjs <id> [--dry]  — мерки и выбор; лучший дубль копируется в chunk-<n>.mp3 (или .wav)
//      (прежний chunk-<n>.* сохраняется как chunk-<n>.prev.*; --dry — только отчёт), затем vo-align.mjs <id>
// Как выбирает: дубль с поднятым голосом (высота выше обычной для ролика на 15 % и больше — так звучит крик, ears.py)
// отбрасывается; из остальных — меньше слов, распознанных непохоже на текст (оговорки, проглоченные слова);
// при равенстве — высота ближе к обычной для ролика (ровная подача), затем больше пауз. Пишет vo-raw/takes-report.md.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {VIDEO} from './lib/paths.mjs';
import {align, lev, readWords, tokens} from './vo-lib.mjs';

process.chdir(VIDEO);
const args = process.argv.slice(2);
const id = args[0];
if (!id || id.startsWith('--')) throw new Error('node scripts/vo-takes.mjs <id> [--dry]');
const raw = path.resolve('out', id, 'vo-raw');
const py = path.resolve('.venv-vo/Scripts/python.exe');
if (!fs.existsSync(py)) throw new Error('Нет .venv-vo: python -m venv .venv-vo && .venv-vo/Scripts/python -m pip install -r requirements.txt');
const env = {...process.env, PYTHONIOENCODING: 'utf-8', HF_HUB_DISABLE_SYMLINKS_WARNING: '1'};
const AUDIO = /\.(mp3|wav)$/;

const takes = fs.existsSync(raw) ? fs.readdirSync(raw).filter((f) => /^chunk-\d+\.take-\d+\.(mp3|wav)$/.test(f)) : [];
if (!takes.length) throw new Error(`нет дублей в ${raw}: нужны chunk-<n>.take-<k>.mp3 или .wav (см. начало скрипта)`);
const byChunk = Map.groupBy(takes, (f) => f.match(/^chunk-(\d+)/)[1]);

// мерки голоса (ears.py --metrics): высота, разброс, паузы
const measure = (files) => {
  const r = spawnSync(py, ['scripts/ears.py', '--metrics', ...files], {encoding: 'utf8', env, maxBuffer: 1 << 26});
  if (r.status) throw new Error(`ears.py: ${r.stderr.slice(-500)}`);
  return r.stdout.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
};

// обычная высота голоса ролика — медиана по уже записанным сценам (public/vo/<id>); если их нет — по самим дублям
const voDir = path.resolve('public', 'vo', id);
const scenes = fs.existsSync(voDir) ? fs.readdirSync(voDir).filter((f) => AUDIO.test(f)).map((f) => path.join(voDir, f)) : [];
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const sceneF0 = scenes.length ? measure(scenes).map((m) => m.f0).filter(Boolean) : [];

// распознавание дублей (vo-words.py, faster-whisper) — одним запуском модели
const textOf = (n) => fs.readFileSync(path.join(raw, `chunk-${n}.txt`), 'utf8');
const jobs = takes.map((f) => ({audio: path.join(raw, f), out: path.join(raw, f.replace(AUDIO, '.words.json')), hint: textOf(f.match(/^chunk-(\d+)/)[1]).replace(/\[[^\]]*\]/g, ' ')}));
const todo = jobs.filter((j) => !fs.existsSync(j.out) || fs.statSync(j.out).mtimeMs < fs.statSync(j.audio).mtimeMs);
if (todo.length) {
  fs.writeFileSync(path.join(raw, 'takes-jobs.json'), JSON.stringify(todo));
  const r = spawnSync(py, ['scripts/vo-words.py', path.join(raw, 'takes-jobs.json'), '--model', 'small'], {stdio: ['ignore', 'inherit', 'pipe'], env});
  if (r.status) throw new Error(`vo-words.py: ${r.stderr?.toString().slice(-500)}`);
}

// слова текста, услышанные непохоже или не услышанные вовсе (склейка соседних — как в yt-qa: имена дробятся)
const slips = (text, wordsFile) => {
  const toks = tokens(text.replace(/\[[^\]]*\]/g, ' '));
  const heard = readWords(wordsFile);
  const m = align(toks, heard);
  const close = (a, b) => (a.length >= 5 && b.length >= 5 && a.slice(0, 4) === b.slice(0, 4)) || 1 - lev(a, b) / Math.max(a.length, b.length) >= 0.75;
  const out = [];
  toks.forEach((t, i) => {
    if (m[i] >= 0 && close(t.w, heard[m[i]].w)) return;
    let p = i - 1;
    while (p >= 0 && m[p] < 0) p--;
    let q = i + 1;
    while (q < m.length && m[q] < 0) q++;
    const gap = heard.slice(p >= 0 ? m[p] : 0, q < m.length ? m[q] + 1 : heard.length).map((h) => h.w).join('');
    if (m[i] < 0 && gap.includes(t.w)) return;
    out.push(`«${t.w}»→«${m[i] >= 0 ? heard[m[i]].text : '—'}»`);
  });
  return out;
};

const lines = [`# Дубли «${id}»`, ''];
for (const [n, files] of byChunk) {
  const ms = measure(files.map((f) => path.join(raw, f)));
  const ref = sceneF0.length ? median(sceneF0) : median(ms.map((m) => m.f0));
  const rows = files.map((f, k) => {
    const s = slips(textOf(n), path.join(raw, f.replace(AUDIO, '.words.json')));
    return {f, ...ms[k], slips: s, loud: ms[k].f0 > ref * 1.15};
  });
  const ok = rows.filter((r) => !r.loud);
  const pool = ok.length ? ok : rows; // все с поднятым голосом — берём наименее поднятый, но предупреждаем
  const best = [...pool].sort((a, b) => a.slips.length - b.slips.length || Math.abs(a.f0 - ref) - Math.abs(b.f0 - ref) || b.pauses - a.pauses)[0];
  lines.push(`## chunk-${n} — обычная высота голоса ролика ${ref.toFixed(0)} Гц`, '', '| дубль | с | высота, Гц | разброс, пт | пауз | непохоже услышано | |', '|---|---|---|---|---|---|---|');
  for (const r of rows)
    lines.push(`| ${r.f} | ${r.dur.toFixed(1)} | ${r.f0.toFixed(0)}${r.loud ? ' (поднят)' : ''} | ${r.spread.toFixed(1)} | ${r.pauses} | ${r.slips.length}${r.slips.length ? ': ' + r.slips.slice(0, 5).join(' ') : ''} | ${r === best ? '**выбран**' : ''} |`);
  if (!ok.length) lines.push('', '⚠ во всех дублях голос поднят — лучше перезаписать спокойнее ([warmly] / [curious], без [excited])');
  lines.push('');
  if (!args.includes('--dry')) {
    const ext = best.f.match(AUDIO)[1];
    // прежняя запись куска (любого формата) → chunk-<n>.prev.*; другой формат убираем, чтобы vo-align взял выбранный дубль
    for (const e of ['mp3', 'wav']) {
      const old = path.join(raw, `chunk-${n}.${e}`);
      if (!fs.existsSync(old)) continue;
      fs.copyFileSync(old, path.join(raw, `chunk-${n}.prev.${e}`));
      if (e !== ext) fs.rmSync(old);
    }
    const dst = path.join(raw, `chunk-${n}.${ext}`);
    fs.copyFileSync(path.join(raw, best.f), dst);
    fs.utimesSync(dst, new Date(), new Date()); // Windows сохраняет дату копии — vo-align по ней решает, распознавать ли заново
  }
}
lines.push(args.includes('--dry') ? 'Пробный запуск (--dry): ничего не скопировано.' : `Лучшие дубли скопированы в chunk-<n>.mp3 / .wav (формат дубля). Дальше: node scripts/vo-align.mjs ${id}`);
fs.writeFileSync(path.join(raw, 'takes-report.md'), lines.join('\n') + '\n');
console.log(lines.join('\n'));
