# core — движок «ролик под голос»

Общий код YouTube-студий: время, голос, звук, эффекты, подгонка текста, проверки. Без игры, стиля и бренда —
сюда не попадают слова «колода», «чемпион», цвета «Компендиума» и логотипы каналов.

**Импорты.** core знает только `remotion`, `react` и `@remotion/*` и импортирует только core.
Нельзя: `looks/`, `games/`, `brands/`, `studios/`, `hearthpulse/` (проверяет `node scripts/check-layers.mjs`).
Только относительные пути, без алиасов tsconfig paths. Реклама HearthPulse (`src/hearthpulse`) core не использует.

| Файл | Что внутри |
|---|---|
| `time/fps.ts` | «кадры-30»: `BASE_FPS`, `FrameScale` (множитель K = fps / 30), `useK`, `useFrame` |
| `time/ease.ts` | `EASE_OUT`, `EASE_IN`, `EASE_IN_OUT` (и объект `EASE`), `clamp`, `ramp` |
| `voice/timing.ts` | расчёт под голос: `CPS`, `stripTags`, `estimateVo`, `anchorFrame`, `spreadFrame`, `timeAt`, субтитры (`splitSubs`, `twoLines`, `buildSubs`); типы `Sub`, `VoTimes`, `VoSpan` |
| `audio/Music.tsx` | музыка по кругу с перекрёстным затуханием `XFADE`, приглушение под речь; типы `MusicCue`, `MusicTiming` |
| `audio/Ambience.tsx` | фон-атмосфера: тихие петли под всем роликом |
| `audio/Sfx.tsx` | звуковой эффект на кадре (в «кадрах-30») |
| `fx/Grain.tsx` | зерно плёнки |
| `fx/DepthArt.tsx` | «живой» арт: параллакс по карте глубины (WebGL2, `scripts/depth.py`) |
| `layout/fit.tsx` | `useFitSize` — подгонка кегля под ширину; шрифт — `fontFamily` (по умолчанию `FIT_DISPLAY` = HSDisplay). Меряет только после загрузки шрифта (`delayRender`, ждёт семейство в `document.fonts`) |
| `qa/lint.tsx` | зонд раскладки кадра для `scripts/yt-lint.mjs` (`REMOTION_LINT`): `lintDom` — край, наложения, `data-qa-clear`; `readDom` — замеры читаемости (кегль в px 1080p с учётом transform, контраст с однотонным фоном, имена компонентов); размер кадра — из `useVideoConfig` |
| `voice/calc.ts` | `calcVoiced(channel)` — calculateMetadata ролика под голос: длина сцен по записи или тексту, паузы по реестру (`LEAD`, `TAIL`, `MIN` — умолчания; `leadOf`, `tailOf`, `minOf`, `chapterOf`), музыка по кругу |
| `video/types.ts` | `BaseSeg`, `Point`, `VoiceSettings`, `VoicedConfig<S>`, `SegTiming`, `VoicedTiming`, `VoicedProps`; `BrandLegal` — юридический блок бренда (`legal` в `brands/<канал>/channel.ts`) |
| `video/registry.ts` | реестр сцен: `SceneDef` (kind, Component, lead/tail/min, chapter, subtitleZone, audit, assets, silent, jumps, pace, thumb), `defineScene`, стиль `VoicedLook` (фон, переход `Frame`, субтитры, поверх, перекрытие, звук стыка), `defineChannel({look, brand, game, context, fields, scenes, qa})`, `sceneOf`, типы `SegOf`, `ConfigOf<typeof channel>` (union сцен канала — чужой `kind` не проходит tsc) |
| `video/VoicedVideo.tsx` | движок: сцены по реестру канала, переход и субтитры стиля, голос, звук стыка, музыка, атмосфера, `LintProbe`, плашка черновика |
| `qa/limits.ts` | `VIDEO_LIMITS` — общие пороги: субтитры, описание и SEO, читаемость на телефоне (`readMinPx`, `readMinContrast`), темп, файл к загрузке, обложки |
| `qa/audit.ts` | автопроверка данных ролика (yt-qa): `qaOf(channel)` → `audit`, `assetsOf`, `expectedJumps`, `paceOf`, `chapterList`, `thumbVariants`; проверки канала — `channel.qa` (`ChannelQa`), сцены — `SceneDef.audit`, `jumps`, `pace`, `silent` |
| `video/compositions.tsx` | `voicedCompositions(channel, Thumb)` — регистрация ролика в Root студии: композиция `<id>`, обложки `<id>-thumb`, `-thumb-b`, `-thumb-c` |

## Контракт: сцена и канал

- **Сцена** — `defineScene<S, X>({…})` в файле сцены (стиль — `looks/<стиль>/scenes`, игра — `games/<игра>/scenes`). `S` — сегмент
  (`BaseSeg` + свои поля), `X` — что сцене нужно из ctx канала. Поля `SceneDef`: `kind`, `Component` (пропсы `{seg, t, subs, ctx}`); `lead`, `tail`,
  `min` — кадры-30, число или функция от сегмента (умолчания `LEAD` = 10, `TAIL` = 14, `MIN` = 150 в `voice/calc.ts`); `chapter` —
  `false` (без главы), строка или функция — умолчание: `chapter` сегмента важнее; `subtitleZone`; `audit` (проверки сегмента для yt-qa), `assets` (файлы из `public/`),
  `silent` (сцена без голоса), `jumps` (резкие смены кадра — не считать рывком), `pace` (события карты темпа); `thumb` — запас, не подключён.
- **Стиль** — `VoicedLook<Ctx>`: фон `Backdrop`, переход `Frame`, `Subtitles` и их зона, `Overlay`, перекрытие `overlap`, звук стыка `cut`.
- **Канал** — `defineChannel({look, brand, game, context, fields, scenes, qa})` в `studios/<студия>/channel.ts`; `brand` и `game` —
  ключи из `studios.json`; `context(segs)` — общее для сцен (считается один раз); `fields: fields<F>()` — поля конфига сверх голоса;
  `qa` — проверки канала (`ChannelQa`: `skip`, `pronounce`, `pronounceFile`, `head`, `segment`, `tail`).
- **Тип конфига** — `ConfigOf<typeof channel>`: `VoicedConfig` + поля канала + сегменты только тех `kind`, что есть в `scenes`
  (чужой `kind` — ошибка tsc). Сегмент — `SegOf<typeof channel>`, `sceneOf(channel, kind)` — описание сцены (неизвестный `kind` — исключение).
- **Новая сцена** = файл сцены + строка в `scenes` канала; больше нигде ничего не регистрируется (`video/STUDIO.md`, «Реестр сцен и тип конфига»).
- **Node.** `scripts/lib/channel.mjs` собирает `channel.ts` со всеми сценами esbuild'ом для `yt-qa`, `yt-export`, `release`. Модули core
  и сцен не трогают браузер при импорте (`fetch`, `document`, `loadFont` — под `typeof document !== 'undefined'`), иначе скрипты упадут.

**Переезд (этап B) закончен.** Реэкспортов со старых путей шаблона `studios/manacost-youtube/template` нет; карта, куда что переехало, — `studios/manacost-youtube/template/README.md`.
`LIMITS` канала (свои пороги + `VIDEO_LIMITS`) — в `channel.ts` студии.
