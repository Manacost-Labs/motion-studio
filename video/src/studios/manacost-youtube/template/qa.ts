// Автопроверка ролика по данным — без рендера, за секунды (вызывает scripts/yt-qa.mjs). Ловит то, что иначе видно
// только после часового рендера: нет голоса, субтитры-вспышки и висящие предлоги, колода без движения, длинные надписи,
// врезка без автора. Пороги — из правил шаблона (README «Дизайн», PLAN.md).
import {planCamera} from './parts/posterCam';
import {recapTurn, stripTags, timeAt, TOP_REVEAL} from './timing';
import {REVEAL_HOLD} from './parts/rankReveal';
import {DeckSeg, SegTiming, YtConfig, YtSegment, YtTiming} from './types';
import PRONOUNCE from '../pronounce.json';

export type Issue = {level: 'error' | 'warn' | 'info'; seg: string; what: string};

const BASE = 30;
const sec = (frames: number) => `${(frames / BASE).toFixed(1)} с`;
const DANGLING = /(^|\s)(в|и|с|к|у|о|а|на|по|из|до|за|от|не|но|что)$/i;

// Сколько подряд кадров колода стоит без движения камеры, подъёма карты или врезки
const longestIdle = (seg: DeckSeg, t: SegTiming, subs: boolean) => {
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

// Где резкая смена кадра задумана (в «кадрах-30» от начала ролика): чужое видео во врезке и уход сукна заставки топ-3
export const expectedJumps = (config: YtConfig, timing: YtTiming): [number, number][] => {
  const zones: [number, number][] = [];
  config.segments.forEach((seg, i) => {
    const t = timing.segments[i];
    const shown = stripTags(seg.vo).toLowerCase();
    if (anchorsOf(seg).some((a) => !shown.includes(a.text.toLowerCase()))) return;
    if (seg.kind === 'outro' && seg.recap) zones.push([t.from + recapTurn(seg, t) - 4, t.from + recapTurn(seg, t) + 24]); // перелистывание итоги → заставка
    if (seg.kind !== 'deck') return;
    const at = timeAt(t, seg.vo, 30);
    if (seg.rank !== undefined && seg.rank <= TOP_REVEAL) zones.push([t.from + REVEAL_HOLD, t.from + REVEAL_HOLD + 20]);
    for (const ins of seg.inserts ?? []) if (ins.kind === 'clip') zones.push([t.from + at(ins.at) - 8, t.from + (ins.to ? at(ins.to) : t.dur)]);
  });
  return zones;
};

// Все фразы-привязки сегмента (поля at, to и …At на любой глубине, кроме данных колоды из статьи): каждая должна быть в vo
const anchorsOf = (seg: YtSegment) => {
  const found: {path: string; text: string}[] = [];
  const walk = (v: unknown, path: string) => {
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (v && typeof v === 'object')
      for (const [k, x] of Object.entries(v)) {
        if (k === 'list' || k === 'poster') continue;
        if ((k === 'at' || k === 'to' || k.endsWith('At')) && typeof x === 'string') found.push({path: `${path}.${k}`, text: x});
        else walk(x, `${path}.${k}`);
      }
  };
  walk(seg, seg.id);
  return found;
};

// Строки с TODO (их оставляет заготовка scripts/yt-new.mjs — пока они есть, ролик не готов)
const todosOf = (v: unknown, path: string, out: string[] = []) => {
  if (typeof v === 'string' && v.includes('TODO')) out.push(path);
  else if (Array.isArray(v)) v.forEach((x, i) => todosOf(x, `${path}[${i}]`, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (k !== 'list' && k !== 'poster') todosOf(x, `${path}.${k}`, out);
  return out;
};

// Текст диктора: числа — словами, без латиницы (диктор прочтёт по-английски), без [excited] (Alex Bell кричит),
// сокращения — с подсказкой, как читать (pronounce)
const voIssues = (vo: string, pronounce: Record<string, string>) => {
  const issues: string[] = [];
  const shown = stripTags(vo);
  const digits = shown.match(/\d+/g);
  if (digits) issues.push(`в тексте диктора цифры (${[...new Set(digits)].slice(0, 4).join(', ')}) — напишите словами: «сорок восемь»`);
  const latin = shown.match(/[A-Za-z][A-Za-z'’-]*/g)?.filter((w) => !pronounce[w] && w !== 'TODO');
  if (latin?.length) issues.push(`латиница в тексте диктора (${[...new Set(latin)].slice(0, 4).join(', ')}) — напишите по-русски или добавьте в pronounce.json`);
  if (/\[excited\]/i.test(vo)) issues.push('тег [excited] — диктор с ним кричит; живость словами и паузами, [warmly] или [curious]');
  const caps = shown.match(/(?<![А-ЯЁA-Z])[А-ЯЁ]{2,4}(?![А-ЯЁа-яё])/g)?.filter((w) => !pronounce[w]);
  if (caps?.length) issues.push(`сокращения без подсказки, как читать (${[...new Set(caps)].join(', ')}) — добавьте в src/studios/manacost-youtube/pronounce.json: "ДК": "дэ-ка"`);
  return issues;
};

export const audit = (config: YtConfig, timing: YtTiming): Issue[] => {
  const out: Issue[] = [];
  const mode = config.subtitles ?? 'auto';
  const pronounce: Record<string, string> = {...PRONOUNCE, ...config.pronounce}; // общий словарь студии + слова ролика
  todosOf(config.thumb, 'thumb').forEach((p) => out.push({level: 'error', seg: 'thumb', what: `не заполнено (TODO): ${p}`}));
  if (new Set(config.thumb.cards).size !== config.thumb.cards.length) out.push({level: 'warn', seg: 'thumb', what: `карта на обложке повторяется (${config.thumb.cards.join(', ')}) — нужны три разные`});
  if (!config.segments.some((s) => s.kind === 'hook')) out.push({level: 'info', seg: 'ролик', what: 'нет сильного начала (hook) — первые секунды решают, досмотрят ли ролик'});
  const decks = config.segments.filter((s) => s.kind === 'deck' && s.rank !== undefined).length;
  if (decks >= 10 && !config.segments.some((s) => s.kind === 'divider')) out.push({level: 'info', seg: 'ролик', what: `${decks} колод без разделителей блоков (divider) — длинная середина без передышки`});
  config.segments.forEach((seg, i) => {
    const t = timing.segments[i];
    const add = (level: Issue['level'], what: string) => out.push({level, seg: seg.id, what});
    todosOf(seg, seg.id).forEach((p) => add('error', `не заполнено (TODO): ${p}`));
    const shown = stripTags(seg.vo).toLowerCase();
    const lost = anchorsOf(seg).filter((a) => !shown.includes(a.text.toLowerCase()));
    lost.forEach((a) => add('error', `фраза-привязка «${a.text}» (${a.path}) не найдена в vo — возьмите кусок текста диктора дословно`));
    if (lost.length) return; // остальные проверки сцены считают время по привязкам
    voIssues(seg.vo, pronounce).forEach((w) => add('warn', w));
    if (seg.kind === 'divider') return; // разделитель блоков — без голоса и субтитров
    if (!t.voice) add('warn', 'нет записи голоса — длина и привязки по оценке текста');
    else if (!t.times) add('warn', 'текст изменён после записи голоса — привязки по доле текста, перезапишите сцену');
    // субтитры (в кадре или в .srt)
    t.subs.forEach((s) => {
      const lines = s.text.split('\n');
      if ((s.to - s.from) / BASE < 1.2) add('warn', `субтитр короче 1,2 с (${sec(s.to - s.from)}): «${s.text.replace(/\n/g, ' ')}»`);
      if (lines.some((l) => l.length > 50)) add('warn', `строка субтитра длиннее 50 знаков: «${lines.find((l) => l.length > 50)}»`);
      if (lines.slice(0, -1).some((l) => DANGLING.test(l))) add('warn', `висящий предлог в конце строки: «${s.text.replace(/\n/g, ' / ')}»`);
    });
    if (seg.kind !== 'deck') return;
    const subs = mode === 'on' || (mode === 'auto' && !t.voice);
    const idle = longestIdle(seg, t, subs);
    if (idle > 4 * BASE) add('warn', `колода стоит без движения ${sec(idle)} подряд`); // в кадре должно всегда что-то двигаться
    if (seg.name.length > 30) add('warn', `длинное название в шапке (${seg.name.length} зн.) — шрифт уменьшится`);
    if (!seg.points?.length) add('warn', 'нет тезисов (points) — левая колонка будет пустой');
    if ((seg.points?.length ?? 0) > 3) add('warn', `тезисов ${seg.points!.length} — больше трёх не помещается, оставьте главное`);
    const inks = (seg.cards ?? []).filter((c) => c.ink).length;
    if (inks > 3) add('warn', `обводок пером ${inks} — больше трёх на колоду рябит, оставьте ключевые`);
    (seg.points ?? []).forEach((p) => {
      if (p.text.length > 28) add('info', `тезис «${p.text}» (${p.text.length} зн.) займёт две строки`);
      if ((p.detail ?? '').length > 52) add('warn', `пояснение тезиса длиннее 52 знаков: «${p.detail}»`);
    });
    (seg.vs ?? []).forEach((v) => (v.label ?? v.cls).length > 22 && add('warn', `подпись матч-апа обрежется многоточием: «${v.label}»`));
    (seg.inserts ?? []).forEach((ins) => {
      if (ins.kind === 'clip' && !ins.credit.trim()) add('error', `врезка ${ins.src} без указания автора`);
      if (ins.kind === 'clip') add('info', `в сцене чужое видео (${ins.src}) — проверьте лицензию перед публикацией: ${ins.credit}`);
    });
  });
  config.thumb.title.split('\n').forEach((l) => l.length > 14 && out.push({level: 'warn', seg: 'thumb', what: `строка обложки длиннее 14 знаков: «${l}»`}));
  return out;
};
