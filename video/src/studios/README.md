# Студии роликов

Студия — своя точка входа Remotion (`index.ts` + `Root.tsx`), своя Remotion Studio и свои шаблоны. Ролик — папка внутри своей студии: там его содержимое (тексты, кадры сайта, тайминги, музыка). Список студий — **`studios.json`** (единственный реестр: его читают скрипты через `scripts/lib/studios.mjs`, `render.ps1` и хуки; поля — `video/STUDIO.md`, раздел «Реестр студий»). Ниже — то же для людей.

| Студия | Папка | Что делает | Стиль | Запуск Studio | Рендер | Защита готовых |
|---|---|---|---|---|---|---|
| Реклама HearthPulse | `hp-ads/` | промо-ролики сайта hearthpulse.net | бренд HearthPulse — `src/hearthpulse` (`BRAND.md`) | `npm run studio:ads` (порт 3000) | `render.ps1` (по умолчанию `-Studio ads`) | `check-ads` |
| Обзоры новых функций HearthPulse | `hp-features/` | короткие анонсы разделов сайта по шаблону `hp-features/template` | бренд HearthPulse — `src/hearthpulse` | `npm run studio:features` (порт 3001) | `render.ps1 -Studio features` | `check-ads` |
| YouTube Манакоста | `manacost-youtube/` | ролики по статьям hs-manacost.ru под озвучку | «Компендиум»: канал `manacost-youtube/channel.ts` (паспорт — `manacost-youtube/README.md`) + бренд `src/brands/manacost` | `npm run studio:youtube` (порт 3002) | `render.ps1 -Studio youtube` | `golden` |
| YouTube по League of Legends | `lol-youtube/` | обзоры патчей, гайды, тир-листы на русском (навык `lol-youtube`); первая сцена `patch-champion` и фрагмент `lol-patch-26-19-demo` (04.10) ждут отзыва — бриф `lol-youtube/BRIEF.md` | стиль «Газета» `src/looks/gazette` (выбран для фрагмента по стиль-кадру B); канал `lol-youtube/channel.ts` + бренд `src/brands/lol-channel` + игра `src/games/lol` | `npm run studio:lol` (порт 3003) | `render.ps1 -Studio lol` | `golden` (эталонов пока нет) |

Зависимости идут только вниз: обе студии HearthPulse берут детали из `src/hearthpulse`; YouTube-студия от бренда HearthPulse не зависит: она собирает в `manacost-youtube/channel.ts` общие слои — движок `src/core`, стиль `src/looks/compendium`, игру `src/games/hearthstone`, бренд `src/brands/manacost`; импортов между студиями нет. Ассеты (`public/`) общие. Слои, правила импортов (`scripts/check-layers.mjs`) и «куда класть новое» — `video/STUDIO.md`. Новое направление (другая игра, канал, площадка) — навык `studio-new-direction`.

## Реестр роликов

| Студия | Папка | Что это | Композиции | Длина | Из чего собран | Готовые файлы | Статус |
|---|---|---|---|---|---|---|---|
| `hp-ads` | `launch30` | Основной рекламный ролик: хук, логотип, Стандарт, Матчапы, Карты (наведение), Арена, Поля сражений, Существо (графики Баюбота), «И ещё», финал с ценой | `HearthPulseAd`, `HearthPulseAd16x9` | 1090 кадров, 36,3 с | свой монтаж из сцен `src/hearthpulse` | `out/hearthpulse-9x16.mp4`, `out/hearthpulse-16x9.mp4` | закреплён 29.09.2026 |
| `hp-ads` | `library-showcase` | Витрина библиотеки ассетов `public/lib`, без звука | `Library-Showcase`, `Library-Showcase-16x9` | 1287 кадров, 42,9 с | компоненты `src/hearthpulse/library.tsx` | `out/library-showcase-9x16.mp4`, `out/library-showcase-16x9.mp4` | закреплён 29.09.2026 |
| `hp-features` | `feature-matchups` | Анонс раздела «Матчапы» | `Feature-Matchups`, `Feature-Matchups-16x9` | 410 кадров, 13,7 с | шаблон `hp-features/template` | `out/feature-matchups-9x16.mp4`, `out/feature-matchups-16x9.mp4` | закреплён 29.09.2026 |
| `manacost-youtube` | `yt-legend-decks-sep26` | «15 колод для Легенды в сентябре» по статье hs-manacost.ru, озвучка ElevenLabs v4 (Alex Bell) | `yt-legend-decks-sep26`, обложка `yt-legend-decks-sep26-thumb` | 8:19 | канал `manacost-youtube/channel.ts` | `out/yt-legend-decks-sep26/` (thumbnail.png, description.txt, subtitles.srt, script.md; полного 4K-рендера пока нет). Готовность к выпуску — `out/<id>/release.json` после `node scripts/release.mjs <id>` | черновик с голосом, ждёт одобрения |
| `manacost-youtube` | `yt-old-gods-oct26` | «Как создавались Древние боги» — блюпост «Власти Темной Империи» по статье hs-manacost.ru (не топ: сцены cards + points, карты из галереи Blizzard), озвучка ElevenLabs v4 (Alex Bell) | `yt-old-gods-oct26`, обложка `yt-old-gods-oct26-thumb` | 4:37 | канал `manacost-youtube/channel.ts` | `out/yt-old-gods-oct26/` (video.mp4 — 2K 2560×1440 60 к/с по просьбе пользователя, thumbnail.png, description.txt, subtitles.srt) | отрендерен в 2K, ждёт просмотра и «да» (эталон не утверждён) |

`out/hearthpulse-animatic.mp4` и `out/hearthpulse-v2-wip.mp4` — черновики первых версий, не для публикации.

**Служебные композиции** (не для публикации, не закреплены):
- `yt-template-demo` (конфиг в `manacost-youtube/motion-showcase/demo.ts`) — демонстрация всех сцен YouTube-канала на примере гайда; у неё есть эталоны `qa/golden/yt-template-demo/`.
- `yt-poster-calib`, `yt-poster-calib-8`, `yt-poster-calib-6` — калибровка раскладки карт на постере колоды (наложение «разностью»; стенд — `src/games/hearthstone/fixtures/PosterCalib.tsx`, геометрия — `src/games/hearthstone/GAME.md`).
- `yt-depth-lab` — «живой» арт (параллакс по карте глубины), рендер с `-Gl angle`; статус приёма — `video/taste/manacost-hs.md`.

**Витрины анимаций** (не для публикации, не закреплены): каждый приём движения отдельно, с подписью «имя для кода · длительность · кривая». Перед тем как придумывать новое движение — смотри здесь, что уже есть.
- `hp-ads/motion-showcase` — `Motion-Showcase`, `Motion-Showcase-16x9`: 20 приёмов бренда HearthPulse (`src/hearthpulse`): кривые, Kicker, Title, Wordmark, PulseLine, PulseCut, Bg, Embers, Char, варианты Panel, Highlight, HoverLayer, LibProp, LibFx, BrandBug.
- `manacost-youtube/motion-showcase` — `yt-motion-showcase` (16:9): 13 приёмов «Компендиума»: кривые ramp, Words, HeaderBand, RankReveal, MainPoints, CardRow, DeckPoster + planCamera, DeckList, VersusBlock, OffDeckCard, HeroPortrait, стык SegFade, Grain.
Новый приём, который пригодится другим роликам, — в бренд рекламы (`src/hearthpulse`) или в стиль YouTube (`src/looks/compendium/parts`; деталь игры — `src/games/hearthstone/scenes/parts`) и строкой в витрину своей студии.

### launch30 — паспорт

- **Стыки сцен (кадры):** хук 0 → логотип 86 → Стандарт 134 → Матчапы 276 → Карты 371 → Арена 465 → Поля сражений 607 → Существо 749 → «И ещё» 844 → финал 986 → конец 1090. Все на сильных долях.
- **Музыка:** `public/audio/music-v3.m4a`, ≈152 BPM, доля 11,842 кадра, финальный удар на кадре 1020 (на него встаёт цена).
- **Живые фоны:** `public/live` и `public/live-h` (Higgsfield Seedance). Стандарт в 16:9 и финал — статичные арты: модель отклонила их (`ip_detected`).
- **Кадры сайта:** `public/ui` (2x). Для пересъёмки нужен вход через Telegram — `scripts/capture-auth.mjs`; вырезка блоков — `scripts/crop-ui.ps1` (не `prep-assets.ps1`).
- **Рендер:** `.\scripts\render.ps1 -Comp HearthPulseAd -Out hearthpulse-9x16` и `-Comp HearthPulseAd16x9 -Out hearthpulse-16x9`.
- **Проверка рывков:** `.\scripts\qa.ps1 out\hearthpulse-9x16.mp4 -Cuts 86,134,276,371,465,607,749,844,986`. Известный мягкий всплеск на кадре 562 (середина прокрутки к легендаркам) — норма.

## Защита готовых роликов

Два механизма — по полю `freeze` студии в `studios.json` (подробно — `video/STUDIO.md`, «Закрепление и эталоны»).

**`check-ads` — закрепление рекламы (`hp-ads`, `hp-features`).** Закреплённый ролик не меняется, даже когда меняется дизайн-система:

1. **Эталонные кадры.** `frozen.json` перечисляет закреплённые композиции (со студией `ads` или `features`), эталон лежит в `<студия>/<папка>/ref`. Команда `node scripts/check-ads.mjs` (~2 мин) рендерит те же кадры и сверяет. Если что-то отличается, она печатает номера кадров и кладёт сравнение «было | стало» в `out/check/<композиция>/diff-*.jpg`.
2. **Снимок в git** (репозиторий в корне проекта). Тег `freeze-2026-09-29` — состояние на момент закрепления (ещё до разделения на студии). Точная старая версия: `git switch --detach freeze-2026-09-29`, отрендерить, затем `git switch main`.

Правила:

- Файлы в папке закреплённого ролика не правим. Нужна новая версия — копируем папку (`launch30-v2`) и регистрируем как новый ролик в `Root.tsx` своей студии.
- Правки в `src/hearthpulse` — только совместимые. Новое поведение вводится новой опцией или новым компонентом, а по умолчанию остаётся старое. После правки — `node scripts/check-ads.mjs`.
- Если проверка нашла отличия: либо это случайность и её надо исправить в `src/hearthpulse`, либо это осознанное улучшение, которое нужно и старым роликам. Во втором случае — только после «да» пользователя: перерендерить ролик, обновить эталон `node scripts/check-ads.mjs --update <папка>` и предложить коммит.

**`golden` — эталоны YouTube (`manacost-youtube`).** Ролики не замораживаются: канал и общие слои (`src/core`, `src/looks`, `src/games`, `src/brands`) живут, эталоны показывают, что изменилось. Кадры сцен — `qa/golden/<id>/`, кадры стыков — `qa/golden-joints/<id>/`; сверка `node scripts/yt-golden.mjs <id>` (и `--dir qa/golden-joints`). Одобренное пользователем изменение → `node scripts/yt-golden.mjs <id> --approve [сцена…]` (стыки — с тем же `--dir`). В `frozen.json` YouTube-ролики не записываются.

Коммит, тег `freeze-<дата>`, push — только по слову пользователя; готовый этап — предложить коммит.

## Новый ролик

1. **Выбери студию** по таблице направлений в корневом `CLAUDE.md`: реклама → `hp-ads`, анонс функции → `hp-features`, YouTube по статье Манакоста → `manacost-youtube`. Другой игры или канала в реестре нет → навык `studio-new-direction`.
2. **Папка ролика** — `<студия>/<ролик>/`: для шаблонной студии достаточно `config.ts` (образцы — `hp-features/feature-matchups/config.ts`, `manacost-youtube/yt-legend-decks-sep26/config.ts`). Регистрация — блок `<Folder name="<ролик>">` в `Root.tsx` студии; у YouTube — строка в `manacost-youtube/videos.ts` (её добавляет `yt-new.mjs`, Root регистрирует список сам).
3. **Новый шаблон** — у студии-канала (YouTube) это `channel.ts` в корне студии: стиль из `src/looks`, сцены и данные игры из `src/games`, бренд из `src/brands` (образец — `manacost-youtube/channel.ts`, паспорт — `manacost-youtube/README.md`); движок и звук — `src/core`, новая сцена — файл сцены и строка в `scenes` канала (`video/STUDIO.md`, «Реестр сцен и тип конфига»). У рекламы — `<студия>/template/` (или `template-<имя>/`, если шаблонов станет несколько): компонент ролика, тип конфига и `<Имя>Compositions` для регистрации (образец — `FeatureCompositions` в `hp-features/template/FeatureSpot.tsx`). Звук и хронометраж шаблон считает сам. Импорт деталей из чужой студии запрещён: общее — в `src/core`, иначе копия в свою студию.
4. **Куда класть сцены, приёмы, словари, пороги** — таблица «Куда класть новое» в `video/STUDIO.md`. Ассеты — сначала из библиотеки (`LIBRARY.md`, область — таверна/Hearthstone).
5. **Сдача** (порядок по навыку направления): рендер `render.ps1 -Studio <ключ>`, проверка, строка в реестре выше. Дальше по полю `freeze` студии: `check-ads` — запись в `frozen.json` (с полем `studio`) и эталон `node scripts/check-ads.mjs --update <папка>` после «да» пользователя; `golden` — `node scripts/release.mjs <id>` без ❌, эталоны `yt-golden.mjs <id> --approve` после «да». Предложить коммит.
