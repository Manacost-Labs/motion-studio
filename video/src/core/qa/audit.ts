// Автопроверка ролика под голос по данным — без рендера, за секунды (scripts/yt-qa.mjs, yt-export.mjs). Ловит то, что
// иначе видно только после часового рендера: нет голоса, субтитры-вспышки и висящие предлоги, фразы-привязки не из текста
// диктора, TODO заготовки, главы не по правилам YouTube, долгий кусок без «новинки». Без игры и стиля:
// проверки сцены своего вида — SceneDef.audit (и jumps, pace, silent — core/video/registry.ts), проверки канала (обложка,
// словари, сегменты целиком) — channel.qa (ChannelQa ниже; у Hearthstone — games/hearthstone/data/audit.ts → hsQa).
// Пороги — VIDEO_LIMITS (./limits.ts). Скрипты собирают канал студии вместе с этим файлом (scripts/lib/channel.mjs) и
// берут qaOf(channel). Время — в «кадрах-30» (core/time/fps.ts)
import {stripTags} from '../voice/timing';
import {sceneOf, SceneDef} from '../video/registry';
import type {AuditIssue} from '../video/registry';
import type {BaseSeg, VoicedConfig, VoicedTiming} from '../video/types';
import {VIDEO_LIMITS} from './limits';

// Находка: ❌ error — ролик не готов, ⚠ warn — посмотреть, ℹ info — заметка; seg — сцена или раздел отчёта
export type Issue = {level: 'error' | 'warn' | 'info'; seg: string; what: string};

// Проверки канала (channel.qa): skip — поля с данными источника (не текст автора): в них не ищем TODO и фразы-привязки;
// pronounce — словари игры и канала (ролик добавляет свой config.pronounce, позже — главнее, как в scripts/vo-lib.mjs);
// pronounceFile — куда добавлять сокращения (подсказка в отчёте); head — в начало отчёта (обложка, заметки о ролике),
// segment — ранние проверки каждого сегмента (сразу после TODO), tail — после сцен (перед описанием и темпом)
export type ChannelQa = {
  skip?: string[];
  pronounce?: Record<string, string>;
  pronounceFile?: string;
  head?: (config: any) => Issue[];
  segment?: (seg: any) => AuditIssue[];
  tail?: (config: any) => Issue[];
};

// Описание и поиск YouTube (поля канала: config.title, config.seo)
type SeoFields = {lead: string; hashtags?: string[]; tags?: string[]; titles?: string[]};
type QaConfig = VoicedConfig<any> & {title: string; seo?: SeoFields};
type QaChannel = {byKind: Record<string, SceneDef<any, any>>; qa?: ChannelQa};

const BASE = 30;
const sec = (frames: number) => `${(frames / BASE).toFixed(1)} с`;
export const clock = (frames: number) => {
  const s = Math.floor(frames / BASE);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const DANGLING = /(^|\s)(в|и|с|к|у|о|а|на|по|из|до|за|от|не|но|что)$/i;

// Строки с TODO (их оставляет заготовка ролика — пока они есть, ролик не готов); skip — поля данных источника
export const todosOf = (v: unknown, path: string, skip: ReadonlySet<string> = new Set(), out: string[] = []) => {
  if (typeof v === 'string' && v.includes('TODO')) out.push(path);
  else if (Array.isArray(v)) v.forEach((x, i) => todosOf(x, `${path}[${i}]`, skip, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (!skip.has(k)) todosOf(x, `${path}.${k}`, skip, out);
  return out;
};

// Варианты обложки: A — thumb, B и C — thumbs поверх него (композиции <id>-thumb, <id>-thumb-b, <id>-thumb-c)
export const thumbVariants = <T extends object>(config: {thumb: T; thumbs?: Partial<T>[]}): {key: string; thumb: T}[] => [
  {key: 'a', thumb: config.thumb},
  ...(config.thumbs ?? []).slice(0, VIDEO_LIMITS.thumbVariants - 1).map((v, i) => ({key: 'bc'[i], thumb: {...config.thumb, ...v}})),
];

// Текст диктора: числа — словами, без латиницы (диктор прочтёт по-английски), без [excited] (Alex Bell кричит),
// сокращения — с подсказкой, как читать (pronounce)
// Римские цифры в именах («Джарван IV», «Генрих VIII») — I, V, X до XXXIX: диктор читает их по-русски, это не латиница
const ROMAN = /^X{0,3}(IX|IV|V?I{0,3})$/;
const voIssues = (vo: string, pronounce: Record<string, string>, file: string) => {
  const issues: string[] = [];
  const shown = stripTags(vo);
  const digits = shown.match(/\d+/g);
  if (digits) issues.push(`в тексте диктора цифры (${[...new Set(digits)].slice(0, 4).join(', ')}) — напишите словами: «сорок восемь»`);
  // слова словаря: ключ целиком или латинское слово из ключа в несколько слов («Jarvan IV» → Jarvan)
  const known = new Set(Object.keys(pronounce).flatMap((k) => [k, ...(k.match(/[A-Za-z][A-Za-z'’-]*/g) ?? [])]));
  const latin = shown.match(/[A-Za-z][A-Za-z'’-]*/g)?.filter((w) => !known.has(w) && w !== 'TODO' && !ROMAN.test(w));
  if (latin?.length) issues.push(`латиница в тексте диктора (${[...new Set(latin)].slice(0, 4).join(', ')}) — напишите по-русски или добавьте в pronounce.json`);
  if (/\[excited\]/i.test(vo)) issues.push('тег [excited] — диктор с ним кричит; живость словами и паузами, [warmly] или [curious]');
  const caps = shown.match(/(?<![А-ЯЁA-Z])[А-ЯЁ]{2,4}(?![А-ЯЁа-яё])/g)?.filter((w) => !pronounce[w]);
  if (caps?.length) issues.push(`сокращения без подсказки, как читать (${[...new Set(caps)].join(', ')}) — добавьте в ${file}: "ДК": "дэ-ка"`);
  return issues;
};

// Карта темпа: «новинки» — то, что ломает однообразие сцен (у каждой сцены — SceneDef.pace; без него сцена — новинка).
// Смена трека музыки не считается: подложка — петли по 30 с, они меняются всегда
export type PaceEvent = {at: number; seg: string; what: string; news: boolean};

// Проверки ролика канала: qaOf(channel) → {audit, assetsOf, expectedJumps, paceOf, chapterList, thumbVariants}
export const qaOf = (channel: QaChannel) => {
  const qa = channel.qa ?? {};
  const skip = new Set(qa.skip ?? []);

  // Все фразы-привязки сегмента (поля at, to и …At на любой глубине, кроме данных источника): каждая должна быть в vo
  const anchorsOf = (seg: BaseSeg) => {
    const found: {path: string; text: string}[] = [];
    const walk = (v: unknown, path: string) => {
      if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
      else if (v && typeof v === 'object')
        for (const [k, x] of Object.entries(v)) {
          if (skip.has(k)) continue;
          if ((k === 'at' || k === 'to' || k.endsWith('At')) && typeof x === 'string') found.push({path: `${path}.${k}`, text: x});
          else walk(x, `${path}.${k}`);
        }
    };
    walk(seg, seg.id);
    return found;
  };
  const lostOf = (seg: BaseSeg) => {
    const shown = stripTags(seg.vo).toLowerCase();
    return anchorsOf(seg).filter((a) => !shown.includes(a.text.toLowerCase()));
  };

  // Где резкая смена кадра задумана (в «кадрах-30» от начала ролика) — SceneDef.jumps сцен (врезка чужого видео,
  // уход заставки, перелистывание); сцена со сломанными привязками не считается
  const expectedJumps = (config: QaConfig, timing: VoicedTiming): [number, number][] => {
    const zones: [number, number][] = [];
    config.segments.forEach((seg, i) => {
      if (lostOf(seg).length) return;
      zones.push(...(sceneOf(channel, seg.kind).jumps?.(seg, timing.segments[i]) ?? []));
    });
    return zones;
  };

  // Файлы сцен из public (SceneDef.assets): без них ролик не соберётся — yt-qa пишет «нет файла …»
  const assetsOf = (config: QaConfig) => config.segments.flatMap((seg) => (sceneOf(channel, seg.kind).assets?.(seg) ?? []).map((a) => ({seg: seg.id, ...a})));

  // Главы описания YouTube (кадры-30 от начала ролика): сцена без главы (начало, разделитель) входит в следующую —
  // глава начинается с её начала, первая с 0:00. Тот же список пишет scripts/yt-export.mjs в description.txt
  const chapterList = (config: QaConfig, timing: VoicedTiming) =>
    config.segments.flatMap((s, i) => {
      const title = timing.segments[i].chapter;
      if (!title) return [];
      let k = i;
      while (k > 0 && !timing.segments[k - 1].chapter) k--;
      return [{seg: s.id, from: timing.segments[k].from, title}];
    });

  const paceOf = (config: QaConfig, timing: VoicedTiming) => {
    const events: PaceEvent[] = [];
    config.segments.forEach((seg, i) => {
      const t = timing.segments[i];
      const def = sceneOf(channel, seg.kind);
      // привязки сломаны — время внутри сцены не посчитать (сцена даёт только своё начало)
      const own = def.pace ? def.pace(seg, t, !lostOf(seg).length) : [{at: t.from, what: `сцена ${seg.kind}`, news: true}];
      for (const e of own) events.push({at: e.at, seg: seg.id, what: e.what, news: e.news});
    });
    events.sort((a, b) => a.at - b.at);
    const news = events.filter((e) => e.news).map((e) => e.at);
    const marks = [0, ...news, timing.total];
    const gaps: [number, number][] = [];
    for (let i = 1; i < marks.length; i++) if (marks[i] - marks[i - 1] > VIDEO_LIMITS.paceGapSec * BASE) gaps.push([marks[i - 1], marks[i]]);
    return {events, gaps};
  };

  // Описание и SEO: название, лид, хэштеги, теги, варианты названий; главы — по правилам YouTube
  const seoIssues = (config: QaConfig, timing: VoicedTiming): Issue[] => {
    const out: Issue[] = [];
    const add = (level: Issue['level'], what: string) => out.push({level, seg: 'описание', what});
    const L = VIDEO_LIMITS;
    if (config.title.length > L.title) add('warn', `название ${config.title.length} зн. — длиннее ${L.title}, в поиске обрежется; ключевое — в первые 40`);
    if (/!{2,}/.test(config.title)) add('warn', 'в названии «!!» — спокойный тон, без кликбейта');
    const seo = config.seo;
    if (!seo) add('info', 'нет config.seo — описание начнётся с названия, без лида, хэштегов и тегов');
    else {
      if (!seo.lead.trim()) add('warn', 'пустой лид (seo.lead) — первая строка описания');
      if (seo.lead.length > L.lead) add('warn', `лид ${seo.lead.length} зн. — над «ещё» видно ~${L.lead}`);
      if (seo.lead.trim() === config.title.trim() || seo.lead.startsWith(config.title)) add('warn', 'лид повторяет название — напишите, о чём ролик, своими словами');
      if (/!{2,}/.test(seo.lead)) add('warn', 'в лиде «!!» — спокойный тон');
      const tags = (seo.hashtags ?? []).map((h) => h.replace(/^#/, ''));
      if (tags.length > L.hashtags) add('warn', `хэштегов ${tags.length} — над названием YouTube покажет только ${L.hashtags}`);
      tags.filter((h) => /\s/.test(h)).forEach((h) => add('warn', `хэштег с пробелом «${h}» — YouTube оборвёт его на пробеле`));
      const chars = (seo.tags ?? []).join(',').length;
      if (chars > L.tagsChars) add('warn', `теги вместе ${chars} зн. — YouTube сохранит не больше ${L.tagsChars}`);
      (seo.titles ?? []).forEach((t) => t.length > L.title && add('warn', `вариант названия ${t.length} зн. (> ${L.title}): «${t}»`));
    }
    // главы: первая с 0:00, не меньше трёх, каждая не короче 10 с — иначе YouTube молча не покажет главы.
    // Здесь ⚠ (черновик ролика ещё без голоса — длины по оценке), в release.mjs — ❌
    const ch = chapterList(config, timing);
    const s = (f: number) => Math.floor(f / BASE);
    if (ch.length < L.chapterMin) add('warn', `глав ${ch.length} — YouTube показывает главы, только если их не меньше ${L.chapterMin}`);
    if (ch.length && s(ch[0].from) !== 0) add('warn', `первая глава начинается с ${clock(ch[0].from)}, а не с 0:00 — YouTube не покажет главы`);
    ch.forEach((c, i) => {
      const len = s(i + 1 < ch.length ? ch[i + 1].from : timing.total) - s(c.from);
      if (len < L.chapterSec) add('warn', `глава «${c.title}» (${clock(c.from)}) длится ${len} с — короче ${L.chapterSec} с, YouTube не покажет главы`);
    });
    return out;
  };

  const audit = (config: QaConfig, timing: VoicedTiming): Issue[] => {
    const out: Issue[] = [];
    const L = VIDEO_LIMITS;
    const mode = config.subtitles ?? 'auto';
    // словари: игры (термины) → канала (бренд) — channel.qa.pronounce → ролика (особые слова); позже — главнее
    const pronounce: Record<string, string> = {...qa.pronounce, ...config.pronounce};
    out.push(...(qa.head?.(config) ?? []));
    config.segments.forEach((seg, i) => {
      const t = timing.segments[i];
      const add = (level: Issue['level'], what: string) => out.push({level, seg: seg.id, what});
      todosOf(seg, seg.id, skip).forEach((p) => add('error', `не заполнено (TODO): ${p}`));
      qa.segment?.(seg).forEach((x) => add(x.level, x.what));
      const lost = lostOf(seg);
      lost.forEach((a) => add('error', `фраза-привязка «${a.text}» (${a.path}) не найдена в vo — возьмите кусок текста диктора дословно`));
      if (lost.length) return; // остальные проверки сцены считают время по привязкам
      voIssues(seg.vo, pronounce, qa.pronounceFile ?? 'pronounce.json').forEach((w) => add('warn', w));
      const def = sceneOf(channel, seg.kind);
      if (def.silent) return; // сцена без голоса и субтитров (разделитель блоков)
      if (!t.voice) add('warn', 'нет записи голоса — длина и привязки по оценке текста');
      else if (!t.times) add('warn', 'текст изменён после записи голоса — привязки по доле текста, перезапишите сцену');
      // субтитры (в кадре или в .srt): нормы — строка ≤ 42 знаков (ℹ, > 50 — ⚠), не быстрее 17 знаков в секунду
      t.subs.forEach((s) => {
        const lines = s.text.split('\n');
        const flat = s.text.replace(/\n/g, ' ');
        const dur = (s.to - s.from) / BASE;
        if (dur < L.subMinSec) add('warn', `субтитр короче ${String(L.subMinSec).replace('.', ',')} с (${sec(s.to - s.from)}): «${flat}»`);
        if (lines.some((l) => l.length > L.subLineWarn)) add('warn', `строка субтитра длиннее ${L.subLineWarn} знаков: «${lines.find((l) => l.length > L.subLineWarn)}»`);
        else if (lines.some((l) => l.length > L.subLineInfo)) add('info', `строка субтитра длиннее ${L.subLineInfo} знаков: «${lines.find((l) => l.length > L.subLineInfo)}»`);
        if (dur > 0 && flat.length / dur > L.subCps) add('warn', `субтитр быстрее ${L.subCps} зн./с (${(flat.length / dur).toFixed(1)}): «${flat}»`);
        if (lines.slice(0, -1).some((l) => DANGLING.test(l))) add('warn', `висящий предлог в конце строки: «${s.text.replace(/\n/g, ' / ')}»`);
      });
      // проверки сцены своего вида (SceneDef.audit)
      const subs = mode === 'on' || (mode === 'auto' && !t.voice);
      def.audit?.(seg, t, {subs}).forEach((x) => add(x.level, x.what));
    });
    out.push(...(qa.tail?.(config) ?? []));
    out.push(...seoIssues(config, timing));
    for (const [a, b] of paceOf(config, timing).gaps) out.push({level: 'warn', seg: 'темп', what: `${clock(a)}–${clock(b)}: ${Math.round((b - a) / BASE)} с без «новинки» (врезка, разделитель, другая сцена) — out/${config.id}/pace.md`});
    return out;
  };

  return {audit, assetsOf, expectedJumps, paceOf, chapterList, thumbVariants};
};
