// Смысловой судья для роликов Манакоста — наборы вопросов J1–J4 (их задаёт и отправляет scripts/judge.mjs, собирая этот файл
// esbuild-ом, как канал в yt-qa). Проверяет то, что yt-qa видит только по форме: правило «только из статьи» для матч-апов,
// тезисов и фраз диктора, уместность карт под голос и обводок пером.
// Контракт — формат TypeSafe System One: запрос {model, state, questions} → ответ {answers, backend, model, usage};
// noul — вероятность «да» (0..1), choice — вероятности вариантов. Инструкции и criteria — по-английски (модели так
// точнее), state — по-русски, одна колода (сцена) на запрос: лишний контекст снижает точность.
// В choice первым идёт «безопасный» для отлова вариант (says_nothing): модели тянутся к первому, и ошибка уйдёт в лишнюю
// тревогу, а не в пропуск; второй прогон (run: 'swap') — с переставленными вариантами, вероятности усредняются.
// Числа и даты судья не проверяет (модель не калькулятор) — их сверяет код с article.json и meta.json.
import {stripTags} from '../../core/voice/timing';
import type {DeckSeg} from '../../games/hearthstone/scenes/types';
import type {YtConfig} from './channel';

// Пороги смыслового судьи (scripts/judge.mjs). Вероятности 0..1
export const JUDGE = {
  vsSupports: 0.8, // J1: матч-ап подтверждён статьёй — ок
  vsContradicts: 0.6, // J1: статья говорит обратное — ❌
  pointOk: 0.7, // J2: тезис следует из текста — ок; ниже pointWarn — ⚠, между — ℹ
  pointWarn: 0.4,
  factContradicts: 0.6, // J3: фраза диктора противоречит статье — ⚠ (флажок только на «противоречит»)
  cardWarn: 0.4, // J4: карта не к месту / обводка не оправдана — ⚠
};

export type Question =
  | {type: 'noul'; instructions: Record<string, string>; criteria?: {true: string; false: string}}
  | {type: 'choice'; instructions: Record<string, string>; criteria: Record<string, string>};
export type Check = 'matchups' | 'points' | 'facts' | 'cards';
export const CHECKS: Check[] = ['matchups', 'points', 'facts', 'cards'];
// что спрашивается — для отчёта: проверка, что на экране, где
export type About = {check: Check; label: string; shown: string};
export type JudgeRequest = {seg: string; title: string; run: 'main' | 'swap'; state: Record<string, string>; questions: Record<string, Question>; about: Record<string, About>};
export type Answer = {noul?: number; choice?: string; probabilities?: Record<string, number>; confidence?: number};
export type Verdict = {level: 'error' | 'warn' | 'info' | 'ok'; what: string};

type ArticleDeck = {rank: number; name: string; paragraphs: {text: string}[]};
export type Article = {decks: ArticleDeck[]; cardNames?: Record<string, string>};

// варианты choice «что говорит статья об утверждении»: безопасный первым
const RELATION = {
  says_nothing: 'The section does not mention this (opponent, matchup or fact)',
  contradicts: 'The section says the opposite',
  supports: 'The section states or directly implies the claim',
};
const reversed = (c: Record<string, string>) => Object.fromEntries(Object.entries(c).reverse());

const sentences = (vo: string) =>
  stripTags(vo)
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

export const buildRequests = (config: YtConfig, article: Article | null, opts: {checks?: Check[]; scenes?: string[]} = {}): JudgeRequest[] => {
  const checks = new Set(opts.checks?.length ? opts.checks : CHECKS);
  const out: JudgeRequest[] = [];
  for (const seg of config.segments) {
    if (seg.kind !== 'deck') continue;
    if (opts.scenes?.length && !opts.scenes.includes(seg.id)) continue;
    const deck = seg as DeckSeg;
    const section = article?.decks.find((d) => d.rank === deck.rank)?.paragraphs.map((p) => p.text).join('\n\n') ?? '';
    const vo = stripTags(deck.vo);
    const name = `${deck.name} (${deck.cls})`;
    const title = `${deck.rank !== undefined ? `${deck.rank}. ` : ''}${deck.name}`;
    const state: Record<string, string> = {deck: name, vo, ...(section ? {article_section: section} : {})};
    const q: Record<string, Question> = {};
    const about: Record<string, About> = {};
    // J1. Матч-апы ↔ раздел статьи (без статьи не проверить)
    if (checks.has('matchups') && section)
      (deck.vs ?? []).forEach((v, i) => {
        const claim = `Колода «${deck.name}» ${v.verdict === 'good' ? 'сильна против' : 'слаба против'}: ${v.label ?? v.cls}`;
        q[`vs_${i}`] = {type: 'choice', instructions: {question: 'How does article_section relate to the claim about this matchup?', claim}, criteria: RELATION};
        about[`vs_${i}`] = {check: 'matchups', label: 'J1 матч-ап', shown: claim};
      });
    // J2. Тезисы на экране ↔ текст диктора и статья
    if (checks.has('points'))
      (deck.points ?? []).forEach((p, i) => {
        const thesis = `${p.text}${p.detail ? ` — ${p.detail}` : ''}`;
        q[`point_${i}`] = {
          type: 'noul',
          instructions: {statement: `The on-screen thesis is stated in or directly follows from vo${section ? ' or article_section' : ''}`, thesis},
          criteria: {true: `Restates or directly follows from vo${section ? '/article_section' : ''}`, false: 'Adds a claim absent from the text, or distorts it'},
        };
        about[`point_${i}`] = {check: 'points', label: 'J2 тезис', shown: thesis};
      });
    // J3. Фразы диктора ↔ статья: флажок только на «противоречит»; короткие связки (< 5 слов) не спрашиваем
    if (checks.has('facts') && section)
      sentences(deck.vo)
        .filter((s) => s.split(/\s+/).length >= 5)
        .forEach((s, i) => {
          q[`fact_${i}`] = {type: 'choice', instructions: {question: 'How does article_section relate to this narration sentence?', claim: s}, criteria: RELATION};
          about[`fact_${i}`] = {check: 'facts', label: 'J3 фраза', shown: s};
        });
    // J4. Карта появляется под фразу, где о ней речь; обводка пером — только у карт, которые диктор называет главными
    if (checks.has('cards'))
      (deck.cards ?? []).forEach((c, i) => {
        const card = deck.list.find((x) => x.id === c.id)?.name ?? article?.cardNames?.[c.id] ?? c.id;
        const sentence = c.at ? sentences(deck.vo).find((s) => s.toLowerCase().includes(c.at!.toLowerCase())) : undefined;
        if (sentence) {
          q[`card_${i}`] = {type: 'noul', instructions: {statement: 'The sentence names this card or talks about what it does', card, sentence}};
          about[`card_${i}`] = {check: 'cards', label: 'J4 карта', shown: `${card} на «${c.at}»`};
        }
        if (c.ink) {
          q[`ink_${i}`] = {type: 'noul', instructions: {statement: 'The narration (vo) calls this card key, main, best or most important for the deck', card}};
          about[`ink_${i}`] = {check: 'cards', label: 'J4 обводка', shown: card};
        }
      });
    if (!Object.keys(q).length) continue;
    out.push({seg: deck.id, title, run: 'main', state, questions: q, about});
    // второй прогон choice с переставленными вариантами — против перекоса к первому варианту
    const swap = Object.fromEntries(Object.entries(q).filter(([, x]) => x.type === 'choice').map(([k, x]) => [k, {...x, criteria: reversed(x.criteria!)} as Question]));
    if (Object.keys(swap).length) out.push({seg: deck.id, title, run: 'swap', state, questions: swap, about: Object.fromEntries(Object.keys(swap).map((k) => [k, about[k]]))});
  }
  return out;
};

// Вероятности choice по ответу: probabilities, иначе вся масса на choice
export const probsOf = (a: Answer): Record<string, number> => a.probabilities ?? (a.choice ? {[a.choice]: 1} : {});

// Итог по вопросу (ответы прогонов уже усреднены в judge.mjs): уровень и текст для отчёта. Пороги — JUDGE выше
export const verdict = (qid: string, about: About, a: Answer): Verdict => {
  const p = probsOf(a);
  const top = Object.entries(p).sort((x, y) => y[1] - x[1])[0] ?? ['?', 0];
  const n = (x: number | undefined) => (x ?? 0).toFixed(2);
  if (about.check === 'matchups') {
    if (top[0] === 'contradicts' && top[1] >= JUDGE.vsContradicts) return {level: 'error', what: `статья говорит обратное (contradicts ${n(top[1])}) — исправить или убрать строку из vs`};
    if (top[0] === 'supports' && top[1] >= JUDGE.vsSupports) return {level: 'ok', what: `подтверждено статьёй (supports ${n(top[1])})`};
    return {level: 'warn', what: `в статье не найдено уверенно (${top[0]} ${n(top[1])}) — проверить по тексту раздела, при необходимости поправить label или убрать строку`};
  }
  if (about.check === 'facts') {
    if (top[0] === 'contradicts' && top[1] >= JUDGE.factContradicts) return {level: 'warn', what: `фраза расходится со статьёй (contradicts ${n(top[1])}) — переписать по статье и перезаписать голос сцены`};
    return {level: 'ok', what: `${top[0]} ${n(top[1])}`};
  }
  const y = a.noul ?? 0;
  if (about.check === 'points') {
    if (y >= JUDGE.pointOk) return {level: 'ok', what: `следует из текста (${n(y)})`};
    if (y < JUDGE.pointWarn) return {level: 'warn', what: `в тексте диктора и статье этого нет (${n(y)}) — переписать тезис как вывод из сказанного`};
    return {level: 'info', what: `следует не прямо (${n(y)}) — перечитать`};
  }
  if (y < JUDGE.cardWarn)
    return {level: 'warn', what: qid.startsWith('ink') ? `диктор не называет карту главной (${n(y)}) — снять ink` : `в этой фразе о карте не говорится (${n(y)}) — карта появится не к месту, поправить at`};
  return {level: 'ok', what: `${qid.startsWith('ink') ? 'названа главной' : 'к месту'} (${n(y)})`};
};
