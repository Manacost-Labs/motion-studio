// Проверки данных сцены колоды (yt-qa, без рендера): простои камеры, длина надписей, тезисы, обводки, матч-апы, врезки;
// и файлы, без которых сцена не соберётся. Подключаются к сцене через SceneDef.audit и SceneDef.assets
// (core/video/registry.ts); сообщения — в отчёт out/<id>/qa-report.md. Время — в «кадрах-30».
// Ниже — карта темпа колоды (SceneDef.pace) и проверки канала по Hearthstone (hsQa → channel.qa, core/qa/audit.ts):
// словарь терминов, обложка, гербы классов, заметки о ролике целиком
import {timeAt} from '../../../core/voice/timing';
import type {AuditCtx, AuditIssue, SceneAsset} from '../../../core/video/registry';
import type {BaseSeg, Point, SegTiming} from '../../../core/video/types';
import {thumbVariants, todosOf, type ChannelQa, type Issue} from '../../../core/qa/audit';
import {VIDEO_LIMITS} from '../../../core/qa/limits';
import type {ScenePace} from '../../../core/video/registry';
import {planCamera} from './camera';
import {unknownClasses} from './classes';
import {TOP_REVEAL} from './ranks';
import GAME_PRONOUNCE from './pronounce.json';
import type {DeckInsert, DeckPosterData, SpokenCard, Versus} from './types';

// Пороги проверок сцены колоды — единый источник (их сливает LIMITS канала studios/manacost-youtube/channel.ts:
// release.mjs читает idleSec оттуда). ⚠ — предупреждение, ℹ — заметка
export const DECK_LIMITS = {
  idleSec: 4, // колода стоит без движения камеры, подъёма карты или врезки дольше — ⚠ (в кадре всегда что-то движется)
  deckName: 30, // название колоды в шапке длиннее — ⚠ (шрифт уменьшится)
  pointsMax: 3, // тезисов (points) на колоду больше — ⚠ (не помещаются)
  pointText: 28, // заголовок тезиса длиннее — ℹ (займёт две строки)
  pointDetail: 52, // пояснение тезиса длиннее — ⚠
  inkMax: 3, // обводок пером (ink) на колоду больше — ⚠; норма 0–3, только у карт, которые диктор называет главными
  vsLabel: 22, // подпись матч-апа длиннее — ⚠ (обрежется многоточием)
};

// Форма сегмента колоды, которую читают проверки (весь DeckSeg — в шаблоне студии)
type DeckLike = BaseSeg & {name: string; rank?: number; poster?: DeckPosterData; cards?: SpokenCard[]; points?: Point[]; vs?: Versus[]; inserts?: DeckInsert[]};

const BASE = 30;
const sec = (frames: number) => `${(frames / BASE).toFixed(1)} с`;

// Сколько подряд кадров колода стоит без движения камеры, подъёма карты или врезки
const longestIdle = (seg: DeckLike, t: SegTiming, subs: boolean) => {
  const p = seg.poster;
  if (!p) return 0;
  const at = timeAt(t, seg.vo, 30);
  const box = subs ? {w: 963, h: 748} : {w: 963, h: 862};
  const k = Math.min(box.w / p.w, box.h / p.h);
  const inserts = (seg.inserts ?? []).map((ins) => [at(ins.at) - 8, ins.to ? at(ins.to) : t.dur - 12] as const);
  const inWin = (x: number) => inserts.some(([a, b]) => x >= a && x <= b);
  const cards = (seg.cards ?? []).map((c, i, all) => ({id: c.id, at: at(c.at, i, all.length)})).filter((c) => !inWin(c.at));
  const plan = planCamera(p, cards, t.dur, {w: Math.round(p.w * k), h: Math.round(p.h * k)});
  const busy = new Uint8Array(t.dur);
  const mark = (a: number, b: number) => {
    for (let f = Math.max(0, Math.floor(a)); f < Math.min(t.dur, Math.ceil(b)); f++) busy[f] = 1;
  };
  plan.keys.forEach((key, i) => {
    const n = plan.keys[i + 1];
    if (n && (n.fx !== key.fx || n.fy !== key.fy || n.z !== key.z)) mark(key.f, n.f);
  });
  plan.lifts.forEach((l) => mark(l.a, l.b));
  inserts.forEach(([a, b]) => mark(a, b));
  let run = 0;
  let best = 0;
  for (let f = 40; f < t.dur - 14; f++) (run = busy[f] ? 0 : run + 1), (best = Math.max(best, run));
  return best;
};

// Проверки сцены колоды (SceneDef.audit): ctx.subs — в кадре идут субтитры (окно постера ниже)
export const deckAudit = (seg: DeckLike, t: SegTiming, ctx: AuditCtx): AuditIssue[] => {
  const out: AuditIssue[] = [];
  const add = (level: AuditIssue['level'], what: string) => out.push({level, what});
  const L = DECK_LIMITS;
  const idle = longestIdle(seg, t, ctx.subs);
  if (idle > L.idleSec * BASE) add('warn', `колода стоит без движения ${sec(idle)} подряд`); // в кадре должно всегда что-то двигаться
  if (seg.name.length > L.deckName) add('warn', `длинное название в шапке (${seg.name.length} зн.) — шрифт уменьшится`);
  if (!seg.points?.length) add('warn', 'нет тезисов (points) — левая колонка будет пустой');
  if ((seg.points?.length ?? 0) > L.pointsMax) add('warn', `тезисов ${seg.points!.length} — больше трёх не помещается, оставьте главное`);
  const inks = (seg.cards ?? []).filter((c) => c.ink).length;
  if (inks > L.inkMax) add('warn', `обводок пером ${inks} — больше трёх на колоду рябит, оставьте ключевые`);
  (seg.points ?? []).forEach((p) => {
    if (p.text.length > L.pointText) add('info', `тезис «${p.text}» (${p.text.length} зн.) займёт две строки`);
    if ((p.detail ?? '').length > L.pointDetail) add('warn', `пояснение тезиса длиннее ${L.pointDetail} знаков: «${p.detail}»`);
  });
  (seg.vs ?? []).forEach((v) => (v.label ?? v.cls).length > L.vsLabel && add('warn', `подпись матч-апа обрежется многоточием: «${v.label}»`));
  (seg.inserts ?? []).forEach((ins) => {
    if (ins.kind === 'clip' && !ins.credit.trim()) add('error', `врезка ${ins.src} без указания автора`);
    if (ins.kind === 'clip') add('info', `в сцене чужое видео (${ins.src}) — проверьте лицензию перед публикацией: ${ins.credit}`);
    if (ins.kind === 'clip' && ins.probe) add('warn', `пробная врезка ${ins.src} (probe) — для выпуска заменить своей записью этой колоды (rec.mjs take) или убрать`);
  });
  return out;
};

// Файлы сцены колоды из public (SceneDef.assets → yt-qa «нет файла …»): постер и рендеры его карт, названные карты,
// карты комбо и видео врезок
export const deckAssets = (seg: DeckLike): SceneAsset[] => {
  const out: SceneAsset[] = [];
  if (seg.poster) {
    out.push({file: seg.poster.src, what: 'постер'});
    seg.poster.order.forEach((c) => out.push({file: `hs/render/${c}.png`, what: 'рендер карты постера'}));
  }
  (seg.cards ?? []).forEach((c) => out.push({file: `hs/render/${c.id}.png`, what: 'рендер названной карты'}));
  for (const ins of seg.inserts ?? []) {
    if (ins.kind === 'combo') ins.cards.forEach((c) => out.push({file: `hs/render/${c.id}.png`, what: 'карта комбо'}));
    if (ins.kind === 'clip') out.push({file: ins.src, what: 'видео врезки'});
  }
  return out;
};

// Карта темпа колоды (SceneDef.pace): заставка места топ-3 — «новинка», обычная колода — нет; врезки — новинки, карты под
// голос — нет. Сломаны привязки — только начало сцены
export const deckPace = (seg: DeckLike, t: SegTiming, anchored: boolean): ScenePace[] => {
  const top = seg.rank !== undefined && seg.rank <= TOP_REVEAL;
  const out: ScenePace[] = [{at: t.from, what: top ? `заставка топ-${seg.rank}` : `колода ${seg.rank ?? seg.name}`, news: top}];
  if (!anchored) return out;
  const at = timeAt(t, seg.vo, 30);
  for (const ins of seg.inserts ?? []) out.push({at: t.from + at(ins.at), what: ins.kind === 'clip' ? `врезка геймплея${ins.probe ? ' (проба)' : ''}` : 'разбор комбо', news: true});
  (seg.cards ?? []).forEach((c, k, all) => out.push({at: t.from + at(c.at, k, all.length), what: 'карта', news: false}));
  return out;
};

// ─── Проверки канала по Hearthstone (channel.qa; канал добавляет свой словарь бренда) ───
// Пороги обложки Hearthstone (их сливает LIMITS канала: studios/<студия>/channel.ts)
export const THUMB_LIMITS = {
  thumbLine: 14, // строка заголовка обложки длиннее — ⚠
};
// поля с данными статьи (список колоды, постер): не текст автора — TODO, привязки и гербы в них не ищем
const SOURCE = ['list', 'poster'];
type ThumbLike = {title: string; cards: string[]};
type HsConfig = {thumb: ThumbLike; thumbs?: Partial<ThumbLike>[]; segments: (BaseSeg & {rank?: number})[]};

// Обложки: head — в начало отчёта (TODO, повтор карт), tail — в конец (длина строк), как было до вариантов
const thumbIssues = (config: HsConfig) => {
  const head: Issue[] = [];
  const tail: Issue[] = [];
  if ((config.thumbs?.length ?? 0) > VIDEO_LIMITS.thumbVariants - 1) tail.push({level: 'warn', seg: 'thumb', what: `вариантов обложки ${1 + config.thumbs!.length} — в «Тест и сравнение» YouTube войдут первые ${VIDEO_LIMITS.thumbVariants}`});
  for (const {key, thumb} of thumbVariants(config)) {
    const seg = key === 'a' ? 'thumb' : `thumb-${key}`;
    todosOf(thumb, seg, new Set(SOURCE)).forEach((p) => head.push({level: 'error', seg, what: `не заполнено (TODO): ${p}`}));
    if (new Set(thumb.cards).size !== thumb.cards.length) head.push({level: 'warn', seg, what: `карта на обложке повторяется (${thumb.cards.join(', ')}) — нужны три разные`});
    thumb.title.split('\n').forEach((l) => l.length > THUMB_LIMITS.thumbLine && tail.push({level: 'warn', seg, what: `строка обложки длиннее ${THUMB_LIMITS.thumbLine} знаков: «${l}»`}));
  }
  return {head, tail};
};

// Ролик целиком: сильное начало и передышки в длинном топе (заметки)
const videoNotes = (config: HsConfig): Issue[] => {
  const out: Issue[] = [];
  if (!config.segments.some((s) => s.kind === 'hook')) out.push({level: 'info', seg: 'ролик', what: 'нет сильного начала (hook) — первые секунды решают, досмотрят ли ролик'});
  const decks = config.segments.filter((s) => s.kind === 'deck' && s.rank !== undefined).length;
  if (decks >= 10 && !config.segments.some((s) => s.kind === 'divider')) out.push({level: 'info', seg: 'ролик', what: `${decks} колод без разделителей блоков (divider) — длинная середина без передышки`});
  return out;
};

export const hsQa: ChannelQa = {
  skip: SOURCE,
  pronounce: GAME_PRONOUNCE,
  pronounceFile: 'src/games/hearthstone/data/pronounce.json',
  head: (config: HsConfig) => [...thumbIssues(config).head, ...videoNotes(config)],
  // герб неизвестного класса — сразу после TODO
  segment: (seg: BaseSeg): AuditIssue[] =>
    unknownClasses(seg, seg.id).map((c) => ({level: 'error', what: `неизвестный класс „${c.cls}“ (${c.path}) — в кадре будет герб Воина; напишите по-русски («Чернокнижник») или ключом HearthstoneJSON (WARLOCK)`})),
  tail: (config: HsConfig) => thumbIssues(config).tail,
};
