# Ассеты: чьи и откуда

Репозиторий публичный (github.com/Manacost-Labs/motion-studio). Здесь записано, кому принадлежит каждая папка ассетов и откуда она взялась. Свои материалы и сгенерированное по нашим запросам используются в роликах студии. Чужие (Blizzard, Riot, авторы клипов) используются для обзоров и рекламы вокруг игр: права остаются у правообладателей, этот репозиторий их никому не передаёт и не лицензирует.

Сверено по манифестам, паспортам клипов и скриптам загрузки 06.10.2026. «Уточнить» — происхождение или условия не записаны, нужен ответ владельца (список внизу).

## Три группы

| Группа | Что | Права |
|---|---|---|
| Своё | код, логотипы HearthPulse и Манакоста, графика HS-Arena, снимки сайта hearthpulse.net, свои записи игр | у владельцев брендов |
| Сгенерировано по нашим промптам | библиотека `public/lib/`, живые фоны, музыка и звуки рекламы, голос диктора | по условиям тарифа сервиса на дату генерации (Higgsfield, ElevenLabs) |
| Чужое | арты и карты Hearthstone, ассеты League of Legends, клипы с YouTube, постеры колод | у правообладателей: Blizzard Entertainment, Riot Games, авторы клипов, blizzcore |

## По папкам (`video/`)

| Папка | Что | Источник | Чьё |
|---|---|---|---|
| `public/hs/` (art, render, tiles) | арты, рендеры и полоски карт Hearthstone для YouTube | HearthstoneJSON (art.hearthstonejson.com), `scripts/hs-assets.mjs` | © Blizzard Entertainment |
| `public/cards/` | рендеры карт для рекламы | HearthstoneJSON | © Blizzard Entertainment |
| `public/art/` | арты дополнений Hearthstone — фоны рекламы, тонированы | копии из `исходники/`, папка «арты харстоун» | © Blizzard Entertainment |
| `public/depth/` | карты глубины к артам `public/art/` («живой арт») | посчитаны `scripts/depth.py` (Depth Anything V2 Small, Apache 2.0) | производное от артов Blizzard |
| `public/decks/` | постеры колод для YouTube | api.blizzcore.ru, `scripts/deck-posters.mjs` | сервис blizzcore; на постерах — карты © Blizzard; условия сервиса — уточнить |
| `public/lol/` | сплэши, иконки умений, предметов, рун | Data Dragon и CommunityDragon, `scripts/games/lol/lol-assets.mjs` | © Riot Games; по политике Riot «Legal Jibber Jabber» (https://www.riotgames.com/en/legal), оговорка в описании ролика — TODO в `src/brands/lol-channel/channel.ts` |
| `public/clips/` | врезки геймплея | YouTube, у каждого клипа паспорт `<клип>.json`: ссылка, автор, лицензия, подпись `credit` | авторы клипов; сейчас оба клипа — CC BY, подпись `credit` обязательна в описании ролика |
| `public/lib/bg/`, `chars/`, `props/`, `fx/` | фоны, герои, предметы, световые эффекты | Higgsfield, GPT Image 2.5, 29.09.2026; промпты — `public/lib/manifest.json` | сгенерировано по нашим промптам |
| `public/lib/loops/` | живые зацикленные фоны | Higgsfield, Seedance 2.5 | сгенерировано |
| `public/lib/music/` | музыка; `*-bed` — те же треки, выровненные под голос | Higgsfield, Sonilo | сгенерировано |
| `public/lib/sfx/` | звуки | Higgsfield, Seed Audio; `cam-swish`, `quill-scratch`, `coin-trickle`, `seal-stamp` собраны `scripts/foley.mjs` из библиотеки и синтеза | сгенерировано |
| `public/lib/amb/` | фон таверны (гул зала, камин) | ElevenLabs, text-to-sound v2, 03.10.2026 | сгенерировано |
| `public/audio/` | музыка и звуки рекламы | Higgsfield, `scripts/gen-audio.ps1` | сгенерировано |
| `public/plates/`, `public/plates-h/` | стартовые кадры живых фонов: арт + персонаж | собраны кодом, `scripts/plates.mjs` | производное от артов Blizzard и персонажей |
| `public/live/`, `public/live-h/` | живые фоны рекламы | Higgsfield, Seedance 2.5 по стартовым кадрам, `scripts/gen-live.ps1` | сгенерировано из производного от артов Blizzard |
| `public/chars/` | персонажи классов для рекламы | копии из `исходники/персонажи/`: часть файлов по именам — из ChatGPT и Grok, `Elise_the_Navigator.png` и `Theotar,_the_Mad_Duke_full-Photoroom.png` — по именам персонажи Hearthstone с убранным фоном (вероятно, арт © Blizzard) | происхождение — уточнить |
| `public/vo/` | голос диктора | ElevenLabs, eleven_v4, голос Alex Bell из библиотеки голосов (`scripts/tts.mjs`) | сгенерировано |
| `public/ui/` | блоки сайта hearthpulse.net в 2x, часть снята из-под аккаунта | `scripts/capture.mjs`, `scripts/capture-auth.mjs`, `scripts/crop-ui.ps1` | HearthPulse; на снимках — карты © Blizzard |
| `public/brand/` | логотипы HearthPulse (`hearthpulse-logo-hd.png`) и Манакоста (`public/brand/manacost/logo.png`) | бренды | HearthPulse, Манакост |
| `public/brand/arena/` | графика дизайн-системы HS-Arena (пергамент, рамки, шапки) для «Компендиума» | arena.hs-manacost.ru | Манакост; иконки классов `public/brand/arena/class_icon/` — символы классов Hearthstone, происхождение — уточнить |
| `public/brand/HSDisplay.otf` | шрифт сайта HearthPulse | сайт hearthpulse.net | лицензия шрифта — уточнить |
| `qa/`, `library-preview/` | эталонные кадры и листы превью | рендеры студии | содержат всё перечисленное выше |
| `capture/` | только координаты блоков сайта (`*.json`); сами снимки в git не входят | `scripts/capture.mjs` | HearthPulse |

Корень репозитория, `исходники/`: «арты харстоун» — арты Hearthstone (© Blizzard Entertainment), `исходники/персонажи/` — как `public/chars/`, «скриншоты сайта» — сайт hearthpulse.net, `исходники/boosty-motion-brief.md` — бриф рекламы.

Не в git: свои записи игр (`recordings/`, OBS) и рендеры (`out/`).

## Шрифты, данные, программы

- **Шрифты Google Fonts** подключаются пакетом `@remotion/google-fonts` при рендере и в репозитории не лежат: Alegreya, Alegreya SC, Caveat, Cormorant Garamond, IBM Plex Sans и Mono, Inter, Oswald, PT Serif, Playfair Display — SIL Open Font License.
- **Данные игр:** база карт HearthstoneJSON (ruRU) — содержание © Blizzard Entertainment; имена и id League of Legends (`src/games/lol/data/champions.ts`, `ids.ts`) — из Data Dragon, © Riot Games; мета-статистика — свой API Колоды (ключ только в `.env`).
- **Remotion** — своя лицензия: бесплатно для частных лиц и компаний до трёх сотрудников, компании больше — нужна Company License (https://remotion.dev/license).
- **Python-пакеты** — `requirements.txt`, открытые лицензии. Модель глубины — только Depth Anything V2 Small (Apache 2.0): веса Base и Large — некоммерческие.

## Лицензия репозитория

Не выбрана: по умолчанию все права на код и свои материалы у владельца репозитория. Чужие ассеты из таблиц выше этим репозиторием не лицензируются.

## Как дополнять

- Новая папка ассетов или новый источник — строка в таблицу «По папкам».
- Новый клип — паспорт `<клип>.json` рядом с ним (`scripts/eyes.mjs` и `scripts/rec.mjs` пишут его сами); у своей записи OBS (`scripts/rec.mjs`) автор в паспорте — «Манакост».
- Новая генерация библиотеки — промпт и модель в `public/lib/manifest.json` (`scripts/gen-library.mjs` дописывает сам).

## Уточнить у владельца

1. Лицензия шрифта `public/brand/HSDisplay.otf`.
2. Происхождение персонажей `исходники/персонажи/` без «ChatGPT» и «grok» в имени (`mage.png`, `priest.png`, `rogue.png`, `warrior.png`, `warlock.png` и др.) и чей арт у Элизы и Теотара.
3. Откуда иконки классов `public/brand/arena/class_icon/`.
4. Условия api.blizzcore.ru для постеров колод.
5. Сколько сотрудников у фирмы: от четырёх — нужна Company License Remotion.
