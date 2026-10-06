---
name: hearthpulse-video
description: Make motion videos for HearthPulse (hearthpulse.net, Hearthstone stats site sold via Boosty) in the established brand design — new-feature announcements, promo spots, new versions of the 30-second ad, 9:16 and 16:9 versions. Use when the user asks for a video/ролик/рекламу/анонс/моушн about HearthPulse or a site feature, wants a new version of the existing ad, a new HearthPulse template, re-captured site screenshots, the HearthPulse asset library, or live Higgsfield shots. Only HearthPulse ads and feature reviews (studios hp-ads, hp-features): not for Manacost YouTube videos about Hearthstone (use manacost-youtube), not for other games or new channels (use studio-new-direction). Shared tools and rules — skill studio. Reply in Russian.
---

# Ролики HearthPulse в фирменном дизайне

Проект: `video/` (Remotion 4, React), все команды — из `video/`. Сначала прочитай (не больше трёх): этот файл + `examples.md`; `video/BRAND.md` (правила бренда); `video/TASTE.md` и `video/taste/hearthpulse.md` (вкус). Общие инструменты, траты, коммиты — навык `studio` (`.claude/skills/studio/SKILL.md`).

## Карта проекта

| Путь | Что там |
|---|---|
| `video/src/hearthpulse/` | Бренд HearthPulse (общий для `hp-ads` и `hp-features`): `theme.ts` (палитра, шрифты), `components.tsx` (Title, Kicker, Panel, Highlight, Char, Bg, LiveBg, PulseLine, GoldText…), `scenes.tsx` (HookScene, LogoScene, FeatureScene, CarouselScene, EndCardScene, PulseCut), `audio.tsx`, `Spot.tsx` (склейка сцен + звук), `library.tsx` |
| `video/src/studios/hp-ads/` | Реклама: `launch30` (основной, 36 с; стыки и тайминги в `timeline.ts`, `b(n)` — доли), `library-showcase`, витрина `motion-showcase`. Studio — `npm run studio:ads` |
| `video/src/studios/hp-features/` | Обзоры функций: шаблон `template/FeatureSpot.tsx` (+ `FeatureCompositions`), ролики `feature-<тема>/config.ts` (образец — `feature-matchups`). Studio — `npm run studio:features` |
| `video/public/` | `brand/` логотип и шрифт, `ui/` кадры сайта, `art/` арты Blizzard, `chars/` персонажи, `cards/` рендеры карт, `audio/` музыка и эффекты, `live/` и `live-h/` клипы Higgsfield, `plates*/` стартовые кадры, `lib/` библиотека |
| `video/scripts/` (реклама) | `capture.mjs`, `capture-auth.mjs`, `crop-ui.ps1` (кадры сайта), `beats.mjs` (доли трека), `stills.mjs` (кадры), `plates.mjs`, `gen-live.ps1`, `gen-audio.ps1`, `gen-library.mjs` (Higgsfield, тратят кредиты), `render.ps1`, `qa.ps1` (рывки), `check-ads.mjs` (закреплённые). Каталог всех команд с областью — `.claude/skills/studio/reference/tools.md` |

Реестр роликов и закрепление — `video/src/studios/README.md`; YouTube Манакоста — отдельный навык `manacost-youtube`, от бренда HearthPulse не зависит.

## Библиотека ассетов

Перед генерацией нового загляни в `video/LIBRARY.md`: оригинальные фоны (обе ориентации), 5 зацикленных живых фонов, 14 героев, предметы и иконки, световые эффекты, музыка и звуки — в стиле бренда и без IP Blizzard (живые фоны не получат `ip_detected`). В коде: `libArt('tavern')`, `libLoop('tavern')`, `libChar('paladin')`, `<LibProp id="chest-open" …/>`, `<LibFx id="sparkle-burst" at={…}/>`, `libSfx('coin-single')`, `libMusic('announce-20')` из `src/hearthpulse`. Искры и световые эффекты — сначала строка-вопрос в `video/taste/hearthpulse.md`. Витрина — `Library-Showcase`. Расширять — через `scripts/gen-library.mjs` (кредиты — смета и «да»).

## Движение

Готовые приёмы с подписями (имя для кода, длительность, кривая) — витрина `Motion-Showcase` / `Motion-Showcase-16x9` (`src/studios/hp-ads/motion-showcase`). Сначала бери оттуда; новое движение продумывай по скиллу `motion-design`, реализуй только покадрово (`useCurrentFrame` + `interpolate`/`spring`). Новый переиспользуемый приём — в `src/hearthpulse` (новой опцией, старое по умолчанию), строкой в витрину и в `BRAND.md`. Длинный текст в кадре — подгонка кегля по ширине: готовый `useFitSize` из общего движка `src/core/layout/fit.tsx` (меряет после загрузки шрифта; `fontFamily` — шрифт бренда, по умолчанию HSDisplay, его грузит `src/hearthpulse/theme.ts`). Импортировать его можно в шаблон или новый ролик студии (`src/studios/hp-features/template`, `src/studios/hp-ads/<ролик>`), но не в `src/hearthpulse` — бренд рекламы импортирует только пакеты (`check-layers`); там — `fitText` из `@remotion/layout-utils` напрямую. Стиль «Компендиум» и бренд Манакоста рекламе недоступны: у её студий `look` и `brand` — `hearthpulse` (`src/studios/studios.json`); закреплённые папки не трогать. Разбор чужого ролика-референса — `node scripts/eyes.mjs look <url | файл>`.

## Быстрый старт: обзор новой функции (hp-features)

| # | Что сделать | Команда / действие | Что должно получиться |
|---|---|---|---|
| 1 | Кадры сайта | публичная страница: строка в `PAGES` в `scripts/capture.mjs`, затем `node scripts/capture.mjs <имя>`; закрытая: `scripts/capture-auth.mjs`, запуск `node scripts/capture-auth.mjs a-<имя>` **с отключённой изоляцией** (окно Chrome должно быть видно пользователю, он входит через Telegram). Снимать за один вход всё, что может понадобиться (все страницы и оба состояния для наведения); node-процесс не убивать, пока окно нужно | `capture/<имя>.png` + `capture/<имя>.json` (координаты блоков, CSS px) |
| 2 | Вырезать блоки | строка в `scripts/crop-ui.ps1` (страница, x, y, w, h в CSS px, файл), затем `.\scripts\crop-ui.ps1 <файл.png>`. Для прокрутки — полоса 1500–2400 CSS px, начиная с плотного блока | `public/ui/<файл>.png` в 2x; размер PNG (px) = `size` в конфиге |
| 3 | Папка и конфиг | скопировать `src/studios/hp-features/feature-matchups` в `src/studios/hp-features/feature-<тема>`, **удалить скопированную папку `feature-<тема>/ref/`** (эталоны чужого ролика), заполнить `config.ts` по [examples.md](examples.md) | `config.ts` без чужих данных; текст по правилам `BRAND.md` («Текст») |
| 4 | Регистрация | в `src/studios/hp-features/Root.tsx`: `<Folder name="feature-<тема>"><FeatureCompositions id="<Id>" config={…} /></Folder>` | композиции `Feature-<Id>` и `Feature-<Id>-16x9`; `npx tsc --noEmit -p .` — 0 ошибок |
| 5 | Под музыку | `node scripts/beats.mjs public/audio/<трек>` (или `public/lib/music/<трек>.m4a`); стыки — на сильные доли, `delay`/`highlights`/`scroll` — на доли (`Math.round(n * доля)`), прокрутка между блоками — один такт | тайминги в конфиге кратны доле |
| 6 | Кадры | `node scripts/stills.mjs --studio features Feature-<Id> 40 120 200 …` и `… Feature-<Id>-16x9 …` → `out/stills/<композиция>/f*.jpg`; смотреть Read по одному или листом: `ffmpeg -y -i out/stills/<комп>/f040.jpg -i out/stills/<комп>/f120.jpg -i out/stills/<комп>/f200.jpg -filter_complex hstack=inputs=3 out/stills/<комп>/sheet.jpg` | нет наложений, переносов строк, пустых зон, обрезанных краёв персонажей (`feather`); обе ориентации |
| 7 | Живые фоны (по желанию) | кредиты — смета и «да»; стартовые кадры `node scripts/plates.mjs`, оживление `.\scripts\gen-live.ps1`; особенности — `.claude/skills/studio/reference/higgsfield.md` | `public/live/…`, `public/live-h/…` |
| 8 | Фрагмент | `.\scripts\render.ps1 -Studio features -Comp Feature-<Id> -Out <имя>-9x16-draft -Draft` | пользователь сказал «да» |
| 9 | Рендер | `.\scripts\render.ps1 -Studio features -Comp Feature-<Id> -Out <имя>-9x16` и `-Comp Feature-<Id>-16x9 -Out <имя>-16x9` (лог `out/<имя>.render.log`) | `out/<имя>-9x16.mp4`, `out/<имя>-16x9.mp4`, −14 LUFS |
| 10 | Проверка рывков и звука | `.\scripts\qa.ps1 out\<имя>-9x16.mp4 -Cuts <кадры стыков>` (и 16:9); `.venv-vo/Scripts/python.exe scripts/ears.py --video out/<имя>-9x16.mp4` | всплески только на стыках; громких выбросов нет |
| 11 | Сдача и закрепление | строка в реестре `src/studios/README.md`; после «да» пользователя — запись в `src/studios/frozen.json` (`"studio": "features"`) и эталон `node scripts/check-ads.mjs --update feature-<тема>`; предложить коммит | `node scripts/check-ads.mjs` зелёный |

**Кадры стыков FeatureSpot** = накопленные длины сцен: `hook` (`dur`, по умолчанию 90) → `logo` (60) → каждая сцена функции (`dur`) → `carousel` (30 × число разделов) → `end` (110). Для `feature-matchups`: `-Cuts 90,150,300` (всего 410).

## Новая реклама (hp-ads)

1. **Версия существующего ролика** — копия папки (`launch30` → `launch30-v2`), регистрация в `src/studios/hp-ads/Root.tsx` новыми id композиций; закреплённую папку не трогать. Новый ролик с нуля — папка `src/studios/hp-ads/<ролик>/` по образцу `launch30` (`Ad.tsx` + `timeline.ts` + сцены из `src/hearthpulse`).
2. **Монтаж под музыку:** `beats.mjs` → стыки на сильные доли, тайминги в долях `b(n)` (`timeline.ts`). Финальный удар — цена (`EndCardScene priceAt`).
3. **Кадры сайта, живые фоны, рендер, проверка** — шаги 1–2, 6–10 таблицы выше с `-Studio ads`.
4. **Стыки** берутся из `timeline.ts` ролика и записываются в его паспорт в `src/studios/README.md` (как у launch30).
5. **Сдача** — как шаг 11 с `"studio": "ads"`.

## Ошибка → что делать

| Что видно | Причина | Что сделать |
|---|---|---|
| `check-ads.mjs`: кадры закреплённого ролика изменились | правка `src/hearthpulse` поменяла старое поведение | вернуть старое по умолчанию, новое — опцией; эталон обновлять только для осознанного улучшения и после «да» |
| панель налезает на шапку | раскладка `layout` | вертикаль — контент с y ≥ 540, горизонталь — x ≥ ~830 (или ниже строки надзаголовка y ≥ 260) |
| надзаголовок переносится или дёргается | длиннее ~30 знаков (`nowrap`) | сократить до ~30 знаков |
| `qa.ps1`: «<<< проверить» вне стыков | слишком быстрый сдвиг, резкое появление/исчезновение | растянуть время или уменьшить путь, добавить затухание 6–10 кадров |
| подсветка не там | `rect` не в пикселях исходного скриншота | `rect` — `[x, y, w, h]` в пикселях PNG из `public/ui` |
| живой фон: `ip_detected` | фильтр Higgsfield на арт Blizzard | кредиты вернутся; взять арт из `public/lib` или статичный арт |
| `npx remotion …` не находит композицию | без точки входа подставляется `hp-ads` | указать `src/studios/hp-features/index.ts` |

## Готово, когда

Обе ориентации отрендерены и просмотрены; `qa.ps1` — всплески только на стыках; `ears.py --video` без громких выбросов; цифры — только со скриншотов сайта; название, цена и призыв по `BRAND.md`; пользователь посмотрел фрагмент и сказал «да»; после правок `src/hearthpulse` — `node scripts/check-ads.mjs` зелёный; строка в реестре; коммит **предложен** (делать — только по слову пользователя).

## Закреплённые ролики

Всё со статусом «закреплён» в `src/studios/README.md` не правим (`hp-ads/launch30`, `hp-ads/library-showcase`, `hp-features/feature-matchups`); новая версия — копия папки. Правки `src/hearthpulse` — совместимые: новое поведение через опцию, по умолчанию старое; после — `node scripts/check-ads.mjs`. Отличия — чинить или, если улучшение нужно и старым роликам, после «да» пользователя перерендерить и обновить эталон (`--update <папка>`). Защита от поломок: git-хук перед коммитом и хук «Stop» — `video/STUDIO.md`, «Хуки».

## Правила, которые нельзя нарушать

- В роликах о продукте: название только **HearthPulse**, цена **«от 99 ₽/мес»**, призыв ведёт на **boosty.to/kolodahearthstone**.
- Цифры — только со скриншотов сайта. Не обещать побед и роста рейтинга.
- Не рисовать интерфейс нейросетью: видеомодели искажают текст и цифры. ИИ — только для фонов и персонажей.
- Новые визуальные решения — в `src/hearthpulse/`, а не в конкретный ролик, и описывать в `BRAND.md`.
- Проверять обе ориентации перед рендером.
- `scripts/prep-assets.ps1` не запускать (перезапишет `public/ui` закреплённой рекламы); кадры сайта — `crop-ui.ps1`.
