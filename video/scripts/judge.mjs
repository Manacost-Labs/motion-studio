// Смысловой судья ролика: node scripts/judge.mjs <id> [--checks matchups,points,facts,cards] [--scenes deck-01,deck-02]
//                         [--backend agent|jev|claude|off] [--model <модель>] [--strict] [--dry]
// Задаёт вопросы J1–J4 из src/studios/manacost-youtube/judge.ts (матч-апы, тезисы, фразы диктора ↔ статья; карты и обводки ↔
// текст) и применяет пороги (JUDGE в том же judge.ts). Внутренний контракт — формат TypeSafe System One:
// {model, state, questions} → {answers, backend, model, usage}; бэкенды взаимозаменяемы:
//   agent  (по умолчанию) — без ключей: пишет out/<id>/judge-pending.json (вопросы + инструкция), сессия Claude Code отвечает
//          в out/<id>/judge-answers.json, повторный запуск собирает отчёт;
//   jev    — TypeSafe JEV (https://api.typesafe.ai/v1/systemone), ключ TYPESAFE_API_KEY в video/.env;
//   claude — Anthropic Messages API, ключ ANTHROPIC_API_KEY в video/.env, ответ в той же схеме вероятностей;
//   off    — явный пропуск (release.mjs примет его как «пропущено»).
// Нет ключа или сервис недоступен — «смысловые проверки пропущены», код 0. --dry — собрать запросы без отправки
// (out/<id>/judge-dry.json, оценка объёма). Кэш ответов — out/judge-cache/<sha256>.json: повтор бесплатен и тот же.
// Отправляется только публичный текст статьи и сценария. Пишет out/<id>/judge.json и judge-report.md.
// Код выхода 0 (предупреждения — в отчёте), 1 — только с --strict при ❌. Из хуков (pre-commit, Stop) не вызывать.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {hasKey, loadEnv} from './lib/env.mjs';
import {VIDEO} from './lib/paths.mjs';
import {openComposition, quietFonts} from './lib/remotion.mjs';
import {findVideo, studioDir} from './lib/studios.mjs';

process.chdir(VIDEO);
quietFonts();
const args = process.argv.slice(2);
const id = args[0];
const opt = (n) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : undefined);
const flag = (n) => args.includes(`--${n}`);
if (!id || id.startsWith('--')) throw new Error('node scripts/judge.mjs <id> [--checks matchups,points,facts,cards] [--scenes deck-01] [--backend agent|jev|claude|off] [--model …] [--strict] [--dry]');
const backend = opt('backend') ?? 'agent';
if (!['agent', 'jev', 'claude', 'off'].includes(backend)) throw new Error(`--backend: agent, jev, claude или off (получено «${backend}»)`);
const MODELS = {agent: 'claude-code-session', jev: 'jev-1.13.0', claude: 'claude-opus-5-5', off: '-'};
const model = opt('model') ?? MODELS[backend];
const outDir = path.resolve('out', id);
fs.mkdirSync(outDir, {recursive: true});
const files = {json: path.join(outDir, 'judge.json'), report: path.join(outDir, 'judge-report.md'), pending: path.join(outDir, 'judge-pending.json'), answers: path.join(outDir, 'judge-answers.json'), dry: path.join(outDir, 'judge-dry.json')};
const cacheDir = path.resolve('out', 'judge-cache');
const rel = (f) => path.relative(process.cwd(), f);
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

// Явный пропуск: judge.json с причиной — release.mjs отличает его от «не запускали»
const skip = (reason) => {
  fs.writeFileSync(files.json, JSON.stringify({id, date: new Date().toISOString(), backend, model, skipped: true, reason}, null, 1) + '\n');
  console.log(`смысловые проверки пропущены: ${reason}\n→ ${rel(files.json)}`);
  process.exit(0);
};
if (backend === 'off' && !flag('dry')) skip('--backend off');

// ── Вопросы ──
const {key, composition} = await openComposition(id, {fallback: 'youtube', logLevel: 'error'});
const {config} = /** @type {{config: any}} */ (composition.props);
const own = (() => {
  try {
    return findVideo(id);
  } catch {
    return null;
  }
})();
const articleFile = own && path.join(own.dir, 'article.json');
const article = articleFile && fs.existsSync(articleFile) ? JSON.parse(fs.readFileSync(articleFile, 'utf8')) : null;
const judgeOut = path.resolve('node_modules/.cache', 'judge.cjs');
await build({entryPoints: [path.join(studioDir(key), 'judge.ts')], bundle: true, platform: 'node', format: 'cjs', outfile: judgeOut, logLevel: 'error'});
const J = createRequire(import.meta.url)(judgeOut);
const checks = opt('checks')?.split(',').filter(Boolean) ?? J.CHECKS;
const bad = checks.filter((c) => !J.CHECKS.includes(c));
if (bad.length) throw new Error(`--checks: ${bad.join(', ')} — есть ${J.CHECKS.join(', ')}`);
const scenes = opt('scenes')?.split(',').filter(Boolean);
const requests = J.buildRequests(config, article, {checks, scenes}).map((r) => ({...r, key: sha(JSON.stringify({state: r.state, questions: r.questions})).slice(0, 16)}));
if (!requests.length) skip(`нет вопросов (сцены колод${scenes ? ` ${scenes.join(', ')}` : ''} без vs/points/cards${article ? '' : ', нет article.json'})`);
const nq = requests.reduce((n, r) => n + Object.keys(r.questions).length, 0);
const chars = requests.reduce((n, r) => n + JSON.stringify({state: r.state, questions: r.questions}).length, 0);
console.log(`${id}: ${requests.length} запросов (${new Set(requests.map((r) => r.seg)).size} сцен, ${nq} вопросов), проверки ${checks.join(', ')}${article ? '' : ' — без article.json: только тезисы и карты'}`);

if (flag('dry')) {
  // оценка: русский текст ≈ 2,5 символа на токен; JEV — $0.042 за 1 млн входных токенов
  const tokens = Math.round(chars / 2.5);
  fs.writeFileSync(files.dry, JSON.stringify({id, backend, model, requests: requests.map(({key, seg, run, state, questions}) => ({key, seg, run, model, state, questions}))}, null, 1) + '\n');
  const keyName = {jev: 'TYPESAFE_API_KEY', claude: 'ANTHROPIC_API_KEY'}[backend];
  console.log(`--dry: ничего не отправлено. ≈ ${tokens} входных токенов${backend === 'jev' ? ` (≈ $${((tokens / 1e6) * 0.042).toFixed(4)})` : ''}${keyName ? `; ключ ${keyName}: ${hasKey(keyName) ? 'есть' : 'нет'}` : ''}\n→ ${rel(files.dry)}`);
  process.exit(0);
}

// ── Бэкенды: запрос {model, state, questions} → {answers, usage} ──
const cached = (r) => path.join(cacheDir, `${sha(`${backend}\n${model}\n${JSON.stringify(r.state)}\n${JSON.stringify(r.questions)}`)}.json`);
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
class Unavailable extends Error {}

// повтор на 429/529 (и 5xx) с бэкоффом, таймаут 30 с; 401/403 — ключ не подошёл (пропуск всего), 422 и прочее — ошибка запроса
const post = async (url, headers, body, name) => {
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetch(url, {method: 'POST', headers: {'content-type': 'application/json', ...headers}, body: JSON.stringify(body), signal: AbortSignal.timeout(30000)});
    } catch (e) {
      if (attempt < 4) {
        await sleep(500 * 2 ** attempt);
        continue;
      }
      throw new Unavailable(`${name} недоступен: ${e.name === 'TimeoutError' ? 'нет ответа 30 с' : e.message}`);
    }
    if (res.ok) return res.json();
    const text = (await res.text()).slice(0, 300);
    if ([429, 529].includes(res.status) || res.status >= 500) {
      if (attempt < 4) {
        await sleep(Number(res.headers.get('retry-after')) * 1000 || 500 * 2 ** attempt);
        continue;
      }
      throw new Unavailable(`${name}: ${res.status} после 5 попыток`);
    }
    if (res.status === 401 || res.status === 403) throw new Unavailable(`${name}: ключ не подошёл (${res.status})`);
    throw new Error(`${name}: ${res.status} ${text}`);
  }
};

const askJev = async (r) => {
  const res = await post('https://api.typesafe.ai/v1/systemone', {authorization: `Bearer ${loadEnv().TYPESAFE_API_KEY.trim()}`}, {model, state: r.state, questions: r.questions}, 'TypeSafe JEV');
  return {answers: res.answers ?? {}, usage: res.usage ?? null};
};

// Claude отвечает в схеме System One: noul — {noul: p}, choice — {probabilities: {вариант: p}}; схема ответа строгая (json_schema)
const askClaude = async (r) => {
  const schema = {
    type: 'object',
    additionalProperties: false,
    required: Object.keys(r.questions),
    properties: Object.fromEntries(
      Object.entries(r.questions).map(([k, q]) => [
        k,
        q.type === 'noul'
          ? {type: 'object', additionalProperties: false, required: ['noul'], properties: {noul: {type: 'number'}}}
          : {type: 'object', additionalProperties: false, required: ['probabilities'], properties: {probabilities: {type: 'object', additionalProperties: false, required: Object.keys(q.criteria), properties: Object.fromEntries(Object.keys(q.criteria).map((o) => [o, {type: 'number'}]))}}},
      ]),
    ),
  };
  const system =
    'You are a typed judge in the style of TypeSafe System One. You get STATE (Russian text) and QUESTIONS. Judge only by STATE, never by outside knowledge. ' +
    'For a "noul" question return the probability (0..1) that its statement is true (criteria.true / criteria.false, if given, define the two sides). ' +
    'For a "choice" question return a calibrated probability for every option key in criteria; they must sum to 1. Do not favour the first option.';
  const res = await post(
    'https://api.anthropic.com/v1/messages',
    {'x-api-key': loadEnv().ANTHROPIC_API_KEY.trim(), 'anthropic-version': '2023-06-01', 'anthropic-beta': 'server-side-fallback-2026-07-01'},
    {model, max_tokens: 16000, fallbacks: 'default', output_config: {effort: 'low', format: {type: 'json_schema', schema}}, system, messages: [{role: 'user', content: JSON.stringify({state: r.state, questions: r.questions})}]},
    'Anthropic API',
  );
  if (res.stop_reason === 'refusal') throw new Error(`Anthropic API: отказ (${res.stop_details?.category ?? '?'})`);
  const text = res.content.find((b) => b.type === 'text')?.text ?? '{}';
  return {answers: JSON.parse(text), usage: res.usage ?? null};
};

// ── Ответы ──
const got = new Map(); // key → {answers, usage}
let pendingList = [];
if (backend === 'agent') {
  const answered = fs.existsSync(files.answers) ? JSON.parse(fs.readFileSync(files.answers, 'utf8')).answers ?? {} : {};
  for (const r of requests) if (answered[r.key]) got.set(r.key, {answers: answered[r.key], usage: null});
  pendingList = requests.filter((r) => !got.has(r.key));
  if (pendingList.length) {
    const how = [
      'Ты — судья. Для каждого запроса прочитай state (deck, vo — текст диктора, article_section — раздел статьи-источника) и ответь на все questions,',
      'опираясь ТОЛЬКО на state. noul — вероятность 0..1, что statement верно для данных instructions. choice — вероятности для каждого ключа criteria',
      '(в сумме 1; не отдавай предпочтение первому варианту). Запиши ответы в out/<id>/judge-answers.json:',
      '{"model": "<кто отвечал>", "answers": {"<key запроса>": {"<id вопроса>": {"noul": 0.93} | {"probabilities": {"says_nothing": 0.1, "contradicts": 0.0, "supports": 0.9}}}}}',
      'Ответы, которые уже есть в файле, не трогать — дописать недостающие ключи. Затем снова запустить node scripts/judge.mjs <id> с теми же --checks/--scenes.',
    ].join(' ');
    fs.writeFileSync(files.pending, JSON.stringify({id, created: new Date().toISOString(), how: how.replace(/<id>/g, id), answersFile: rel(files.answers), requests: pendingList.map(({key, seg, run, state, questions}) => ({key, seg, run, state, questions}))}, null, 1) + '\n');
  } else if (fs.existsSync(files.pending)) fs.rmSync(files.pending);
} else {
  const keyName = {jev: 'TYPESAFE_API_KEY', claude: 'ANTHROPIC_API_KEY'}[backend];
  const allCached = requests.every((r) => fs.existsSync(cached(r)));
  if (!allCached && !hasKey(keyName)) skip(`нет ${keyName} в video/.env (бэкенд ${backend}); без ключей — --backend agent`);
  fs.mkdirSync(cacheDir, {recursive: true});
  try {
    for (const r of requests) {
      const c = cached(r);
      if (fs.existsSync(c)) {
        got.set(r.key, JSON.parse(fs.readFileSync(c, 'utf8')));
        continue;
      }
      const res = backend === 'jev' ? await askJev(r) : await askClaude(r);
      fs.writeFileSync(c, JSON.stringify({...res, backend, model}, null, 1) + '\n');
      got.set(r.key, res);
    }
  } catch (e) {
    if (e instanceof Unavailable) skip(e.message);
    throw e;
  }
}

// ── Итог: прогоны main и swap одного вопроса усредняются; уровни — по порогам JUDGE ──
const results = [];
for (const seg of [...new Set(requests.map((r) => r.seg))]) {
  const rs = requests.filter((r) => r.seg === seg);
  const main = rs.find((r) => r.run === 'main');
  for (const qid of Object.keys(main.questions)) {
    const runs = rs.map((r) => got.get(r.key)?.answers?.[qid]).filter(Boolean);
    const about = main.about[qid];
    if (!runs.length) {
      results.push({seg, title: main.title, qid, ...about, level: 'pending', what: 'ждёт ответа'});
      continue;
    }
    let answer = runs[0];
    let unstable = false;
    if (main.questions[qid].type === 'choice') {
      const ps = runs.map(J.probsOf);
      const opts = Object.keys(main.questions[qid].criteria);
      const avg = Object.fromEntries(opts.map((o) => [o, ps.reduce((n, p) => n + (p[o] ?? 0), 0) / ps.length]));
      const tops = ps.map((p) => Object.entries(p).sort((a, b) => b[1] - a[1])[0]?.[0]);
      unstable = new Set(tops).size > 1;
      answer = {probabilities: avg};
    }
    const v = J.verdict(qid, about, answer);
    results.push({seg, title: main.title, qid, ...about, level: v.level, what: v.what + (unstable ? ' · прогоны с переставленными вариантами разошлись' : ''), answer});
  }
}
const count = (l) => results.filter((x) => x.level === l).length;
const icon = {error: '❌', warn: '⚠️', info: 'ℹ️', ok: '✅', pending: '…'};
const answeredBy = backend === 'agent' && fs.existsSync(files.answers) ? JSON.parse(fs.readFileSync(files.answers, 'utf8')).model ?? model : model;
const usage = [...got.values()].map((g) => g.usage).filter(Boolean);
const summary = `❌ ${count('error')} · ⚠️ ${count('warn')} · ℹ️ ${count('info')} · ✅ ${count('ok')}${count('pending') ? ` · ждут ответа ${count('pending')}` : ''}`;
const lines = [
  `# Смысловая проверка «${config.title}»`,
  '',
  `Бэкенд: ${backend} (${answeredBy}) · проверки: ${checks.join(', ')}${scenes ? ` · сцены: ${scenes.join(', ')}` : ''} · ${new Date().toLocaleString('ru-RU')}`,
  `Итог: ${summary}`,
  '',
  'J1 матч-ап ↔ раздел статьи · J2 тезис ↔ текст диктора и статья · J3 фраза диктора ↔ статья (флажок только на «противоречит») · J4 карта ↔ фраза, обводка ↔ «главная».',
  'Судья ошибается: ⚠ — повод перечитать, не приговор. Числа и даты сверяются кодом, не судьёй.',
  '',
  ...[...new Set(results.map((x) => x.seg))].flatMap((seg) => {
    const rs = results.filter((x) => x.seg === seg);
    return [`## ${seg} — ${rs[0].title}`, '', ...rs.map((x) => `- ${icon[x.level]} ${x.label} «${x.shown}» — ${x.what}`), ''];
  }),
];
fs.writeFileSync(files.report, lines.join('\n'));
fs.writeFileSync(files.json, JSON.stringify({id, date: new Date().toISOString(), backend, model: answeredBy, checks, scenes: scenes ?? null, requests: requests.length, answered: got.size, pending: pendingList.length, counts: {error: count('error'), warn: count('warn'), info: count('info'), ok: count('ok'), pending: count('pending')}, usage, results}, null, 1) + '\n');
console.log(`Итог: ${summary}`);
for (const x of results.filter((r) => r.level === 'error' || r.level === 'warn')) console.log(`${icon[x.level]} ${x.seg} ${x.label} «${x.shown}»: ${x.what}`);
if (pendingList.length)
  console.log(`\nЖдут ответа ${pendingList.length} из ${requests.length} запросов → ${rel(files.pending)}\nДальше: сессия Claude Code читает ${rel(files.pending)}, отвечает в ${rel(files.answers)} (формат — поле how) и снова запускает judge.mjs`);
console.log(`→ ${rel(files.report)}, ${rel(files.json)}`);
process.exit(flag('strict') && count('error') ? 1 : 0);
