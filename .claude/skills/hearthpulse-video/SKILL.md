---
name: hearthpulse-video
description: Make motion videos for HearthPulse (hearthpulse.net, Hearthstone stats site sold via Boosty) in the established brand design — new-feature announcements, promo spots, updates of the 30-second ad, 9:16 and 16:9 versions. Use when the user asks for a video/ролик/рекламу/анонс/моушн about HearthPulse or a site feature, wants to change the existing ad, create a new video template, re-capture site screenshots, use the asset library, or add live Higgsfield shots. Reply in Russian.
---

# Ролики HearthPulse в фирменном дизайне

Проект: `video/` (Remotion 4, React). Правила бренда — `video/BRAND.md`, прочитай его первым. Всё, что ниже, — порядок работы.

## Карта проекта

| Путь | Что там |
|---|---|
| `video/src/brand/` | Дизайн-система: `theme.ts` (палитра, шрифты), `components.tsx` (Title, Kicker, Panel, Highlight, Char, Bg, LiveBg, PulseLine, GoldText…), `scenes.tsx` (HookScene, LogoScene, FeatureScene, CarouselScene, EndCardScene, PulseCut), `audio.tsx`, `Spot.tsx` (склейка сцен + звук) |
| `video/src/templates/` | Шаблоны — движки роликов без содержимого. `feature/FeatureSpot.tsx` — «новая функция» (+ `FeatureCompositions` для регистрации) |
| `video/src/ads/` | **Готовые ролики, по папке на ролик**: `launch30` (основной, 36 с; стыки и тайминги в `timeline.ts`, `b(n)` — доли), `feature-matchups` (анонс по шаблону), `library-showcase` (витрина библиотеки). Реестр, паспорта роликов и правила закрепления — `video/src/ads/README.md`; регистрация композиций — `video/src/ads/index.tsx` |
| `video/src/Root.tsx` | Только подключает `src/ads/index.tsx` |
| `video/public/` | `brand/` логотип и шрифт, `ui/` кадры сайта, `art/` арты Blizzard, `chars/` персонажи, `cards/` рендеры карт, `audio/` музыка и эффекты, `live/` и `live-h/` клипы Higgsfield, `plates*/` стартовые кадры |
| `video/scripts/` | `capture.mjs` (публичные страницы), `capture-auth.mjs` (из-под аккаунта), `crop-ui.ps1 -Only a.png,b.png` (вырезка блоков в `public/ui`), `beats.mjs` (темп и сильные доли трека), `stills.mjs`, `plates.mjs`, `gen-live.ps1`, `gen-audio.ps1`, `gen-library.mjs`, `render.ps1`, `qa.ps1` (поиск рывков), `check-ads.mjs` (сверка закреплённых роликов с эталоном) |

## Библиотека ассетов

Перед генерацией нового загляни в `video/LIBRARY.md`: там готовые оригинальные фоны (обе ориентации), 5 зацикленных живых фонов, 14 героев, предметы и иконки, световые эффекты, 5 музыкальных треков и 19 звуков — всё в стиле бренда и без IP Blizzard (живые фоны не получат `ip_detected`). В коде: `libArt('tavern')`, `libLoop('tavern')`, `libChar('paladin')`, `<LibProp id="chest-open" …/>`, `<LibFx id="sparkle-burst" at={…}/>`, `libSfx('coin-single')`, `libMusic('announce-20')` из `src/brand`. Витрина — композиция `Library-Showcase`. Расширять библиотеку — через `scripts/gen-library.mjs`.

## Ролик про новую функцию

1. **Кадры сайта.** Нужны реальные скриншоты в 2x.
   - Публичная страница: добавь её в `PAGES` в `scripts/capture.mjs` и запусти `node scripts/capture.mjs <имя>`.
   - Закрытая: в `scripts/capture-auth.mjs`, запуск `node scripts/capture-auth.mjs a-<имя>` **с отключённой изоляцией** (иначе окно Chrome не видно пользователю). Пользователь входит через Telegram, скрипт сам снимает, закрывает окно и удаляет профиль. Не убивай node-процесс скрипта, пока окно нужно: вместе с ним закроется Chrome. Каждый вход — лишнее действие для пользователя, поэтому снимай за один вход всё, что может понадобиться (все нужные страницы и оба состояния для наведения).
   - Координаты блоков лежат в `capture/<имя>.json` (CSS px). Добавь строку в `scripts/crop-ui.ps1` (страница, x, y, w, h в CSS px, файл) и запусти `.\scripts\crop-ui.ps1 <файл.png>` — получишь `public/ui/<файл>.png` в 2x. Размер PNG (px) = `size` в конфиге. Для прокрутки режь длинную полосу 1500–2400 CSS px, начиная с плотного блока.
2. **Конфиг.** Скопируй папку `src/ads/feature-matchups` в `src/ads/feature-<тема>`, заполни `config.ts`: хук (вопрос игрока), 1–2 сцены функции (надзаголовок, заголовок до 3 слов, подпись до 6, арт, персонаж, панели с `layout.v` и `layout.h`, подсветки реальных цифр `highlights`, прокрутка `scroll`), финал. Удали скопированную папку `ref`. Зарегистрируй в `src/ads/index.tsx`: `<Folder name="feature-<тема>"><FeatureCompositions id="<Id>" config={…} /></Folder>` → появятся `Feature-<Id>` и `Feature-<Id>-16x9`.
   - Координаты подсветки `rect` — в пикселях исходного скриншота `[x, y, w, h]`.
   - Панели не должны налезать на шапку: в вертикали контент с y ≥ 540, в горизонтали x ≥ ~830.
   - **Под музыку:** прогони трек через `node scripts/beats.mjs public/audio/<трек>`; стыки сцен ставь на сильные доли, `delay`/`highlights`/`scroll` — на доли (`Math.round(n * доля)`). Длину прокрутки между блоками держи в один такт.
   - **Наведение на элемент сайта** (подсказки, всплывающая статистика): у панели `hover: {at, cursor, layers}` — нужны два снимка одного места, без наведения и с наведением.
3. **Проверка кадров:** `node scripts/stills.mjs Feature-<Id> 40 120 200 …` и `… Feature-<Id>-16x9 …`, собери лист через ffmpeg и посмотри глазами: наложения, переносы строк, пустые зоны, обрезанные края персонажей (включай `feather`).
4. **Живые фоны (по желанию, тратят кредиты — спроси пользователя):** стартовые кадры через композиции `plate-*` (`scripts/plates.mjs`), генерация `scripts/gen-live.ps1` (Seedance 2.5, omni_reference, 1080p). Особенности Higgsfield — в памяти `higgsfield-quirks`: лимит 6 задач, отказы `ip_detected` возвращают кредиты, модель может перекомпоновать кадр.
5. **Рендер с мастерингом:** `.\scripts\render.ps1 -Comp Feature-<Id> -Out <имя>-9x16` и `-Comp Feature-<Id>-16x9 -Out <имя>-16x9`. Результат в `video/out/`, звук −14 LUFS.
6. **Проверка рывков перед сдачей:** `.\scripts\qa.ps1 out\<имя>-9x16.mp4 -Cuts <кадры стыков>` (и для 16:9). Всё, что помечено «проверить», вырежи ffmpeg-ом по кадрам и посмотри. Типичные причины: слишком быстрый сдвиг (растяни время, уменьши путь), резкое появление/исчезновение элемента (добавь затухание), перенос текста на анимации разрядки (у надзаголовка стоит `nowrap`, держи его до ~30 символов).
7. **Сдача и закрепление:** строка в реестре `src/ads/README.md`, запись в `src/ads/frozen.json`, эталон `node scripts/check-ads.mjs --update <папка>`, коммит в git (репозиторий в корне проекта).

## Новый шаблон

Движок — в `src/templates/<имя>/` (компонент, тип конфига, `<Имя>Compositions` по образцу `FeatureCompositions`), каждый ролик по нему — отдельная папка в `src/ads/`. Порядок и правила — `src/ads/README.md`, раздел «Новый шаблон и ролик по нему».

## Закреплённые ролики

Всё из реестра `src/ads/README.md` закреплено. Папки этих роликов не правь, новая версия — копия папки. Правки в `src/brand` делай совместимыми: новое поведение через опцию, по умолчанию старое. После любой правки в `src/brand` запускай `node scripts/check-ads.mjs`: он сверяет контрольные кадры с эталоном. Отличия — либо чинить, либо, если улучшение нужно и старым роликам, перерендерить их и обновить эталон (`--update <папка>`), предупредив пользователя.

## Правила, которые нельзя нарушать

- Название только **HearthPulse**, цена **«от 99 ₽/мес»**, призыв ведёт на **boosty.to/kolodahearthstone**.
- Цифры — только со скриншотов сайта. Не обещать побед и роста рейтинга.
- Не рисовать интерфейс нейросетью: видеомодели искажают текст и цифры. ИИ — только для фонов и персонажей.
- Новые визуальные решения добавлять в `src/brand/`, а не в конкретный ролик, и описывать в `BRAND.md`.
- Проверять обе ориентации перед рендером.
