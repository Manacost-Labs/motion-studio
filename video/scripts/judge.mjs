// Смысловой судья ролика: node scripts/judge.mjs <id> [--checks matchups,points,facts,cards] [--scenes deck-01,deck-02]
//                         [--backend agent|jev|claude|openrouter|off] [--model <модель>] [--strict] [--dry] [--yes]
// Визуальный критик:      node scripts/judge.mjs <id> --visual [--model clef-omni|clef|clef-flash] [--scenes hook,deck-01]
//                         [--at 0.1,0.32,0.55,0.78,0.96] [--batch 1–4] [--yes]
// Задаёт вопросы J1–J4 из src/studios/manacost-youtube/judge.ts (матч-апы, тезисы, фразы диктора ↔ статья; карты и обводки ↔
// текст) и применяет пороги (JUDGE в том же judge.ts). Внутренний контракт — формат TypeSafe System One:
// {model, state, questions} → {answers, backend, model, usage}; бэкенды взаимозаменяемы:
//   agent  (по умолчанию) — без ключей: пишет out/<id>/judge-pending.json (вопросы + инструкция), сессия Claude Code отвечает
//          в out/<id>/judge-answers.json, повторный запуск собирает отчёт;
//   jev    — TypeSafe JEV напрямую (https://api.typesafe.ai/v1/systemone), ключ TYPESAFE_API_KEY в video/.env;
//   openrouter — решающие модели через OpenRouter Decisions API (scripts/lib/openrouter.mjs), ключ OPENROUTER_API_KEY:
//          --model jev (по умолчанию, typesafe/jev-1.13) | clef-flash | clef | clef-omni. Платно, поэтому сначала смета: токены ×
//          живая цена из бесплатного каталога, тела запросов (без ключа) — в out/<id>/judge-request.json; отправка — только с --yes
//          (без --yes или с --dry — ничего не отправляется). Закэшированные ответы смету не требуют;
//   claude — Anthropic Messages API, ключ ANTHROPIC_API_KEY в video/.env, ответ в той же схеме вероятностей;
//   off    — явный пропуск (release.mjs примет его как «пропущено»).
// --visual — визуальный критик (только советы ⚠, решает владелец; бэкенд openrouter, модель clef-omni): кадры раскадровки
//   out/<id>/board/ (yt-board.mjs; нет или мельче 900 px — дорисует локально в 960 px), ≤ 1024 px JPEG; на кадр — фраза диктора
//   в этот момент и вопросы: читается ли на телефоне, ясна ли иерархия, всё ли в кадре, про то ли кадр, нет ли «нейросетевого
//   почерка» (TASTE.md), оценка 0–10. Смета и --yes — как выше (тела — judge-visual-request.json, картинки там заменены
//   ссылкой на файл). → out/<id>/judge-visual.md и judge-visual.json; judge.json не трогает.
// Нет ключа или сервис недоступен — «смысловые проверки пропущены», код 0. --dry — собрать запросы без отправки
// (out/<id>/judge-dry.json, оценка объёма). Кэш ответов — out/judge-cache/<sha256>.json: повтор бесплатен и тот же.
// Отправляется только публичный текст статьи и сценария (и кадры ролика с --visual). Пишет out/<id>/judge.json и judge-report.md.
// Код выхода 0 (предупреждения — в отчёте), 1 — только с --strict при ❌. Из хуков (pre-commit, Stop) не вызывать.
import {spawnSync} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {hasKey, loadEnv} from './lib/env.mjs';
import {dims, ff} from './lib/media.mjs';
import {DECISIONS_URL, MAX_IMAGES, MAX_QUESTIONS, decisionsHeaders, estimateBody, imagePart, isImage, modelInfo, resolveModel} from './lib/openrouter.mjs';
import {VIDEO} from './lib/paths.mjs';
import {openComposition, quietFonts} from './lib/remotion.mjs';
import {findVideo, studio, studioDir} from './lib/studios.mjs';

process.chdir(VIDEO);
quietFonts();
const args = process.argv.slice(2);
const id = args[0];
const opt = (n) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : undefined);
const flag = (n) => args.includes(`--${n}`);
if (!id || id.startsWith('--')) throw new Error('node scripts/judge.mjs <id> [--checks matchups,points,facts,cards] [--scenes deck-01] [--backend agent|jev|claude|openrouter|off] [--model …] [--strict] [--dry] [--yes] | <id> --visual [--model clef-omni] [--at …] [--batch 1–4] [--yes]');
const visual = flag('visual');
const backend = opt('backend') ?? (visual ? 'openrouter' : 'agent');
if (!['agent', 'jev', 'claude', 'openrouter', 'off'].includes(backend)) throw new Error(`--backend: agent, jev, claude, openrouter или off (получено «${backend}»)`);
if (visual && backend !== 'openrouter') throw new Error('--visual — только с --backend openrouter (картинки видят модели Clef)');
const MODELS = {agent: 'claude-code-session', jev: 'jev-1.13.0', claude: 'claude-opus-5-5', openrouter: visual ? 'clef-omni' : 'jev', off: '-'};
const orModel = backend === 'openrouter' ? resolveModel(opt('model') ?? MODELS.openrouter) : null;
if (visual && orModel.image === false) throw new Error(`--visual: ${orModel.id} не видит картинок — clef-omni, clef или clef-flash`);
const model = orModel?.id ?? opt('model') ?? MODELS[backend];
const outDir = path.resolve('out', id);
fs.mkdirSync(outDir, {recursive: true});
const files = {
  json: path.join(outDir, 'judge.json'),
  report: path.join(outDir, 'judge-report.md'),
  pending: path.join(outDir, 'judge-pending.json'),
  answers: path.join(outDir, 'judge-answers.json'),
  dry: path.join(outDir, 'judge-dry.json'),
  request: path.join(outDir, 'judge-request.json'),
  visualReport: path.join(outDir, 'judge-visual.md'),
  visualJson: path.join(outDir, 'judge-visual.json'),
  visualRequest: path.join(outDir, 'judge-visual-request.json'),
  visualDir: path.join(outDir, 'judge-visual'),
};
const cacheDir = path.resolve('out', 'judge-cache');
const rel = (f) => path.relative(process.cwd(), f);
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const money = (x) => `$${x < 0.01 ? x.toFixed(5) : x.toFixed(4)}`;

// Явный пропуск: judge.json с причиной — release.mjs отличает его от «не запускали». Визуальный критик judge.json не трогает
const skip = (reason) => {
  if (!visual) fs.writeFileSync(files.json, JSON.stringify({id, date: new Date().toISOString(), backend, model, skipped: true, reason}, null, 1) + '\n');
  console.log(`${visual ? 'визуальный критик пропущен' : 'смысловые проверки пропущены'}: ${reason}${visual ? '' : `\n→ ${rel(files.json)}`}`);
  process.exit(0);
};
if (backend === 'off' && !flag('dry')) skip('--backend off');

// ── Бэкенды: запрос {model, state, questions} → {answers, usage} ──
const cached = (r) => path.join(cacheDir, `${sha(`${backend}\n${model}\n${JSON.stringify(r.state)}\n${JSON.stringify(r.questions)}`)}.json`);
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
class Unavailable extends Error {}

// повтор на 429/529 (и 5xx) с бэкоффом, таймаут 30 с; 401/403 — ключ не подошёл, 402 — нет кредитов (пропуск всего),
// 422 и прочее — ошибка запроса
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
    if (res.status === 402) throw new Unavailable(`${name}: на счёте не хватает кредитов (402) — node scripts/credits.mjs`);
    throw new Error(`${name}: ${res.status} ${text}`);
  }
};

const askJev = async (r) => {
  const res = await post('https://api.typesafe.ai/v1/systemone', {authorization: `Bearer ${loadEnv().TYPESAFE_API_KEY.trim()}`}, {model, state: r.state, questions: r.questions}, 'TypeSafe JEV');
  return {answers: res.answers ?? {}, usage: res.usage ?? null};
};

// OpenRouter Decisions API: тот же формат System One, ответы {type, noul} / {type, choice, probabilities, confidence} /
// {type, score, probabilities, legend} — в отчёт как есть; served — датированный снимок модели, который ответил
const askOpenRouter = async (r) => {
  const res = await post(DECISIONS_URL, decisionsHeaders(), {model, state: r.state, questions: r.questions}, 'OpenRouter');
  return {answers: res.answers ?? {}, usage: res.usage ?? null, served: res.model ?? null, provider: res.provider ?? null};
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

// Смета OpenRouter перед платными запросами: токены (оценка lib/openrouter.mjs) × живая цена из бесплатного каталога.
// list — [{label, body, dims?, dump?}] (dump — тело для файла, если в нём картинки заменены ссылками). Тела без ключа — в file.
// Без --yes или с --dry — только смета, код 0. Запрос больше контекста, с лишними картинками или вопросами — ошибка и с --yes
const orGate = async (list, file) => {
  const info = await modelInfo(orModel);
  const est = list.map((x) => ({...x, est: estimateBody(x.body, x.dims)}));
  const sum = (k) => est.reduce((n, x) => n + x.est[k], 0);
  const tokens = sum('total');
  const usd = tokens * info.price;
  const big = est.reduce((a, b) => (b.est.total > a.est.total ? b : a));
  const problems = [
    ...est.filter((x) => x.est.total > info.ctx).map((x) => `${x.label}: ≈ ${x.est.total} токенов больше контекста ${info.ctx}`),
    ...est.filter((x) => x.est.images > MAX_IMAGES).map((x) => `${x.label}: ${x.est.images} картинок, можно ${MAX_IMAGES}`),
    ...est.filter((x) => x.est.questions > MAX_QUESTIONS).map((x) => `${x.label}: ${x.est.questions} вопросов, можно ${MAX_QUESTIONS}`),
    ...(info.image === false ? est.filter((x) => x.est.images).map((x) => `${x.label}: ${info.id} не видит картинок`) : []),
  ];
  const warns = [
    ...(info.textCap && est.some((x) => x.est.state > info.textCap)
      ? [`${est.filter((x) => x.est.state > info.textCap).length} запросов длиннее ≈ ${info.textCap} токенов текста state — ${info.id} прочтёт только начало (остальное отбрасывается молча); для статьи лучше jev или clef-omni`]
      : []),
    ...(info.textCap && est.some((x) => x.est.b64 / 4 > 65536) ? ['картинки тяжелее ≈ 300 КБ — Workers AI отвергнет запрос (413)'] : []),
  ];
  const estimate = {
    model: info.id,
    priceSource: info.live ? `каталог OpenRouter (${info.providers.join(', ')})` : `запасная цена из lib/openrouter.mjs (каталог: ${info.why})`,
    usdPerMillionInput: +(info.price * 1e6).toFixed(4),
    context: info.ctx,
    requests: est.length,
    questions: sum('questions'),
    images: sum('images'),
    tokens: {text: sum('text'), image: sum('image'), template: sum('template'), total: tokens},
    usd: +usd.toFixed(6),
    bytes: sum('bytes'),
    assumptions: 'текст — знаки ÷ 3,5; картинка — блоки 32×32 + 3 (правило Workers AI для Clef); шаблон — 75 токенов на вопрос; выход бесплатный',
  };
  fs.writeFileSync(
    file,
    JSON.stringify({id, created: new Date().toISOString(), endpoint: DECISIONS_URL, note: 'тела запросов как есть; ключ — только в заголовке Authorization и сюда не пишется', estimate, requests: est.map((x) => ({label: x.label, tokens: x.est.total, body: x.dump ?? x.body}))}, null, 1) + '\n',
  );
  const kb = (b) => `${Math.round(b / 1024).toLocaleString('ru-RU')} КБ`;
  console.log(
    [
      `Смета OpenRouter · ${info.id}: $${(info.price * 1e6).toFixed(3)} за 1 млн входных токенов, выход бесплатный (${info.live ? `живая цена, ${info.providers.join(', ')}` : 'запасная цена — каталог не ответил'}), контекст ${info.ctx.toLocaleString('ru-RU')}`,
      `  ${est.length} запросов · ${estimate.questions} вопросов${estimate.images ? ` · ${estimate.images} картинок` : ''} · ≈ ${tokens.toLocaleString('ru-RU')} входных токенов (текст ${estimate.tokens.text.toLocaleString('ru-RU')} + картинки ${estimate.tokens.image.toLocaleString('ru-RU')} + шаблон ${estimate.tokens.template.toLocaleString('ru-RU')}) ≈ ${money(usd)}`,
      `  самый большой запрос (${big.label}) ≈ ${big.est.total.toLocaleString('ru-RU')} токенов; тела — ${kb(estimate.bytes)}; ключ OPENROUTER_API_KEY: ${hasKey('OPENROUTER_API_KEY') ? 'есть' : 'нет'}`,
      ...warns.map((w) => `  ⚠ ${w}`),
    ].join('\n'),
  );
  if (problems.length) throw new Error(`OpenRouter: запрос не пройдёт — ${problems.slice(0, 5).join('; ')}`);
  if (!flag('yes') || flag('dry')) {
    console.log(`Ничего не отправлено (нужен --yes) → ${rel(file)}\nОтправить после «да» владельца на смету: node scripts/judge.mjs ${args.filter((a) => a !== '--dry').join(' ')} --yes`);
    process.exit(0);
  }
};

// ── Ролик ──
const {key, composition} = await openComposition(id, {fallback: 'youtube', logLevel: 'error'});
const {config, timing} = /** @type {{config: any, timing: any}} */ (composition.props);
const scenes = opt('scenes')?.split(',').filter(Boolean);

// ── Визуальный критик (--visual) ──
// Рубрика — по мотивам visual-critic.md из github.com/Liamrjohnston/remotion-motion-graphics-skill
// (skills/motion-graphics/references/visual-critic.md, лицензия MIT, © Liam Johnston): «жёсткие провалы» (нечитаемо, обрезано,
// неон и свечения) и оценки 0–10 — переложены на вкус студии (TASTE.md: ничего не обрезано, читается на телефоне,
// без «нейросетевого почерка» — свечений, искр, частиц, неона, тряски, бликов на картах) и на решающую модель: она отвечает
// вероятностями, а не текстом, поэтому «причина» в отчёте собрана из её ответов. Только советы (⚠): решает владелец.
// Вопросы — по-английски (модели так точнее), фраза диктора — по-русски; кадр без голоса не проверяется на «про то ли кадр».
// Пороги — по калибровке 10.10.2026 (Clef Omni, кадры 1024 px): 6 хороших кадров готовых роликов против 7 испорченных копий
// (мелко, обрезано, неон, текст на тексте, пустой кадр, дважды чужая фраза диктора) — 13 из 13 верно. Модель осторожна: хорошим
// кадрам «читается» — 0,42–0,52, «не обрезано» — 0,51–0,75, «про фразу» — 0,24–0,44, оценка 4,8–6,0 (испорченным — 0,11–0,39,
// 0,21–0,41, 0,12–0,13, 3,3–5,3; неон 0,78 против ≤ 0,17). Запас у «читается» мал, шум на одном кадре ±0,1 — это подсказка,
// не приговор. «Иерархия» хорошие и плохие не различила (0,36–0,46 и 0,29–0,53) — в отчёт числом, в итог не идёт. 1344 px
// точнее не стало. Новая модель — повторить калибровку тем же набором
const VISUAL = {readable: 0.4, uncropped: 0.45, matches: 0.18, taste: 0.6, dead: 0.6, pass: 4.5};
const TASTE_Q = {
  neon_glow: ['Does the image use neon, glow, bloom, lens flares, light glare sweeping over cards, coloured light halos, glassmorphism or cyan-purple gradients?', 'неон, свечение или блики'],
  particles: ['Does the image contain sparks, particles, embers or floating dust effects?', 'искры или частицы'],
  shake_blur: ['Does the image show motion blur, a doubled image or a tilt that suggests camera shake or jitter?', 'тряска или смаз'],
  ai_look: ['Does the image look AI-generated: plastic over-smooth textures, warped details, garbled lettering or malformed hands?', 'ИИ-вид'],
};
// оценка — шкала из 6 уровней (score 0–5) → 0–10 шагом 2: «Good» = 8, порог рубрики
const QUALITY = [
  'Broken: essential content is unreadable, cut off or missing',
  'Poor: cluttered or confusing, the main point is hard to find',
  'Weak: readable but crowded or unbalanced, or with effects that look AI-made',
  'Acceptable: readable and clear, but generic or with minor layout problems',
  'Good: clear hierarchy, readable on a phone, clean hand-crafted finish',
  'Excellent: publish-ready, confident composition, every element earns its place',
];
const visualQuestions = (phrase, tag) => {
  const on = tag ? `About ${tag} (the image right after the text "${tag}"): ` : '';
  return {
    readable: {type: 'noul', instructions: `${on}Is every essential text in the image (titles, names, numbers, subtitles) readable on a phone screen at this size?`, criteria: {true: 'All essential text is large, sharp and contrasty enough to read on a phone', false: 'Some essential text is too small, thin, blurred or low-contrast to read on a phone'}},
    hierarchy: {type: 'noul', instructions: `${on}Does the frame have a clear visual hierarchy?`, criteria: {true: 'One obvious focal element; secondary elements are visibly smaller or quieter', false: 'Several elements compete for attention, or the eye has nowhere to land'}},
    uncropped: {type: 'noul', instructions: `${on}Is all essential content fully visible?`, criteria: {true: 'Cards, interface panels, text and faces are fully inside the frame and not covered by other elements', false: 'Something essential is cut off by the frame edge or hidden under another element'}},
    ...(phrase ? {matches_vo: {type: 'noul', instructions: `${on}Does the image show what the narrator is talking about at this moment (the named card, deck, champion, number or idea)?`, criteria: {true: 'The thing the narration names or describes is visible', false: 'The image shows something else, or nothing specific to the narration'}}} : {}),
    ...Object.fromEntries(Object.entries(TASTE_Q).map(([k, [q]]) => [k, {type: 'noul', instructions: on + q}])),
    dead_space: {type: 'noul', instructions: `${on}Is a large part of the frame empty or filled with meaningless decoration while the content is crammed elsewhere?`},
    overall: {type: 'score', instructions: `${on}Overall quality of this frame as part of a professional, hand-crafted YouTube video`, criteria: QUALITY},
  };
};
// Итог по кадру: жёсткий провал (нечитаемо, обрезано, «нейросетевой почерк») или оценка ниже VISUAL.pass — ⚠; мелкие замечания — ℹ
const visualVerdict = (a, phrase) => {
  const p = (k) => a[k]?.noul;
  const n = (x) => x.toFixed(2);
  const hard = [];
  const soft = [];
  if (p('readable') < VISUAL.readable) hard.push(`мелко или нечитаемо на телефоне (${n(p('readable'))})`);
  if (p('uncropped') < VISUAL.uncropped) hard.push(`обрезано или перекрыто (${n(p('uncropped'))})`);
  for (const [k, [, ru]] of Object.entries(TASTE_Q)) if (p(k) > VISUAL.taste) hard.push(`${ru} (${n(p(k))})`);
  if (phrase && p('matches_vo') < VISUAL.matches) soft.push(`кадр не про фразу диктора (${n(p('matches_vo'))})`);
  if (p('dead_space') > VISUAL.dead) soft.push(`пустые зоны (${n(p('dead_space'))})`);
  const score = typeof a.overall?.score === 'number' ? +((a.overall.score / (QUALITY.length - 1)) * 10).toFixed(1) : null;
  const low = score !== null && score < VISUAL.pass;
  const level = !Object.keys(a).length ? 'pending' : hard.length || low ? 'warn' : soft.length ? 'info' : 'ok';
  return {level, score, reason: [...hard, ...soft, ...(low ? [`оценка ниже ${VISUAL.pass}`] : [])].join('; ') || 'замечаний нет'};
};

if (visual) {
  if (!timing?.segments) skip('у композиции нет timing — визуальный критик только для роликов под голос (YouTube)');
  const base = timing.base ?? 30; // тайминги — в «кадрах-30»
  const at = (opt('at') ?? '0.1,0.32,0.55,0.78,0.96').split(',').map(Number);
  const batch = Math.min(MAX_IMAGES, Math.max(1, Math.round(Number(opt('batch') ?? 1)) || 1)); // кадров на запрос; 1 — точнее
  const segs = timing.segments.filter((t) => !scenes || scenes.includes(t.id));
  if (!segs.length) skip(`нет сцен ${scenes?.join(', ')} — есть ${timing.segments.map((t) => t.id).join(', ')}`);
  // кадры раскадровки: нет или мельче 900 px (yt-board по умолчанию — 480 px) — дорисовать локально в 960 px
  const board = (t, q) => path.resolve('out', id, 'board', `${t.id}_${q}.jpg`);
  const redo = segs.filter((t) => at.some((q) => !fs.existsSync(board(t, q)) || dims(board(t, q))[0] < 900));
  if (redo.length) {
    console.log(`раскадровка: дорисовываю ${redo.length} сцен (yt-board.mjs, локально и бесплатно, 960 px)`);
    const yb = spawnSync(process.execPath, ['scripts/yt-board.mjs', id, ...redo.map((t) => `^${t.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), '--at', at.join(','), '--scale', '0.5'], {stdio: 'inherit'});
    if (yb.status) throw new Error(`yt-board.mjs (код ${yb.status}) — раскадровка не собрана`);
  }
  // ≤ 1024 px JPEG (Clef и Clef Flash отвергают картинки тяжелее ≈ 300 КБ) и фраза диктора в этот момент (субтитры из timing)
  fs.mkdirSync(files.visualDir, {recursive: true});
  const frames = segs.flatMap((t) =>
    at.map((q) => {
      const file = path.join(files.visualDir, `${t.id}_${q}.jpg`);
      ff(['-v', 'error', '-y', '-i', board(t, q), '-vf', "scale='min(1024,iw)':-2", '-q:v', '4', file]);
      const local = Math.round(q * t.dur);
      const sub = t.subs?.find((s) => local >= s.from && local < s.to);
      return {seg: t.id, kind: config.segments.find((s) => s.id === t.id)?.kind ?? '?', q, sec: local / base, time: (t.from + local) / base, phrase: sub ? sub.text.replace(/\s*\n\s*/g, ' ') : null, file, board: board(t, q), size: dims(file)};
    }),
  );
  const vreqs = [];
  for (let i = 0; i < frames.length; i += batch) {
    const part = frames.slice(i, i + batch);
    const state = [];
    const questions = {};
    part.forEach((f, k) => {
      const tag = batch > 1 ? `FRAME ${k + 1}` : '';
      state.push(`${tag ? `${tag}. ` : ''}A frame of a Russian YouTube video (${composition.width}×${composition.height}, downscaled to ${f.size[0]} px wide, about what a phone viewer sees). Scene "${f.seg}" (${f.kind}), ${f.sec.toFixed(1)} s into the scene.`);
      state.push(f.phrase ? `Narrator at this moment (Russian): «${f.phrase}»` : 'The narrator is silent at this moment.');
      state.push(imagePart(fs.readFileSync(f.file)));
      for (const [q, v] of Object.entries(visualQuestions(f.phrase, tag))) questions[tag ? `f${k + 1}.${q}` : q] = v;
    });
    vreqs.push({frames: part, state, questions});
  }
  console.log(`${id}: ${frames.length} кадров из ${segs.length} сцен → ${vreqs.length} запросов по ${batch} кадр.`);
  const todo = vreqs.filter((r) => !fs.existsSync(cached(r)));
  if (todo.length) {
    // в файл — тела без base64 (картинка = ссылка на свой JPEG); на каждый кадр в state по 3 элемента: текст, фраза, картинка
    const dump = (r) => ({model, state: r.state.map((x, i) => (isImage(x) ? {type: 'image_url', image_url: {url: `data:image/jpeg;base64,… (${x.image_url.url.length} знаков, ${rel(r.frames[Math.floor(i / 3)].file)})`}} : x)), questions: r.questions});
    await orGate(todo.map((r) => ({label: r.frames.map((f) => `${f.seg}@${f.q}`).join('+'), body: {model, state: r.state, questions: r.questions}, dims: r.frames.map((f) => f.size), dump: dump(r)})), files.visualRequest);
    if (!hasKey('OPENROUTER_API_KEY')) skip('нет OPENROUTER_API_KEY в video/.env');
  }
  fs.mkdirSync(cacheDir, {recursive: true});
  const vgot = new Map();
  try {
    for (const r of vreqs) {
      const c = cached(r);
      if (fs.existsSync(c)) {
        vgot.set(r, JSON.parse(fs.readFileSync(c, 'utf8')));
        continue;
      }
      const res = await askOpenRouter(r);
      fs.writeFileSync(c, JSON.stringify({...res, backend, model}, null, 1) + '\n');
      vgot.set(r, res);
    }
  } catch (e) {
    if (e instanceof Unavailable) skip(e.message);
    throw e;
  }
  const rows = vreqs.flatMap((r) =>
    r.frames.map((f, k) => {
      const pre = batch > 1 ? `f${k + 1}.` : '';
      const a = Object.fromEntries(Object.entries(vgot.get(r).answers ?? {}).filter(([q]) => q.startsWith(pre)).map(([q, v]) => [q.slice(pre.length), v]));
      return {...f, file: rel(f.file).replace(/\\/g, '/'), board: rel(f.board).replace(/\\/g, '/'), ...visualVerdict(a, f.phrase), answers: a};
    }),
  );
  const vcount = (l) => rows.filter((x) => x.level === l).length;
  const scored = rows.filter((x) => x.score !== null);
  const avg = scored.length ? scored.reduce((n, x) => n + x.score, 0) / scored.length : null;
  const vusage = [...vgot.values()].map((g) => g.usage).filter(Boolean);
  const vcost = vusage.reduce((n, u) => n + (u.cost ?? 0), 0);
  const vsum = `⚠️ ${vcount('warn')} · ℹ️ ${vcount('info')} · ✅ ${vcount('ok')}${vcount('pending') ? ` · без ответа ${vcount('pending')}` : ''}${avg !== null ? ` · средняя оценка ${avg.toFixed(1)}/10` : ''}${vcost ? ` · стоимость ${money(vcost)}` : ''}`;
  const vicon = {warn: '⚠️', info: 'ℹ️', ok: '✅', pending: '…'};
  const vlines = [
    `# Визуальный критик «${config.title}»`,
    '',
    `Модель: ${model} (OpenRouter Decisions) · кадров ${rows.length} (доли сцены ${at.join(', ')}) · ${new Date().toLocaleString('ru-RU')}`,
    `Итог: ${vsum}`,
    '',
    'Только советы — решает владелец. На кадр: читается ли на телефоне, ясна ли иерархия, всё ли в кадре, про то ли кадр, что говорит диктор,',
    `нет ли «нейросетевого почерка» (TASTE.md: неон, свечения, блики, искры, частицы, тряска, ИИ-вид), оценка 0–10 (порог ${VISUAL.pass}; пороги — по калибровке, см. judge.mjs).`,
    'Модель отвечает вероятностями, не текстом: причина собрана из её ответов. Рубрика — по мотивам visual-critic.md (Liam Johnston, MIT).',
    '',
    ...[...new Set(rows.map((x) => x.seg))].flatMap((seg) => {
      const rs = rows.filter((x) => x.seg === seg);
      return [`## ${seg} — ${rs[0].kind}`, '', ...rs.map((x) => `- ${vicon[x.level]} ${x.time.toFixed(1)} с (+${x.sec.toFixed(1)}) · ${x.score ?? '—'}/10 · ${x.phrase ? `«${x.phrase}»` : '(диктор молчит)'} — ${x.reason} · ${x.file}`), ''];
    }),
  ];
  fs.writeFileSync(files.visualReport, vlines.join('\n'));
  fs.writeFileSync(files.visualJson, JSON.stringify({id, date: new Date().toISOString(), backend, model, served: [...new Set([...vgot.values()].map((g) => g.served).filter(Boolean))], at, batch, frames: rows.length, counts: {warn: vcount('warn'), info: vcount('info'), ok: vcount('ok'), pending: vcount('pending')}, average: avg, usage: vusage, cost: vcost, thresholds: VISUAL, rows}, null, 1) + '\n');
  console.log(`Итог: ${vsum}`);
  for (const x of rows.filter((r) => r.level === 'warn').sort((a, b) => (a.score ?? 0) - (b.score ?? 0)).slice(0, 8)) console.log(`⚠️ ${x.seg} ${x.time.toFixed(1)} с · ${x.score ?? '—'}/10: ${x.reason}`);
  console.log(`→ ${rel(files.visualReport)}, ${rel(files.visualJson)}`);
  process.exit(0);
}

// ── Вопросы J1–J4 (judge.ts студии) ──
const judgeTs = path.join(studioDir(key), 'judge.ts');
if (!fs.existsSync(judgeTs)) skip(`нет вопросов: у студии ${studio(key).dir} нет judge.ts (вопросы J1–J4 пока только у Манакоста); кадры — --visual`);
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
await build({entryPoints: [judgeTs], bundle: true, platform: 'node', format: 'cjs', outfile: judgeOut, logLevel: 'error'});
const J = createRequire(import.meta.url)(judgeOut);
const checks = opt('checks')?.split(',').filter(Boolean) ?? J.CHECKS;
const bad = checks.filter((c) => !J.CHECKS.includes(c));
if (bad.length) throw new Error(`--checks: ${bad.join(', ')} — есть ${J.CHECKS.join(', ')}`);
const requests = J.buildRequests(config, article, {checks, scenes}).map((r) => ({...r, key: sha(JSON.stringify({state: r.state, questions: r.questions})).slice(0, 16)}));
if (!requests.length) skip(`нет вопросов (сцены колод${scenes ? ` ${scenes.join(', ')}` : ''} без vs/points/cards${article ? '' : ', нет article.json'})`);
const nq = requests.reduce((n, r) => n + Object.keys(r.questions).length, 0);
const chars = requests.reduce((n, r) => n + JSON.stringify({state: r.state, questions: r.questions}).length, 0);
console.log(`${id}: ${requests.length} запросов (${new Set(requests.map((r) => r.seg)).size} сцен, ${nq} вопросов), проверки ${checks.join(', ')}${article ? '' : ' — без article.json: только тезисы и карты'}`);

if (flag('dry') && backend !== 'openrouter') {
  // оценка: русский текст ≈ 2,5 символа на токен; JEV — $0.042 за 1 млн входных токенов (у openrouter — смета orGate)
  const tokens = Math.round(chars / 2.5);
  fs.writeFileSync(files.dry, JSON.stringify({id, backend, model, requests: requests.map(({key, seg, run, state, questions}) => ({key, seg, run, model, state, questions}))}, null, 1) + '\n');
  const keyName = {jev: 'TYPESAFE_API_KEY', claude: 'ANTHROPIC_API_KEY'}[backend];
  console.log(`--dry: ничего не отправлено. ≈ ${tokens} входных токенов${backend === 'jev' ? ` (≈ $${((tokens / 1e6) * 0.042).toFixed(4)})` : ''}${keyName ? `; ключ ${keyName}: ${hasKey(keyName) ? 'есть' : 'нет'}` : ''}\n→ ${rel(files.dry)}`);
  process.exit(0);
}

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
  const keyName = {jev: 'TYPESAFE_API_KEY', claude: 'ANTHROPIC_API_KEY', openrouter: 'OPENROUTER_API_KEY'}[backend];
  const todo = requests.filter((r) => !fs.existsSync(cached(r)));
  // OpenRouter платный: смета и тела в judge-request.json; без --yes здесь выход
  if (backend === 'openrouter' && todo.length) await orGate(todo.map((r) => ({label: `${r.seg}/${r.run}`, body: {model, state: r.state, questions: r.questions}})), files.request);
  if (todo.length && !hasKey(keyName)) skip(`нет ${keyName} в video/.env (бэкенд ${backend}); без ключей — --backend agent`);
  fs.mkdirSync(cacheDir, {recursive: true});
  try {
    for (const r of requests) {
      const c = cached(r);
      if (fs.existsSync(c)) {
        got.set(r.key, JSON.parse(fs.readFileSync(c, 'utf8')));
        continue;
      }
      const res = backend === 'jev' ? await askJev(r) : backend === 'openrouter' ? await askOpenRouter(r) : await askClaude(r);
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
const cost = usage.reduce((n, u) => n + (u.cost ?? 0), 0); // usage.cost — у OpenRouter, в долларах
const summary = `❌ ${count('error')} · ⚠️ ${count('warn')} · ℹ️ ${count('info')} · ✅ ${count('ok')}${count('pending') ? ` · ждут ответа ${count('pending')}` : ''}`;
const lines = [
  `# Смысловая проверка «${config.title}»`,
  '',
  `Бэкенд: ${backend} (${answeredBy}) · проверки: ${checks.join(', ')}${scenes ? ` · сцены: ${scenes.join(', ')}` : ''}${cost ? ` · стоимость ${money(cost)}` : ''} · ${new Date().toLocaleString('ru-RU')}`,
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
fs.writeFileSync(files.json, JSON.stringify({id, date: new Date().toISOString(), backend, model: answeredBy, checks, scenes: scenes ?? null, requests: requests.length, answered: got.size, pending: pendingList.length, counts: {error: count('error'), warn: count('warn'), info: count('info'), ok: count('ok'), pending: count('pending')}, usage, ...(cost ? {cost} : {}), results}, null, 1) + '\n');
console.log(`Итог: ${summary}${cost ? ` · стоимость ${money(cost)}` : ''}`);
for (const x of results.filter((r) => r.level === 'error' || r.level === 'warn')) console.log(`${icon[x.level]} ${x.seg} ${x.label} «${x.shown}»: ${x.what}`);
if (pendingList.length)
  console.log(`\nЖдут ответа ${pendingList.length} из ${requests.length} запросов → ${rel(files.pending)}\nДальше: сессия Claude Code читает ${rel(files.pending)}, отвечает в ${rel(files.answers)} (формат — поле how) и снова запускает judge.mjs`);
console.log(`→ ${rel(files.report)}, ${rel(files.json)}`);
process.exit(flag('strict') && count('error') ? 1 : 0);
