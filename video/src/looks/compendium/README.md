# Стиль «Компендиум» (16:9, под озвучку)

Оформление роликов в дизайн-системе HS-Arena (arena.hs-manacost.ru, файлы design.md и assets.md в репозитории Manacost-Labs/HeartPulse): пергамент, красное тавернное сукно, дерево, золото только в мелочах. Ассеты лежат в `public/brand/arena`. Сейчас в этом стиле работает канал Манакоста (`src/studios/manacost-youtube/channel.ts`); справочник сцен и полей ролика — `src/studios/manacost-youtube/README.md`.

Стиль не знает ни игры, ни канала: импортирует только `src/core` (правило слоёв — `scripts/check-layers.mjs`). Бренд, гербы и строки итоговой таблицы приходят от канала через `ctx` (`types.ts` → `CompendiumCtx`), сцены игры (колода, карты, муллиган, матч-апы, начало, обложка) лежат в наборе игры — у Hearthstone `src/games/hearthstone/scenes`.

## Что где

| Файл | Что |
|---|---|
| `theme.ts` | токены `H` (цвета HS-Arena), `A()` (путь к ассету `brand/arena`), фоны `parchmentBg`, `redBg`, рамы `timber()`, `goldFrame()`; шрифты `DISPLAY` (HSDisplay/Belwe, грузится здесь) и `TEXT` (Inter); кривые `EASE_*` и `ramp` из `core/time/ease.ts` |
| `motion.tsx` | перелистывание страницы на стыке: `OVL` (кадров перекрытия), `SceneMotion`, `useSceneMotion`, `SceneBody` (тело сцены — «страница»), `PageLayer` (перелистывание внутри сцены) |
| `look.tsx` | `compendium` — стиль для движка `core/video/VoicedVideo.tsx`: фон, переход, субтитры, виньетка и зерно, шелест страницы на стыке |
| `types.ts` | сегменты сцен стиля (`Base`, `IntroSeg`, `PointsSeg<Side>`, `ImageSeg`, `OutroSeg`, `DividerSeg`) и контекст канала: `CompendiumBrand` (name, site, logo, defaultMural, sealRing, leaderLabel), `RankCtx`, `CompendiumCtx` |
| `parts/` | `Page`, `WoodRule`, `HeaderBand` (шапка из сукна, место прокручивается), `MainPoints` (раздел «Главное»), `Mural` (персонаж), `Words` (слова из-под маски), `Subtitles`, `InkCircle` (пометка пером), `WaxSeal` (сургучная печать, надпись по кругу — `ring`), `RankReveal` (заставка места, пометка №1 — `leaderLabel`), `RecapBoard` (итоговая таблица из строк `RecapRow`), `Vignette` |
| `scenes/` | `intro`, `outro` (+ `recapTurn`), `points` (+ `pointsScene(Aside)` — сторона игры справа), `image`, `divider` (+ `DIVIDER`); у каждой — компонент и `defineScene` |
| `showcase/` | витрина приёмов стиля (ссылка: сама витрина собрана на данных Hearthstone и лежит в студии) |

Канал со стилем: `look: compendium`, в `scenes` — сцены стиля и сцены игры, а `context` собирает `CompendiumCtx` (у Манакоста: места из `games/hearthstone/data/ranks.ts`, бренд `brands/manacost/channel.ts`, гербы `crestFor` и строки таблицы `recapRow` из `games/hearthstone/scenes/parts`). Новая сцена без игры — файл в `scenes/` (компонент + `defineScene`) и строка в `scenes` канала; приём движения — деталь в `parts/` и строка в витрине.

## Дизайн

- **Материалы:** пергамент (`arena-parchment.jpg`) — фон всех сцен, красное сукно (`arena-rail-red.jpg`) — шапка 150 px и плашка субтитров, дерево (`main-page-rail-border.png`) — рамы и планки, золотая рама (`deck-border.png`) — места под конечную заставку. Гербы классов Hearthstone — `class_icon/*.png` (рисует игра: `games/hearthstone/scenes/parts/crest.ts`).
- **Шрифты:** заголовки — HSDisplay (Belwe), текст — Inter, как на сайте. Номера тезисов и место — Belwe красными/золотыми чернилами.
- **Тезисы:** все проявляются в начале сцены приглушёнными, тот, о котором говорит диктор, — в полную силу; подсветка не чаще раза в 3 с.
- **Топ-3:** заставка места (`RankReveal`) — сукно во весь кадр с золотой цифрой (у №1 — пометка лидера канала, у Манакоста «Лидер меты») и ударом барабана, уходит вверх и становится шапкой; затем на нижний правый угол постера опускается сургучная печать с номером (`parts/seal.tsx`, стук `seal-stamp`, надпись по кругу — `sealRing` канала), у №1 — золотая с пометкой лидера. Перед названием колоды в `vo` — `[pause]`.
- **Пометка пером** (`parts/ink.tsx`): наклонённый неровный овал с нажимом, ложится «умножением», держится, пока камера на карте, и гаснет, когда камера уходит.
- **Склейки:** перелистывание страницы (`motion.tsx`), шапка стоит, номер места прокручивается; звук `page-turn`. Поверх — лёгкое зерно и тёплая виньетка.
- **Шумовая отделка** (тише голоса на 14–17 LUFS, слышна в паузах): наезд камеры на названную карту — `cam-swish` (отъезды и обход без звука), подъём карты — `card-draw`, черта под тезисом — `quill-scratch`, счётчик пыли — `coin-trickle`, врезка — `scroll-unroll`, заставка топ-3 — `drum-hit`. Звуки отделки собирает `node scripts/foley.mjs` из библиотеки и синтеза (без генерации); громкость подобрана по замеру (`ebur128`, макс. M) относительно `page-turn` на 0,24.
- **Без «нейросетевого почерка»:** никаких свечений, искр, неона, покачиваний и тряски; тексты — из-под маски, движения — мягкие кривые (отвергнуто пользователем — `video/taste/manacost-hs.md`).
- **Время:** все длительности — в «кадрах-30» (`core/time/fps.ts`): детали берут время через `useFrame()`, `Sequence` и звук умножаются на `useK()`, иначе при 60 к/с они пойдут вдвое быстрее. Всё, что медленно движется, двигать только `transform`/`translate`/`scale` (раскладка через `left/width` дрожит на субпикселях).

Детали сцен Hearthstone (постер колоды с камерой, резкость постера, раскладка карт, матч-апы, раскладка сцены колоды) — `src/games/hearthstone/GAME.md`, раздел «Сцены».
