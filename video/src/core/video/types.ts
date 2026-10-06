// Общие типы ролика под голос — без игры и стиля. Ролик = конфиг (VoicedConfig) — список сегментов (сцен) любого вида,
// у каждого текст диктора vo; хронометраж (VoicedTiming) считает calcVoiced (core/voice/calc.ts) в calculateMetadata.
// Виды сцен и их правила — реестр канала (core/video/registry.ts: SceneDef, defineChannel, ConfigOf).
import type {Sub, VoTimes} from '../voice/timing';
import type {MusicCue} from '../audio/Music';

// Тезис на экране: заголовок (text) и пояснение (detail). Без at — тезисы распределяются по тексту равномерно
export type Point = {text: string; detail?: string; at?: string};

// Общее у всех сегментов: id (имя файла голоса public/vo/<ролик>/<id>.mp3), вид сцены kind (ключ в реестре канала),
// текст диктора vo (всё, что появляется «под голос», привязывается к фразе из него — поля at) и название главы
export type BaseSeg = {
  id: string;
  kind: string;
  vo: string;
  chapter?: string; // название главы в описании YouTube (по умолчанию — из реестра сцены: SceneDef.chapter)
};

// Голос диктора (scripts/tts.mjs). id — voice_id диктора (иначе ELEVENLABS_VOICE_ID из .env);
// speed 0.7–1.2, stability/similarity/style 0–1; seed — чтобы перезапись давала тот же дубль
// fx — обработка голоса (scripts/vo-fx.mjs): broadcast (по умолчанию), warm или off
// tempo — темп записи без изменения высоты (1.06 — на 6 % быстрее; применяет vo-align.mjs при нарезке)
export type VoiceSettings = {id?: string; speed?: number; stability?: number; similarity?: number; style?: number; seed?: number; fx?: 'broadcast' | 'warm' | 'off'; tempo?: number};

// Юридический блок бренда (brands/<канал>/channel.ts → legal): disclaimer — оговорка правообладателя, scripts/yt-export.mjs дописывает
// её в конец description.txt; policyUrl — политика правообладателя, откуда оговорка (дата сверки — в BRIEF.md студии); forbidden —
// товарные знаки и знаки, которых не должно быть в названии КАНАЛА: имя и сайт (BRAND), ссылки и подписи финала (LINKS), подвал
// описания (yt-qa — ❌); forbiddenInVideo — слова, выдающие ролик или канал за официальный, в названии, вариантах названия, тегах
// и хэштегах ролика (yt-qa — ❌; по умолчанию пусто — упоминать игру в названии ролика можно); forbiddenInTags — товарные знаки,
// которых по политике правообладателя нельзя в тегах и хэштегах (yt-qa — ❌); required — без оговорки ролик
// не выпускается (release.mjs — ❌). Пусто — оговорки нет (Hearthstone у Манакоста)
export type BrandLegal = {disclaimer: string; policyUrl: string; forbidden: string[]; forbiddenInVideo?: string[]; forbiddenInTags?: string[]; required: boolean};

// Конфиг ролика под голос: сегменты S — union сцен канала (ConfigOf<typeof channel> добавляет поля канала)
export type VoicedConfig<S extends BaseSeg = BaseSeg> = {
  id: string; // папка ролика в студии; голос ищется в public/vo/<id>/<сегмент>.mp3
  music: string[]; // треки по кругу с перекрёстным затуханием
  // фон-атмосфера под всем роликом — бесшовные петли из public (core/audio/Ambience.tsx): ['lib/amb/tavern-crowd.wav', 'lib/amb/tavern-fire.wav']
  ambience?: string[];
  fps?: 30 | 60; // частота кадров ролика (по умолчанию 30); тайминги шаблона — всегда в «кадрах-30» (core/time/fps.ts)
  subtitles?: 'auto' | 'on' | 'off'; // auto — только там, где ещё нет записи голоса
  voice?: VoiceSettings;
  // Как диктору читать слово: {'ОТК': 'о-тэ-кА'}. На экране и в субтитрах остаётся написание из vo.
  // В vo можно ставить аудиотеги v4 — [pause], [warmly], [curious] — диктор их исполнит, на экран они не попадут.
  // [excited] не ставить: Alex Bell с ним кричит
  pronounce?: Record<string, string>;
  segments: S[];
};

// ─── Рассчитывается в calculateMetadata (core/voice/calc.ts → calcVoiced) ───
// times — время (с от начала записи) начала и конца каждого символа текста на экране; есть, когда голос записан
export type SegTiming = {
  id: string;
  from: number;
  dur: number;
  voFrom: number;
  voDur: number;
  voice: string | null;
  subs: Sub[];
  times?: VoTimes;
  chapter?: string; // название главы в описании (реестр сцен → chapterOf); пусто — сцена входит в следующую главу
};
// всё в «кадрах-30»; base — их частота (для перевода в секунды)
export type VoicedTiming = {segments: SegTiming[]; music: MusicCue[]; total: number; base?: number};
export type VoicedProps<C extends VoicedConfig<BaseSeg> = VoicedConfig> = {config: C; timing?: VoicedTiming};
