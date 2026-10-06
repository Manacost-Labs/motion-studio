// Реестр сцен ролика под голос. Сцена описывается один раз — SceneDef рядом с её компонентом; канал перечисляет свои
// сцены в defineChannel. Отсюда берут всё: движок (VoicedVideo — какой компонент рисовать, где субтитры), расчёт под голос
// (calcVoiced — пауза до голоса, хвост, наименьшая длина, глава), проверка (audit сцены) и скрипты (assets).
// Тип конфига ролика выводится из канала: ConfigOf<typeof channel> — сегменты только тех видов, что есть в канале,
// поэтому сцена чужой игры или опечатка в kind не проходит tsc.
import type React from 'react';
import type {Sub} from '../voice/timing';
import type {BaseSeg, SegTiming, VoicedConfig} from './types';
import type {ChannelQa} from '../qa/audit';

// Пропсы компонента сцены: сегмент, его хронометраж, идут ли в кадре субтитры (сцена оставляет им нижнюю полосу)
// и общее для всех сцен ролика ctx (считает channel.context — например, места топа и итоговая таблица)
export type SceneProps<S extends BaseSeg, X = unknown> = {seg: S; t: SegTiming; subs: boolean; ctx: X};

// Находка проверки сцены (yt-qa): ❌ error — ролик не готов, ⚠ warn — посмотреть, ℹ info — заметка
export type AuditIssue = {level: 'error' | 'warn' | 'info'; what: string};
// Что проверке сцены известно о ролике: идут ли в кадре субтитры
export type AuditCtx = {subs: boolean};
// Файл из public, без которого сцена не соберётся: что это (для отчёта yt-qa)
export type SceneAsset = {file: string; what: string};
// Где стоят субтитры сцены: центр строки по x и наибольшая ширина (в пикселях кадра 1920×1080)
export type SubtitleZone = {cx: number; maxW: number};
// Событие карты темпа сцены (yt-qa → pace.md): at — кадр-30 от начала ролика, news — «новинка» (ломает однообразие)
export type ScenePace = {at: number; what: string; news: boolean};

// Правила сцены. Время — в «кадрах-30» (core/time/fps.ts). Не заданное берётся из умолчаний движка (core/voice/calc.ts):
// lead — пауза до начала голоса (LEAD), tail — хвост после голоса (TAIL), min — наименьшая длина сцены (MIN);
// chapter — название главы в описании YouTube: false — своей главы нет (сцена входит в следующую), строка или функция —
// по умолчанию, если в сегменте нет своего chapter (без всего — заголовок сегмента title или вид сцены);
// subtitleZone — зона субтитров (иначе — зона стиля); audit — проверки данных сцены (yt-qa); assets — нужные файлы;
// silent — сцена без голоса и субтитров (разделитель): yt-qa не проверяет у неё запись и субтитры;
// jumps — где в сцене резкая смена кадра задумана (кадры-30 от начала ролика: t.from + …) — yt-qa не считает их рывками;
// pace — события сцены для карты темпа (anchored — все фразы-привязки найдены в vo; без pace сцена — одна «новинка» в начале);
// thumb — картинки сцены, годные для обложки (запас: подсказка заготовке и листу обложек)
export type SceneDef<S extends BaseSeg = BaseSeg, X = unknown> = {
  kind: S['kind'];
  Component: React.FC<SceneProps<S, X>>;
  lead?: number | ((seg: S) => number);
  tail?: number | ((seg: S) => number);
  min?: number | ((seg: S) => number);
  chapter?: false | string | ((seg: S) => string);
  subtitleZone?: SubtitleZone;
  audit?: (seg: S, t: SegTiming, ctx: AuditCtx) => AuditIssue[];
  assets?: (seg: S) => SceneAsset[];
  silent?: boolean;
  jumps?: (seg: S, t: SegTiming) => [number, number][];
  pace?: (seg: S, t: SegTiming, anchored: boolean) => ScenePace[];
  thumb?: (seg: S) => string[];
};

// Описать сцену: defineScene<DeckSeg, {rankOf?: number}>({kind: 'deck', Component, …}) — X — что сцене нужно из ctx канала
export const defineScene = <S extends BaseSeg, X = unknown>(def: SceneDef<S, X>): SceneDef<S, X> => def;

// ─── Стиль (look): то, что движок рисует вокруг сцен ───
// Frame — переход сцены (вход и выход на стыке; i — номер сегмента, ctx — общее канала, например места топа)
export type FrameProps<X = unknown> = {i: number; dur: number; first: boolean; last: boolean; ctx: X; children: React.ReactNode};
export type VoicedLook<X = unknown> = {
  Backdrop: React.FC; // фон под всеми сценами
  Frame: React.FC<FrameProps<X>>;
  Subtitles: React.FC<{subs: Sub[]; cx: number; bottom: number; maxW: number}>;
  subtitles: SubtitleZone & {bottom: number}; // зона субтитров по умолчанию и отступ снизу
  Overlay?: React.FC; // поверх всех сцен (виньетка, зерно)
  overlap: number; // кадров перекрытия сцен на стыке: уходящая сцена живёт ещё столько поверх входа следующей
  cut?: {file: string; volume: number; before: number}; // звук стыка из public — за before кадров до начала сцены
};

// ─── Канал ───
// look — стиль, brand и game — ключи brands/<brand> и games/<game> (как в studios.json), context — общее для сцен ролика
// (хук игры: считается один раз по всем сегментам), fields — поля конфига канала сверх голоса (только тип: fields<…>()),
// scenes — все виды сцен канала; qa — проверки канала для yt-qa (обложка, словари, сегменты целиком — core/qa/audit.ts)
export type ChannelDef<Scenes extends readonly SceneDef<any, any>[], X, F> = {
  look: VoicedLook<X>;
  brand: string;
  game: string | null;
  context: (segs: readonly BaseSeg[]) => X;
  fields: F;
  scenes: Scenes;
  qa?: ChannelQa;
};
export type Channel<Scenes extends readonly SceneDef<any, any>[] = readonly SceneDef<any, any>[], X = any, F = unknown> = ChannelDef<Scenes, X, F> & {
  byKind: Record<string, SceneDef<any, X>>;
};

// Только тип: fields<{title: string; …}>() — поля конфига канала (в рантайме — пустой объект)
export const fields = <F extends object>(): F => ({}) as F;

// Два SceneDef одного kind (например, points стиля и points игры) — ошибка: иначе молча победила бы последняя
export const defineChannel = <const Scenes extends readonly SceneDef<any, X>[], X, F>(def: ChannelDef<Scenes, X, F>): Channel<Scenes, X, F> => {
  const twice = def.scenes.map((s) => s.kind).filter((k, i, all) => all.indexOf(k) !== i);
  if (twice.length) throw new Error(`defineChannel: сцена вида «${[...new Set(twice)].join('», «')}» перечислена в scenes дважды — оставьте одну (channel.ts → scenes)`);
  return {...def, byKind: Object.fromEntries(def.scenes.map((s) => [s.kind, s]))};
};

// Правила сцены по виду сегмента; вид не из канала — ошибка (tsc ловит это в конфиге, здесь — данные снаружи)
export const sceneOf = <X>(channel: {byKind: Record<string, SceneDef<any, X>>}, kind: string): SceneDef<any, X> => {
  const def = channel.byKind[kind];
  if (!def) throw new Error(`Сцена вида «${kind}» не зарегистрирована в канале (channel.ts → scenes)`);
  return def;
};

// Сегмент сцены (union по всем сценам канала) и конфиг ролика канала
export type SegOf<C> = C extends {scenes: readonly (infer D)[]} ? (D extends SceneDef<infer S, any> ? S : never) : never;
export type ConfigOf<C> = C extends {fields: infer F} ? VoicedConfig<SegOf<C>> & F : never;
