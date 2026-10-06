# Каталог команд студии

Все команды — из `video/`. Подробные флаги — в шапке каждого скрипта (`scripts/<имя>`). Имена скриптов не меняются: на них ссылаются навыки, память и хуки.

**Область:** «общий» — любая студия; «YouTube» — YouTube-студии из реестра (сейчас только `manacost-youtube`; ролик ищется по id через `scripts/lib/studios.mjs` → `findVideo`); «Hearthstone» — только игра Hearthstone (статьи Манакоста, постеры колод, OBS-профиль); «реклама» — `hp-ads`, `hp-features`. **Тратит:** ₽ — кредиты, сеть — ходит в интернет без трат.

## Сборка и рендер

| Команда | Что делает | Область | Тратит |
|---|---|---|---|
| `npm run studio:ads` · `studio:features` · `studio:youtube` | Remotion Studio студии (порты 3000 · 3001 · 3002) | общий | — |
| `.\scripts\render.ps1 -Studio <ключ> -Comp <id> -Out <имя>` | рендер + мастеринг −14 LUFS; подробно — `render.md` | общий | — |
| `node scripts/stills.mjs --studio <ключ> <композиция> <кадры…>` | контрольные кадры | общий | — |
| `npx remotion still src/studios/<студия>/index.ts <композиция> <файл.png>` | один кадр, обложка (точка входа обязательна) | общий | — |
| `node scripts/new-direction.mjs --key … --dir … --game … --brand … --look <стиль \| new:<имя>> --prefix … --port … [--dry]` | новое направление: строка реестра, студия, игра, бренд, стиль-заглушка, `studio:<ключ>` в `package.json`, заготовки навыка и вкуса; ничего не перезаписывает (навык `studio-new-direction`) | общий | — |
| `node scripts/beats.mjs <трек>` | темп, длина доли в кадрах, сильные доли | общий | — |

## Проверки (подробно — `quality.md`)

| Команда | Что делает | Область | Тратит |
|---|---|---|---|
| `node scripts/check-layers.mjs [--strict \| --quiet \| --test]` | правила импортов слоёв; `--strict` — код 1 при новых нарушениях; `--test` — самопроверка разбора импортов (комментарии, строки) | общий | — |
| `node scripts/doc-check.mjs` | пути и команды в документах и навыках | общий | — |
| `node scripts/doctor.mjs` | окружение: ffmpeg, yt-dlp, Chrome, `.venv-vo`, ключи «есть/нет» | общий | — |
| `node scripts/credits.mjs [--need N]` | остаток ElevenLabs и Higgsfield — перед любой тратой | общий | сеть |
| `node scripts/yt-qa.mjs <id> [--no-video] [--video <файл>] [--allow-todo]` | данные, файлы, произношение, право (`legal` бренда: `forbidden` — в названии канала, `forbiddenInVideo` — в названии и тегах ролика, `forbiddenInTags` — товарные знаки в тегах и хэштегах), видео → `out/<id>/qa-report.md`; `--allow-todo` — «не заполнено (TODO)» не дают кода 1 (черновик) | YouTube | — |
| `node scripts/yt-lint.mjs <id> [сцена…]` | раскладка надписей → `out/<id>/lint-report.md`, код 1 при находках; читаемость на телефоне (кегль, контраст) — раздел «Читаемость», только ⚠ | YouTube | — |
| `node scripts/yt-board.mjs <id> [сцена…] [--at …] [--frames …]` | кадры сцен и листы `out/<id>/board/` | YouTube | — |
| `node scripts/yt-golden.mjs <id> [--dir qa/golden-joints] [--approve]` | эталоны сцен и стыков | YouTube | — |
| `node scripts/yt-snap.mjs <префикс> [id…]` | слепок данных композиций (sha1) — «рефакторинг ничего не изменил» | YouTube | — |
| `node scripts/judge.mjs <id> [--checks …] [--scenes …] [--backend …] [--strict] [--dry]` | смысловой судья → `out/<id>/judge.json` (нужен `release.mjs`) | YouTube | `jev`, `claude` — сеть и ключ |
| `node scripts/release.mjs <id> [--no-golden] [--no-video]` | проверка перед выпуском → `out/<id>/release.md`, `out/<id>/release.json` | YouTube | — |
| `node scripts/yt-thumb.mjs <id>` | лист читаемости вариантов обложки в малых размерах | YouTube | — |
| `node scripts/yt-metrics.mjs <id> <csv>` | удержание из YouTube Studio по сценам | YouTube | — |
| `node scripts/check-ads.mjs [папка] [--update <папка>]` | сверка закреплённой рекламы с эталоном | реклама | — |
| `.\scripts\qa.ps1 <видео> -Cuts <кадры>` | рывки и глитчи вне стыков | реклама | — |
| `.venv-vo/Scripts/python.exe scripts/cam-jitter.py <видео> <с> <длина>` | плавность камеры: шум < 0,06 px — ровно, > 0,1 — дрожь | общий | — |

## Голос и звук (подробно — `voice.md`, `eyes-ears.md`)

| Команда | Что делает | Область | Тратит |
|---|---|---|---|
| `node scripts/vo-align.mjs <id> --prepare [--only …]` → коннектор → `node scripts/vo-align.mjs <id>` | запись кусками через коннектор ElevenLabs и нарезка по сценам | YouTube | ₽ (коннектор) |
| `node scripts/vo-takes.mjs <id> [--dry]` | выбор лучшего дубля ключевых фраз | YouTube | — |
| `node scripts/tts.mjs <id> [--go]` | запись через API ElevenLabs; без `--go` — только смета | YouTube | ₽ с `--go` |
| `node scripts/vo-fx.mjs <id> [--preset …]` | обработка голоса (`broadcast`, `warm`, `off`) | YouTube | — |
| `.venv-vo/Scripts/python.exe scripts/ears.py <id> \| --video \| --compare` | «уши»: темп, паузы, крик, громкость | общий | — |
| `node scripts/foley.mjs` | шумовая отделка из библиотеки и синтеза → `public/lib/sfx/` | общий (таверна) | — |

## «Глаза» и геймплей (подробно — `eyes-ears.md`)

| Команда | Что делает | Область | Тратит |
|---|---|---|---|
| `node scripts/eyes.mjs look \| scenes \| search <…>` | разбор чужого ролика, планы, быстрый поиск | общий | сеть |
| `node scripts/eyes.mjs find "<запрос>"` | геймплей с авторами и правами; Twitch — категория Hearthstone | YouTube: общий, Twitch: Hearthstone | сеть |
| `node scripts/eyes.mjs cut <…> --name <имя> [--own \| --permission …]` | кусок в `public/clips/` + паспорт | общий | сеть |
| `node scripts/rec.mjs` · `rec.mjs take <клип> --name <имя>` | свои записи OBS → клипы → в ролик | Hearthstone | — |
| `.venv-vo/Scripts/python.exe scripts/depth.py <арт.jpg>` | карта глубины для `DepthArt` | общий | — |

## Только Hearthstone (YouTube Манакоста)

| Команда | Что делает | Тратит |
|---|---|---|
| `node scripts/yt-new.mjs <url> yt-<тема>` | заготовка ролика по статье одной командой | сеть |
| `node scripts/fetch-article.mjs <url> <папка>` | статья hs-manacost.ru → `article.json` | сеть |
| `node scripts/deck-posters.mjs <папка>` · `poster-fit.mjs <папка> [место]` · `calib-poster.mjs …` | постеры колод api.blizzcore.ru и раскладка карт | сеть |
| `node scripts/hs-assets.mjs <id…>` | рендеры и арты карт HearthstoneJSON | сеть |
| `node scripts/meta-stats.mjs yt-<тема>` | статистика меты (Koloda API, токен в `.env` необязателен) | сеть |

## Только League of Legends (игровой набор; студии пока нет)

Скрипты игры лежат в `scripts/games/lol/`, подробно — `src/games/lol/GAME.md`.

| Команда | Что делает | Тратит |
|---|---|---|
| `node scripts/games/lol/lol-data.mjs [--check]` | Data Dragon → кэш, `src/games/lol/data/ids.ts` и `champions.ts`, самопроверка; `--check` — по кэшу, без сети | сеть (без `--check`) |
| `node scripts/games/lol/lol-assets.mjs <чемпион…> [--items …] [--runes …] [--spells …]` | картинки чемпионов, предметов, рун по запросу ролика → `public/lol/` | сеть |

## Только реклама HearthPulse

| Команда | Что делает | Тратит |
|---|---|---|
| `node scripts/capture.mjs <имя>` · `capture-auth.mjs a-<имя>` | съёмка страниц сайта в 2x (закрытые — со входом пользователя) | сеть |
| `.\scripts\crop-ui.ps1 <файл.png>` | вырезка блоков интерфейса в `public/ui` | — |
| `node scripts/plates.mjs [h]` | стартовые кадры для живых фонов | — |
| `.\scripts\gen-live.ps1` · `gen-audio.ps1` · `node scripts/gen-library.mjs` | генерация в Higgsfield | ₽ |
| `.\scripts\library-sheets.ps1` | листы превью библиотеки | — |
| `prep-assets.ps1` | **не запускать**: рецепт первичной сборки, перезапишет `public/ui` закреплённой рекламы | — |

## Хуки (не переносить)

- `scripts/hooks/pre-commit` — типы, слои (`check-layers --strict`), `yt-qa` YouTube-роликов (ролик из коммита — полностью; при правке общего кода — все ролики, черновики с `--allow-todo`), `check-ads`; подключён `git config core.hooksPath video/scripts/hooks`.
- `scripts/hooks/stop-typecheck.mjs` — хук Claude Code «Stop» (`.claude/settings.json`): не даёт закончить ход с ошибками типов и новыми нарушениями слоёв.

## Общие модули скриптов (`scripts/lib/`)

Только для `import`: `paths.mjs` (`VIDEO`, `ROOT` — скрипты работают из любой папки), `env.mjs` (`loadEnv()`, `hasKey(name)` — значения не печатаются), `studios.mjs` (реестр, `findVideo(id)`), `remotion.mjs` (`CHROME`, `bundleStudio(key)`), `media.mjs` (`ff`, `probeDur`, `dims`), `text.mjs` (`mmss`, `slug`, `srtTime`, `addVideo` — строка ролика в `videos.ts`, концы строк LF и CRLF), `channel.mjs` (`loadChannel(key, name)` — канал студии из `channel.ts` в Node: `LIMITS`, помощники канала и `qa` = `qaOf(channel)` из `src/core/qa/audit.ts`; `loadBrand(key, name)` — бренд студии: `descriptionFooter`, `legal`; `channelTexts(brand)` — где у канала стоит его название; `forbiddenIn(text, words)`). Новый скрипт берёт общее отсюда, а не копирует; всё, что знает форму конфига (проверки, главы, ассеты), пишется TS-модулем в `src` и собирается через `loadChannel`.

Python-окружение `.venv-vo`: `python -m venv .venv-vo`, затем `.venv-vo/Scripts/python.exe -m pip install -r requirements.txt` (faster-whisper, PySceneDetect и т. д.).
