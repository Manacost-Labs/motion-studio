// OpenRouter для скриптов студии: решающие модели (judge.mjs --backend openrouter, --visual) и остаток счёта (credits.mjs).
// Решающая модель не пишет текст: состояние (state) + типизированные вопросы → вероятности (noul — «да», choice — варианты,
// score — место на шкале). Это формат TypeSafe System One, тот же, что у judge.ts, поэтому ответы идут в отчёт без пересчёта.
// Вызов — POST https://openrouter.ai/api/alpha/decisions {model, state, questions} → {id, model, provider, answers,
// usage: {input_tokens, output_tokens, cost}} (openrouter.ai/docs/api/api-reference/alphadecisions/submit-a-decisions-request).
// Не /api/v1/chat/completions: решающие модели обслуживает только Decisions API (и /api/v1/systemone для SDK TypeSafe).
// Картинка — элемент массива state: {type: 'image_url', image_url: {url: 'data:image/jpeg;base64,…'}}, текст рядом — простыми
// строками; у Clef, Clef Flash и Clef Omni — не больше 4 картинок на запрос, поле images верхнего уровня API отвергает (400)
// (openrouter.ai/docs/guides/community/multimodal-decisions).
// Бесплатно, без генерации: GET /api/v1/models/<id>/endpoints (цена, контекст), GET /api/v1/key и /api/v1/credits (остаток).
// Ключ OPENROUTER_API_KEY — только из video/.env через env.mjs и только в заголовке; в файлы, логи и аргументы не попадает.
import {loadEnv} from './env.mjs';

const API = 'https://openrouter.ai/api';
export const DECISIONS_URL = `${API}/alpha/decisions`;
export const MAX_IMAGES = 4; // картинок на запрос у семейства Clef
export const MAX_QUESTIONS = 64; // вопросов на запрос у Clef (Workers AI); у Jev предел не опубликован — держим тот же

// Модели (проверено 10.10.2026 по /api/v1/models/<id>/endpoints): цена за 1 входной токен (выход бесплатный), контекст —
// наименьший среди поставщиков (у Clef и Clef Flash есть поставщик с 16k; у Jev запрос — до 32k из 64k). Живые цена и
// контекст — modelInfo(), эти — запасные. textCap: Clef и Clef Flash читают ≈ 2000 токенов текста state, остальное молча
// отбрасывают (гайд OpenRouter по картинкам) — для длинных разделов статьи нужны jev или clef-omni
export const OR_MODELS = {
  jev: {id: 'typesafe/jev-1.13', price: 0.042e-6, ctx: 32000, image: false},
  'clef-flash': {id: 'cloudflare/clef-flash', price: 0.038e-6, ctx: 16384, image: true, textCap: 2000},
  clef: {id: 'cloudflare/clef', price: 0.24e-6, ctx: 16384, image: true, textCap: 2000},
  'clef-omni': {id: 'cloudflare/clef-omni', price: 0.15e-6, ctx: 65536, image: true},
};

// --model: короткое имя (jev, clef-flash, clef, clef-omni) или полный id OpenRouter
/** @param {string} name @returns {{id: string, price?: number, ctx?: number, image?: boolean, textCap?: number}} */
export const resolveModel = (name) => {
  const hit = OR_MODELS[name] ?? Object.values(OR_MODELS).find((m) => m.id === name);
  if (hit) return hit;
  if (name?.includes('/')) return {id: name};
  throw new Error(`--model: ${Object.keys(OR_MODELS).join(', ')} или полный id OpenRouter (получено «${name}»)`);
};

// Цена и контекст из бесплатного каталога (без ключа): цена — наибольшая среди поставщиков, контекст — наименьший
/** @param {{id: string, price?: number, ctx?: number, image?: boolean, textCap?: number}} m */
export const modelInfo = async (m) => {
  try {
    const r = await fetch(`${API}/v1/models/${m.id}/endpoints`, {signal: AbortSignal.timeout(15000)});
    const d = /** @type {any} */ (await r.json())?.data;
    const eps = d?.endpoints ?? [];
    if (!r.ok || !eps.length) throw new Error(r.ok ? 'нет поставщиков' : `код ${r.status}`);
    return {
      ...m,
      price: Math.max(...eps.map((e) => Number(e.pricing?.prompt) || 0)),
      ctx: Math.min(...eps.map((e) => Math.min(e.context_length || Infinity, e.max_prompt_tokens || Infinity))),
      image: m.image ?? !!d.architecture?.input_modalities?.includes('image'),
      providers: eps.map((e) => e.provider_name),
      live: true,
      why: null,
    };
  } catch (e) {
    if (m.price === undefined) throw new Error(`OpenRouter: нет цены ${m.id} (каталог: ${e.message}) — смету не посчитать`);
    return {...m, providers: [], live: false, why: e.message};
  }
};

// ── Смета до запроса (после — usage.input_tokens и usage.cost из ответа) ──
// Текст — знаки ÷ 3,5 (русский в токенизаторах Qwen и Jev, допущение). Картинка — правило Workers AI для Clef Omni
// (developers.cloudflare.com/workers-ai/models/clef-omni): пропорции сохраняются, стороны кратны 32, меньше ≈ 65 тыс. пикселей —
// растягивается, больше ≈ 1 Мп — сжимается; блок 32×32 = 1 токен + 3 служебных, не больше 1024 на картинку (допущение: так же
// у Clef и Clef Flash). Служебный шаблон — ≈ 75 токенов на вопрос: подобрано по двум живым ответам из документации OpenRouter
// (476 токенов — Jev, 3 вопроса; 289 — Clef Flash с картинкой, 2 вопроса)
export const CHARS_PER_TOKEN = 3.5;
export const PER_QUESTION = 75;
export const textTokens = (chars) => Math.ceil(chars / CHARS_PER_TOKEN);
/** @param {number[]} size [ширина, высота] */
export const imageTokens = (size) => {
  const [w, h] = size;
  const px = w * h;
  const k = px < 65536 ? Math.sqrt(65536 / px) : px > 1048576 ? Math.sqrt(1048576 / px) : 1;
  return Math.min(1024, Math.max(1, Math.round((w * k) / 32)) * Math.max(1, Math.round((h * k) / 32)) + 3);
};

export const isImage = (x) => !!x && typeof x === 'object' && x.type === 'image_url';
export const imagePart = (buf, mime = 'image/jpeg') => ({type: 'image_url', image_url: {url: `data:${mime};base64,${buf.toString('base64')}`}});

// Оценка тела {model, state, questions}: картинки — элементы state вида image_url (размеры — dims[i], по порядку), остальное — текст
/** @param {{model: string, state: any, questions: Record<string, any>}} body @param {number[][]} [dims] */
export const estimateBody = (body, dims = []) => {
  const items = Array.isArray(body.state) ? body.state : [body.state];
  const imgs = items.filter(isImage);
  const stateText = Array.isArray(body.state) ? items.filter((x) => !isImage(x)) : body.state;
  const state = textTokens(JSON.stringify(stateText).length);
  const text = textTokens(JSON.stringify({state: stateText, questions: body.questions}).length);
  const image = imgs.reduce((n, _, i) => n + imageTokens(dims[i] ?? [1024, 1024]), 0);
  const questions = Object.keys(body.questions).length;
  return {
    text,
    image,
    template: questions * PER_QUESTION,
    total: text + image + questions * PER_QUESTION,
    state, // токенов текста в state — для предела textCap
    questions,
    images: imgs.length,
    b64: imgs.reduce((n, x) => n + x.image_url.url.length, 0), // Workers AI отвергает (413), если b64 ÷ 4 > 65 536 (Clef, Clef Flash)
    bytes: Buffer.byteLength(JSON.stringify(body)),
  };
};

// Заголовки платного вызова (judge.mjs шлёт их только после сметы и --yes). Referer и X-Title — подпись приложения в OpenRouter
export const decisionsHeaders = () => ({authorization: `Bearer ${loadEnv().OPENROUTER_API_KEY.trim()}`, 'http-referer': 'https://hearthpulse.net', 'x-title': 'HearthPulse Ads studio'});

// Остаток (бесплатно): /api/v1/credits — весь счёт (пополнено, потрачено), /api/v1/key — лимит и траты этого ключа.
// Возвращаются только числа: label ключа содержит его кусок — не выводить; ошибка — код, без текста ответа
export const account = async () => {
  const headers = {authorization: `Bearer ${loadEnv().OPENROUTER_API_KEY.trim()}`};
  const get = async (p) => {
    const r = await fetch(`${API}/v1/${p}`, {headers, signal: AbortSignal.timeout(15000)});
    const j = /** @type {any} */ (await r.json().catch(() => ({})));
    if (!r.ok) throw new Error(`${p}: код ${r.status}`);
    return j.data ?? {};
  };
  const [credits, key] = await Promise.allSettled([get('credits'), get('key')]);
  const num = (x) => (typeof x === 'number' ? x : null);
  const c = credits.status === 'fulfilled' ? credits.value : null;
  const k = key.status === 'fulfilled' ? key.value : null;
  return {
    credits: c && {total: num(c.total_credits), used: num(c.total_usage)},
    key: k && {limit: num(k.limit), remaining: num(k.limit_remaining), usage: num(k.usage), daily: num(k.usage_daily), monthly: num(k.usage_monthly), freeTier: !!k.is_free_tier},
    errors: [credits, key].filter((x) => x.status === 'rejected').map((x) => /** @type {PromiseRejectedResult} */ (x).reason.message),
  };
};
