# Студия: архитектура и процесс

Как устроена студия целиком: слои кода, правила импортов, реестр сцен, куда класть новое, конвейер ролика и ворота качества. Пути — от `video/`. Процесс конкретного направления (команды, поля конфига) — в навыке направления; выбор навыка — таблица в корневом `CLAUDE.md` и навык `studio`.

Принцип документов: одно правило живёт в одном месте, остальные ссылаются. До начала работы читать не больше трёх файлов: навык направления, `TASTE.md` + вкус направления (`taste/`), при необходимости этот файл.

## Реестр студий

`src/studios/studios.json` — единственный список студий. Его читают скрипты (`scripts/lib/studios.mjs`: `studio(key)`, `studioDir(key)`, `entryPoint(key)`, `findVideo(id)`, `youtubeStudios()`), `render.ps1` и хуки. Новая студия — строка здесь, а не правка пяти скриптов. Файл пишется руками или `scripts/new-direction.mjs`, не генерируется: не удалять его и не возвращать из git целиком — убрать студию значит убрать её строку.

| Поле | Что значит | Пример |
|---|---|---|
| `key` | ключ для команд (`render.ps1 -Studio <key>`, `npm run studio:<key>`) | `ads`, `features`, `youtube`, `lol` |
| `dir` | папка в `src/studios/` | `manacost-youtube` |
| `kind` | `ads` · `features` · `youtube` | `youtube` |
| `title` | название для людей | «YouTube Манакоста» |
| `game` | `hearthstone` · `lol` · `null` — какой `src/games/<игра>` можно импортировать | `hearthstone` |
| `brand`, `look` | бренд канала (`src/brands/<brand>`) и стиль (`src/looks/<look>`) — какие можно импортировать | `manacost`, `compendium` |
| `idPrefix` | префикс id роликов (`yt-`) или `null` | `yt-` |
| `port` | порт Remotion Studio | 3000 · 3001 · 3002 · 3003 |
| `freeze` | как защищены готовые ролики: `check-ads` или `golden` (см. ниже) | `golden` |

Ключи существующих студий не меняются: `ads` (`hp-ads`, 3000), `features` (`hp-features`, 3001), `youtube` (`manacost-youtube`, 3002), `lol` (`lol-youtube`, 3003).

## Слои кода

Переезд по слоям закрыт (этапы B и C):

- **B — слои.** Шаблон YouTube Манакоста разобран на движок `core`, стиль «Компендиум», игру Hearthstone и бренд Манакоста; ролик собирается из реестра сцен (раздел «Реестр сцен и тип конфига»). Картинка и тайминги роликов не изменились (сверка `yt-snap`, `yt-golden`, `check-ads`). Старые пути `template/…` → новые — карта `src/studios/manacost-youtube/template/README.md`.
- **C — новое направление.** Студия заводится скаффолдом `scripts/new-direction.mjs` (раздел «Новое направление»); им заведена студия `lol-youtube` — она на стадии стиль-кадров. Юридический блок канала — `legal` бренда (`BrandLegal`, `src/core/video/types.ts`).

```
src/
  core/                    движок «ролик под голос» без игры, стиля и бренда — src/core/README.md
    time/                  fps.ts (BASE_FPS = 30, useK, useFrame), ease.ts (EASE, clamp, ramp)
    voice/                 timing.ts (CPS, stripTags, anchorFrame, timeAt, субтитры), calc.ts (calcVoiced; паузы LEAD, TAIL, MIN)
    audio/                 Music.tsx (приглушение под речь), Ambience.tsx, Sfx.tsx
    video/                 types.ts (BaseSeg, VoicedConfig), registry.ts (SceneDef, defineChannel, ConfigOf), VoicedVideo.tsx, compositions.tsx
    fx/                    Grain.tsx, DepthArt.tsx
    layout/                fit.tsx (useFitSize, шрифт параметром)
    qa/                    lint.tsx (зонд yt-lint), audit.ts (qaOf — проверки yt-qa), limits.ts (VIDEO_LIMITS)
  looks/
    compendium/            стиль «Компендиум»: theme.ts, motion.tsx, look.tsx, types.ts (CompendiumCtx), parts/, scenes/ (intro, outro, points, image, divider), showcase/README.md — src/looks/compendium/README.md
    gazette/               стиль «Газета» (LoL, выбран для фрагмента 04.10): theme.ts, parts.tsx, look.tsx
  games/
    hearthstone/           GAME.md; data/ (классы, картинки, постеры, камера, места, статья, проверки, словарь), scenes/ (hook, deck, cards, mulligan, matchups, points, thumb + parts/), fixtures/ (образец статьи, стенд постеров)
    lol/                   GAME.md; data/ (ids.ts и champions.ts — генерирует загрузчик scripts/games/lol/, словарь pronounce.json); сцен нет до выбора стиль-кадра
  brands/
    manacost/              channel.ts (MANACOST, ссылки, подвал описания, финал, YT_BASE, legal — пустой), archive.tsx (отвергнутый вид, не импортируется)
    lol-channel/           channel.ts — заготовка скаффолда: имя, сайт, ссылки, финал, музыка — TODO; legal (политика Riot, forbidden, forbiddenInVideo, forbiddenInTags, required; оговорка — TODO)
  hearthpulse/             бренд и движок рекламы HearthPulse; импортируют только hp-ads и hp-features. НЕ ДВИГАТЬ
  studios/
    studios.json           реестр студий (ads, features, youtube, lol)
    README.md, frozen.json реестр роликов и список закреплённых
    hp-ads/, hp-features/  студии рекламы (внутри закреплённые ролики с ref/)
    manacost-youtube/      тонкая сборка: channel.ts (канал), videos.ts (ролики), Root.tsx, judge.ts, pronounce.json (бренд), motion-showcase/, template/README.md (карта старых путей), yt-<тема>/
    lol-youtube/           студия LoL от скаффолда: channel.ts (scenes: [] — до стиля), videos.ts (пусто), Root.tsx (обложка и витрина — заглушки), BRIEF.md, README.md, pronounce.json, style-frames/ (StyleA–C, data.ts)
```

Импорт идёт только вниз: ролик → канал своей студии (`channel.ts`) → `brands`, `games`, `looks` → `core`. Сцены игры рисуются в стиле канала (`games/<игра>/scenes` → `looks/<стиль>`); стиль и игра не знают бренда — бренд, места топа и гербы приходят в сцены через контекст канала.

`src/hearthpulse` в слои не переносится: реклама уже изолирована, её папки закреплены.

### Новое направление

`node scripts/new-direction.mjs --key <ключ> --dir <канал>-<площадка> --game <игра> --brand <канал> --look <compendium | new:<имя>> --prefix <префикс>- --port <порт> [--title "…"] [--dry]` создаёт строку в `studios.json` и `studio:<key>` в `package.json`, папку студии (`index.ts`, `Root.tsx`, пустой `videos.ts`, `channel.ts`, `README.md`, `pronounce.json`, `BRIEF.md`), а если их ещё нет — игру (`GAME.md`, `data/`, `scenes/index.ts`, `scripts/games/<игра>/README.md`), бренд с `TODO` и `legal`, стиль-заглушку (`new:<имя>`), заготовки навыка и вкуса. Сцены готового стиля и игры попадают в `scenes` канала сами; у нового стиля — `scenes: []` с `TODO`. Ничего не перезаписывает: занятые ключ, папка, префикс или порт — ошибка с перечнем; сбой посреди записи — откат записанного. `--dry` — только план. Дальше — чек-лист навыка `studio-new-direction`.

Студия `lol-youtube` (ключ `lol`, порт 3003) — на стадии фрагмента: из трёх стиль-кадров (`lol-style-a`, `-b`, `-c`; `src/studios/lol-youtube/style-frames/`) для фрагмента выбран B — стиль `src/looks/gazette`; первая сцена `patch-champion` (`src/games/lol/scenes`) и ролик-фрагмент `lol-patch-26-19-demo` ждут отзыва (`taste/lol.md`). Бренд `lol-channel` — с `TODO`. Статус — паспорт `src/studios/lol-youtube/README.md`, бриф — `BRIEF.md` там же.

## Правила импортов

| Слой | Можно импортировать | Нельзя |
|---|---|---|
| `core` | только `core`; пакеты remotion, react, `@remotion/*` | looks, games, brands, studios, hearthpulse, другие пакеты |
| `looks/<стиль>` | core, свой стиль | games, brands, studios, другие looks |
| `games/<игра>/data` | core, своя `data` | looks, brands, studios, `fixtures`, другие игры |
| `games/<игра>/scenes` | core, своя игра (`data`, `scenes`), стиль студий этой игры (поле `look` в `studios.json`) | brands, studios, `fixtures`, чужие стили и игры |
| `games/<игра>/fixtures` | core, своя `data` и `fixtures` | looks, brands, studios (образцы берут только студии: демо, витрины, стенды) |
| `brands/<канал>` | core (`channel.ts` берёт только типы) | games, looks, studios |
| `studios/<студия>` | core; games, looks, brands — только свои (`game`, `look`, `brand` в `studios.json`) | другие студии; общий код студии — данные ролика (кроме регистрации в `Root.tsx`, `videos.ts`) |
| ролик студии-канала `<id>/config.ts` | `../channel` (корень своей студии), свои `article.json`, `meta.json` | core, looks, games, brands напрямую; витрины; чужие ролики |
| `hearthpulse` | только пакеты (remotion, react) | всё; импортируют его только студии бренда hearthpulse (`hp-ads`, `hp-features`) |

- Импорты только относительные (`../../core/video/registry`). Алиасы `paths` в tsconfig запрещены: tsc их примет, а webpack Remotion и вызовы `bundle()` — нет.
- Проверка: `node scripts/check-layers.mjs` — отчёт; `--strict` — код 1 при новых нарушениях (известных сейчас нет). **Блокирует:** pre-commit и Stop-хук вызывают `--strict --quiet`. Ролики рекламы (закреплены) живут по прежним правилам: правило «ролик видит только канал» касается студий с `channel.ts` в корне.
- `channel.ts` и всё, что он тянет (сцены, стиль, игра), скрипты собирают в Node (`scripts/lib/channel.mjs` → `yt-qa`, `yt-export`, `release`). Поэтому модуль не трогает браузер при импорте: `fetch`, `document`, `loadFont` — под `typeof document !== 'undefined'` (как в `src/looks/compendium/theme.ts`).

## Реестр сцен и тип конфига

Ролик под голос собирается из реестра сцен (`src/core/video/registry.ts`; контракт подробно — `src/core/README.md`):

- **Сцена** — компонент и его правила в одном файле: `defineScene<Seg, Ctx>({kind, Component, lead, tail, min, chapter, subtitleZone, audit, assets, silent, jumps, pace, thumb})`. `Seg` — тип сегмента, `Ctx` — что сцене нужно из контекста канала. Паузы по умолчанию — `LEAD`, `TAIL`, `MIN` в `src/core/voice/calc.ts`.
- **Канал** — `src/studios/<студия>/channel.ts`: `defineChannel({look, brand, game, context, fields, scenes, qa})`. `look` — стиль (`src/looks/compendium/look.tsx`), `context` — общее для сцен ролика (места топа, бренд, гербы, строки итогов), `fields` — поля конфига сверх голоса, `scenes` — все виды сцен канала (два `SceneDef` одного `kind` — ошибка), `qa` — проверки канала для `yt-qa`.
- **Тип конфига** выводится из канала: `ConfigOf<typeof channel>` (у Манакоста — `YtConfig`), сегмент — `SegOf<typeof channel>`. Это объединение сцен канала: сегмент чужого `kind` (сцена Hearthstone в ролике LoL, опечатка в `kind`) не проходит `tsc`, Stop-хук покажет ошибку сразу.
- **Регистрация** — `voicedCompositions(channel, Thumb)` (`src/core/video/compositions.tsx`) в `Root.tsx` студии: композиция `<id>` и обложки `<id>-thumb`, `-thumb-b`, `-thumb-c`; ролики — список `VIDEOS` в `videos.ts` студии.
- **Проверки** — `qaOf(channel)` (`src/core/qa/audit.ts`): общие (TODO, привязки `at`, текст диктора, субтитры, главы, SEO) + `channel.qa` (у Hearthstone — `hsQa` в `src/games/hearthstone/data/audit.ts`) + `audit`, `jumps`, `pace` сцен.

**Новая сцена = 1 файл + 1 строка:**

1. Файл сцены (компонент + `defineScene`): без игры — `src/looks/<стиль>/scenes/<сцена>.tsx`, сцена игры — `src/games/<игра>/scenes/<сцена>.tsx`. Тип сегмента — в файле или в `types.ts` той же папки; строка в `index.ts` папки — чтобы канал брал сцены одним импортом.
2. Строка в `scenes` канала — `src/studios/<студия>/channel.ts`.

Больше нигде ничего не регистрируется: длина, паузы, глава, зона субтитров, проверки и файлы сцены берутся из её `SceneDef`. Образец:

```ts
// src/looks/compendium/scenes/image.tsx — сцена стиля
export const image = defineScene<ImageSeg>({kind: 'image', Component: ImageScene});
// src/studios/manacost-youtube/channel.ts — строка в канале
scenes: [hook, intro, deck, cards, mulligan, matchups, points, image, dividerScene, outro],
```

## Куда класть новое

| Что | Куда |
|---|---|
| Приём движения HearthPulse | `src/hearthpulse/` (новой опцией, старое по умолчанию) + строка в витрину `Motion-Showcase` + `BRAND.md` |
| Приём стиля, деталь оформления без игры | `src/looks/<стиль>/parts/` (у «Компендиума» — `src/looks/compendium/parts/`) + строка в README стиля и в витрину (`yt-motion-showcase`: `src/studios/manacost-youtube/motion-showcase/Showcase.tsx`) |
| Сцена без игры (вступление, тезисы, картинка, разделитель, финал) | `src/looks/<стиль>/scenes/` + строка в `scenes` канала (раздел «Реестр сцен») |
| Сущность игры: данные, типы, классы, картинки, проверки (карта, класс, колода, чемпион, предмет) | `src/games/<игра>/data/` + строка в `GAME.md` игры |
| Сцена или деталь игры (постер колоды, ряд карт, матч-апы) | `src/games/<игра>/scenes/`, детали — `scenes/parts/` |
| Образец данных для демо, витрин, стендов | `src/games/<игра>/fixtures/` |
| Логотип, ссылки, подвал описания, финал, голос, музыка, оговорка канала | `src/brands/<канал>/channel.ts` |
| Что сцене нужно от игры и бренда (бренд, места топа, гербы, строки итогов) | `context` в `src/studios/<студия>/channel.ts`; тип — контекст стиля (у «Компендиума» `CompendiumCtx`, `src/looks/compendium/types.ts`) |
| Общий расчёт, звук, эффект, проверка (без слов «колода», «чемпион») | `src/core/` + строка в `src/core/README.md` |
| Порог проверки | общий — `VIDEO_LIMITS` в `src/core/qa/limits.ts`; сцен игры — `src/games/<игра>/data/audit.ts` (у Hearthstone `DECK_LIMITS`, `THUMB_LIMITS`); канала — `LIMITS` в `src/studios/<студия>/channel.ts` (собирает все). Документы называют константу и значение |
| Слово, которое диктор читает неверно | термин игры — `src/games/<игра>/data/pronounce.json`; бренд канала — `src/studios/<студия>/pronounce.json`; особое слово ролика — `pronounce` в его `config.ts` (позже — главнее; склеивают `scripts/vo-lib.mjs` и `channel.qa`) |
| Новое направление (игра, канал, площадка) | `node scripts/new-direction.mjs …` (раздел «Новое направление»), дальше — навык `studio-new-direction` |
| Новый ролик | `src/studios/<студия>/<id>/config.ts` + строка в `videos.ts` студии (у Манакоста делает `yt-new.mjs`); у рекламы — блок в `Root.tsx` студии |
| Общая функция скриптов | `scripts/lib/` (`paths`, `env`, `text`, `media`, `remotion`, `studios`, `channel`) |
| Новый скрипт игры | `scripts/games/<игра>/` (у LoL — `scripts/games/lol/`); старые скрипты Hearthstone остаются плоско в `scripts/` |
| Ассет | `public/` — пути не двигать; новое по пространствам имён `public/<игра>/…` |
| Закрытый план, разбор | `docs/history/` с шапкой «архив» |

Существующие скрипты не переименовывать: на их имена ссылаются навыки, память и хуки.

## Конвейер ролика

| # | Этап | Что получается | Ворота |
|---|---|---|---|
| 1 | Бриф | что за ролик, источник, формат, длина, ориентация; неизвестное — спросить одним списком | — |
| 2 | Заготовка | папка ролика, `config.ts` с `TODO`, регистрация (у YouTube — `yt-new.mjs`, строка в `videos.ts`) | `tsc` |
| 3 | Данные | тексты, цифры только из источника, `vo`, привязки | `yt-qa --no-video` (у рекламы — длины текстов по `BRAND.md`) |
| 4 | Кадры | раскадровка, раскладка | `yt-lint`, `yt-board` / `stills.mjs`, при желании `judge.mjs` |
| 5 | Голос | смета → «да» → запись → нарезка | `credits.mjs`, `ears.py`, снова `yt-qa` |
| 6 | Фрагмент | 10–45 с черновиком (`render.ps1 -Draft -Frames`) | **«да» пользователя** |
| 7 | Рендер | полный файл (`render.ps1`, в фоне с `-Notify`) | лог `out/<Out>.render.log`, код 0 |
| 8 | Выпуск | `node scripts/release.mjs <id>` → `out/<id>/release.md` + `out/<id>/release.json` (нужны эталон `qa/golden/<id>/` и `judge.json`) | **ни одного ❌** |
| 9 | Сдача | файлы пользователю, строка в реестре `src/studios/README.md`, предложить коммит | слово пользователя на коммит |

Новый вид, приём или спорное решение — фрагментом до массовой правки. Долгий рендер — только после «да» на фрагменте.

## Ворота качества

| Проверка | Что ловит | Когда | Блокирует |
|---|---|---|---|
| `npx tsc --noEmit -p .` | ошибки типов, чужие поля и чужой `kind` в конфиге | Stop-хук после каждого хода, pre-commit | да |
| `node scripts/check-layers.mjs` | импорты против слоёв | Stop-хук и pre-commit (`--strict --quiet`) | да (новые нарушения) |
| `node scripts/doc-check.mjs` | битые пути и команды в документах и навыках | после правки `*.md` и навыков | отчёт |
| `node scripts/doctor.mjs` | ffmpeg, yt-dlp, Chrome, `.venv-vo`, ключи «есть/нет» | новая машина, странные сбои | — |
| `yt-qa.mjs <id>` | данные: TODO, привязки, текст диктора, пороги `LIMITS` канала, право (`legal` бренда); видео: громкость, цвет, рывки, тишина, пробные врезки | до и после рендера, pre-commit | ❌ — да |
| `yt-lint.mjs <id>` | текст за краем, текст на тексте, на постере; читаемость на телефоне — кегль < 24 px при 1080p, контраст < 4,5:1 (раздел «Читаемость», ⚠) | после правки сцен | код 1 (только раскладка) |
| `yt-golden.mjs <id>` | изменилась ли картинка сцен против `qa/golden/<id>/` | после любой правки `src/core`, `src/looks`, `src/games`, `src/brands` или канала | показывает |
| `yt-golden.mjs <id> --dir qa/golden-joints` | кадры стыков сцен | то же | показывает |
| `yt-snap.mjs <префикс>` | данные композиций (тайминги, конфиг) до и после рефакторинга — хэши должны совпасть | рефакторинг слоёв и канала | показывает |
| `check-ads.mjs` | закреплённая реклама изменилась | после правок `src/hearthpulse`, pre-commit | да |
| `judge.mjs <id>` | смысл: матч-апы, тезисы и фразы диктора против статьи; карты и обводки против текста | по запросу, перед фрагментом | только `--strict` |
| `release.mjs <id>` | всё к выпуску: файл, LUFS, главы, srt, обложка, паспорта клипов, свежесть, TODO | перед сдачей | ❌ — не сдавать |

Подробно о каждой команде и её флагах — `.claude/skills/studio/reference/quality.md`.

## Закрепление и эталоны

Два механизма, по полю `freeze` студии в реестре:

- **`check-ads` — закрепление готовой рекламы.** `src/studios/frozen.json` перечисляет закреплённые композиции, эталонные кадры лежат в `<студия>/<ролик>/ref/`. Закреплённую папку не правят; новая версия — копия папки (`launch30-v2`). Правки `src/hearthpulse` — только совместимые, после них `node scripts/check-ads.mjs`. Обновить эталон (`--update <папка>`) — только для осознанного улучшения и после «да» пользователя. Снимок состояния — тег `freeze-<дата>` по слову пользователя.
- **`golden` — эталоны YouTube.** `qa/golden/<id>/` (кадры сцен) и `qa/golden-joints/<id>/` (кадры стыков). Ролик не замораживается: слои и канал живут, а эталоны показывают, что изменилось. Одобренное пользователем изменение → `node scripts/yt-golden.mjs <id> --approve [сцена…]` (и с `--dir qa/golden-joints` для стыков); в `frozen.json` YouTube-ролики не записываются. Образец статьи `src/games/hearthstone/fixtures/sample-article.json` — основа эталонов `yt-template-demo`: менять только целиком и с пересъёмкой по слову пользователя.

## Хуки

- **pre-commit** (`scripts/hooks/pre-commit`, подключён `git config core.hooksPath video/scripts/hooks`): типы; слои (`check-layers --strict`); `yt-qa` роликов YouTube: ролик, чьи файлы в коммите, — целиком (TODO тоже останавливают); при правке общего кода (`src/core`, `src/looks`, `src/games`, `src/brands`, корень YouTube-студии, `studios.json`, скрипты голоса и Hearthstone, общие ассеты) — ролики, чей `config.ts` есть в git, с `--allow-todo` (чужие неотслеживаемые черновики не проверяются); `check-ads`, если менялся `src/hearthpulse`, студии рекламы или их ассеты. `--no-verify` — только по прямой просьбе пользователя.
- **Stop** (`.claude/settings.json` → `scripts/hooks/stop-typecheck.mjs`): не даёт закончить ход с ошибками типов в `src` и с новыми нарушениями слоёв.
- Сеть и платные проверки (`judge.mjs`, озвучка) в хуки не входят.

## Именование

- Папка студии — `<канал>-<площадка>` (`manacost-youtube`); имя LoL-канала без товарных знаков Riot.
- id ролика — префикс студии из реестра + тема + дата (`yt-legend-decks-oct26`).
- id композиций не менять никогда: от них зависят `qa/golden/<id>`, `render.ps1 -Comp` и навыки.

## Документы

| Файл | О чём |
|---|---|
| `../CLAUDE.md` | роутер: направление → навык → студия → игра |
| `STUDIO.md` | этот файл: архитектура и процесс |
| `TASTE.md`, `taste/` | вкус пользователя: общее и по направлениям |
| `BRAND.md` | бренд HearthPulse (раздел Манакоста — архив) |
| `LIBRARY.md` | библиотека ассетов `public/lib` (таверна, Hearthstone) |
| `src/studios/README.md` | реестр роликов, паспорта, статусы |
| `src/studios/manacost-youtube/README.md` | паспорт студии YouTube Манакоста: сцены, поля конфига, озвучка |
| `src/core/README.md` | движок: состав, контракт сцены и канала |
| `src/looks/compendium/README.md` | стиль «Компендиум»: детали, сцены стиля, дизайн |
| `src/games/hearthstone/GAME.md`, `src/games/lol/GAME.md` | игровые наборы: данные, термины, источники, право |
| `recordings/README.md` | свои записи игр (OBS) |
| `docs/history/` | закрытые планы — архив, не спецификация |
| `.claude/skills/studio/` | общий процесс и инструменты (справочники — `.claude/skills/studio/reference/`) |
