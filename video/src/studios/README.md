# Студии роликов

Проект разделён на три студии. У каждой своя точка входа Remotion (`index.ts` + `Root.tsx`), своя Remotion Studio и свои шаблоны. Ролик — папка внутри своей студии: там его содержимое (тексты, кадры сайта, тайминги, музыка).

| Студия | Папка | Что делает | Стиль | Запуск Studio | Рендер |
|---|---|---|---|---|---|
| Реклама HearthPulse | `hp-ads/` | промо-ролики сайта hearthpulse.net | бренд HearthPulse — `src/hearthpulse` (`BRAND.md`) | `npm run studio:ads` (порт 3000) | `render.ps1` (по умолчанию `-Studio ads`) |
| Обзоры новых функций HearthPulse | `hp-features/` | короткие анонсы разделов сайта по шаблону `hp-features/template` | бренд HearthPulse — `src/hearthpulse` | `npm run studio:features` (порт 3001) | `render.ps1 -Studio features` |
| YouTube Манакоста | `manacost-youtube/` | ролики по статьям hs-manacost.ru под озвучку | свой: `manacost-youtube/brand` + «Компендиум» в `manacost-youtube/template` (README там же) | `npm run studio:youtube` (порт 3002) | `render.ps1 -Studio youtube` |

Зависимости идут только вниз. Обе студии HearthPulse берут детали из `src/hearthpulse`. YouTube-студия от бренда HearthPulse не зависит: её шрифты, цвета и движение заведены отдельно, поэтому их можно менять, не задевая рекламу. Ассеты (`public/`) общие для всех студий. Скрипты выбирают студию через `scripts/studios.mjs`.

## Реестр

| Студия | Папка | Что это | Композиции | Длина | Из чего собран | Готовые файлы | Статус |
|---|---|---|---|---|---|---|---|
| `hp-ads` | `launch30` | Основной рекламный ролик: хук, логотип, Стандарт, Матчапы, Карты (наведение), Арена, Поля сражений, Существо (графики Баюбота), «И ещё», финал с ценой | `HearthPulseAd`, `HearthPulseAd16x9` | 1090 кадров, 36,3 с | свой монтаж из сцен `src/hearthpulse` | `out/hearthpulse-9x16.mp4`, `out/hearthpulse-16x9.mp4` | закреплён 29.09.2026 |
| `hp-ads` | `library-showcase` | Витрина библиотеки ассетов `public/lib`, без звука | `Library-Showcase`, `Library-Showcase-16x9` | 1287 кадров, 42,9 с | компоненты `src/hearthpulse/library.tsx` | `out/library-showcase-9x16.mp4`, `out/library-showcase-16x9.mp4` | закреплён 29.09.2026 |
| `hp-features` | `feature-matchups` | Анонс раздела «Матчапы» | `Feature-Matchups`, `Feature-Matchups-16x9` | 410 кадров, 13,7 с | шаблон `hp-features/template` | `out/feature-matchups-9x16.mp4`, `out/feature-matchups-16x9.mp4` | закреплён 29.09.2026 |
| `manacost-youtube` | `yt-legend-decks-sep26` | «15 колод для Легенды в сентябре» по статье hs-manacost.ru, озвучка ElevenLabs v4 (Alex Bell) | `yt-legend-decks-sep26`, обложка `yt-legend-decks-sep26-thumb` | 8:19 | шаблон `manacost-youtube/template` | `out/yt-legend-decks-sep26/` (video.mp4 в 4K, thumbnail.png, description.txt, subtitles.srt, script.md) | черновик с голосом, ждёт одобрения |

`out/hearthpulse-animatic.mp4` и `out/hearthpulse-v2-wip.mp4` — черновики первых версий, не для публикации.

`yt-template-demo` (конфиг в `manacost-youtube/template/demo.ts`) — демонстрация всех сцен YouTube-шаблона на примере гайда, не для публикации.

**Витрины анимаций** (не для публикации, не закреплены): каждый приём движения отдельно, с подписью «имя для кода · длительность · кривая». Перед тем как придумывать новое движение — смотри здесь, что уже есть.
- `hp-ads/motion-showcase` — `Motion-Showcase`, `Motion-Showcase-16x9`: 20 приёмов бренда HearthPulse (`src/hearthpulse`): кривые, Kicker, Title, Wordmark, PulseLine, PulseCut, Bg, Embers, Char, варианты Panel, Highlight, HoverLayer, LibProp, LibFx, BrandBug.
- `manacost-youtube/motion-showcase` — `yt-motion-showcase` (16:9): 13 приёмов «Компендиума»: кривые ramp, Words, HeaderBand, RankReveal, MainPoints, CardRow, DeckPoster + planCamera, DeckList, VersusBlock, OffDeckCard, HeroPortrait, стык SegFade, Grain.
Новый приём, который пригодится другим роликам, — в бренд студии и строкой в её витрину.

### launch30 — паспорт

- **Стыки сцен (кадры):** хук 0 → логотип 86 → Стандарт 134 → Матчапы 276 → Карты 371 → Арена 465 → Поля сражений 607 → Существо 749 → «И ещё» 844 → финал 986 → конец 1090. Все на сильных долях.
- **Музыка:** `public/audio/music-v3.m4a`, ≈152 BPM, доля 11,842 кадра, финальный удар на кадре 1020 (на него встаёт цена).
- **Живые фоны:** `public/live` и `public/live-h` (Higgsfield Seedance). Стандарт в 16:9 и финал — статичные арты: модель отклонила их (`ip_detected`).
- **Кадры сайта:** `public/ui` (2x). Для пересъёмки нужен вход через Telegram — `scripts/capture-auth.mjs`.
- **Рендер:** `.\scripts\render.ps1 -Comp HearthPulseAd -Out hearthpulse-9x16` и `-Comp HearthPulseAd16x9 -Out hearthpulse-16x9`.
- **Проверка рывков:** `.\scripts\qa.ps1 out\hearthpulse-9x16.mp4 -Cuts 86,134,276,371,465,607,749,844,986`. Известный мягкий всплеск на кадре 562 (середина прокрутки к легендаркам) — норма.

## Закрепление

Закреплённый ролик не меняется, даже когда меняется дизайн-система. Держится это на двух вещах.

1. **Эталонные кадры.** `frozen.json` перечисляет закреплённые композиции (со студией), эталон лежит в `<студия>/<папка>/ref`. Команда `node scripts/check-ads.mjs` (~2 мин) рендерит те же кадры и сверяет. Если что-то отличается, она печатает номера кадров и кладёт сравнение «было | стало» в `out/check/<композиция>/diff-*.jpg`.
2. **Снимок в git** (репозиторий в корне проекта). Тег `freeze-2026-09-29` — состояние на момент закрепления (ещё до разделения на студии). Точная старая версия: `git switch --detach freeze-2026-09-29`, отрендерить, затем `git switch main`.

Правила:

- Файлы в папке закреплённого ролика не правим. Нужна новая версия — копируем папку (`launch30-v2`) и регистрируем как новый ролик в `Root.tsx` своей студии.
- Правки в `src/hearthpulse` — только совместимые. Новое поведение вводится новой опцией или новым компонентом, а по умолчанию остаётся старое. После правки — `node scripts/check-ads.mjs`.
- Если проверка нашла отличия: либо это случайность и её надо исправить в `src/hearthpulse`, либо это осознанное улучшение, которое нужно и старым роликам. Во втором случае перерендерить ролик, обновить эталон `node scripts/check-ads.mjs --update <папка>` и сделать коммит.

## Новый ролик

1. **Выбери студию** по задаче: реклама → `hp-ads`, анонс функции → `hp-features`, YouTube по статье → `manacost-youtube`.
2. **Папка ролика** — `<студия>/<ролик>/`: для шаблонной студии достаточно `config.ts` (образцы — `feature-matchups/config.ts`, `yt-legend-decks-sep26/config.ts`). Регистрация — блок `<Folder name="<ролик>">` в `Root.tsx` студии.
3. **Новый шаблон** — `<студия>/template/` (или `template-<имя>/`, если шаблонов станет несколько): компонент ролика, тип конфига и `<Имя>Compositions` для регистрации (образец — `FeatureCompositions` в `hp-features/template/FeatureSpot.tsx`). Звук и хронометраж шаблон считает сам.
4. Сцены и приёмы HearthPulse, которые пригодятся другим роликам, — в `src/hearthpulse` с описанием в `BRAND.md`. У Манакоста — в `manacost-youtube/brand` или `manacost-youtube/template`. Ассеты — сначала из библиотеки (`LIBRARY.md`).
5. **Сдача:** рендер через `render.ps1 -Studio <студия>`, проверка `qa.ps1`, строка в реестре выше, запись в `frozen.json` (с полем `studio`: `ads`, `features` или `youtube`), эталон `node scripts/check-ads.mjs --update <папка>`, коммит.
