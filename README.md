# Motion Studio · Manacost Labs

Моушн-студия на коде. Рекламу, обзоры функций и YouTube-ролики по играм собирают из сцен, голоса диктора и проверенных данных в Remotion (React). В одном репозитории несколько студий-направлений, у всех общий движок; новое направление запускается заготовкой, не трогая готовые.

## Направления

| Студия (`video/src/studios/`) | Что | Игра | Стиль | Запуск (из `video/`) |
|---|---|---|---|---|
| `hp-ads` | реклама HearthPulse (hearthpulse.net) | Hearthstone | бренд HearthPulse | `npm run studio:ads` |
| `hp-features` | обзоры новых функций HearthPulse | Hearthstone | бренд HearthPulse | `npm run studio:features` |
| `manacost-youtube` | YouTube Манакоста: топы колод, гайды, мета | Hearthstone | «Компендиум» | `npm run studio:youtube` |
| `lol-youtube` | YouTube по League of Legends: патчи, гайды, тир-листы | League of Legends | «Газета» | `npm run studio:lol` |

Реестр студий — `video/src/studios/studios.json` (его читают все скрипты), ролики и их статусы — `video/src/studios/README.md`.

## Как устроено

```
CLAUDE.md               вход для Claude Code: направления, правила, где что
.claude/skills/         навыки: studio (точка входа), по направлению, новое направление
исходники/              оригиналы брифа, артов, персонажей, снимков сайта — не правятся
video/                  проект Remotion; все команды — отсюда
  src/core/             движок роликов с голосом: время, тайминги по голосу, звук, проверки, реестр сцен
  src/looks/            стили: compendium («Компендиум»), gazette («Газета»)
  src/games/            игры: hearthstone, lol — данные, сцены, словари произношения
  src/brands/           бренды каналов: manacost, lol-channel
  src/hearthpulse/      бренд и сцены рекламы HearthPulse
  src/studios/          студии: channel.ts (стиль, бренд, игра, сцены) + videos.ts + папки роликов
  scripts/              конвейер: голос, ассеты, рендер, проверки, заготовка направления
  public/               ассеты — чьи и откуда: video/ASSETS.md
  qa/                   эталонные кадры
  TASTE.md, taste/      вкус: что одобрено и что отвергнуто, по направлениям
```

Импорт идёт только вниз: ролик → канал студии → бренды, игры, стили → движок. Правила слоёв, конвейер ролика и ворота качества — `video/STUDIO.md`.

## Быстрый старт

Нужны Node.js 24, ffmpeg в PATH и PowerShell (рендер с мастерингом). Python 3 нужен только для голосовых таймингов, «ушей», «глаз» и глубины арта.

```bash
cd video
npm install
cp .env.example .env
node scripts/doctor.mjs
npm run studio:youtube
```

Ключи (ElevenLabs и др.) — только в `video/.env`, в git он не попадает. Python-окружение: `python -m venv .venv-vo`, затем `.venv-vo/Scripts/python -m pip install -r requirements.txt`.

Рендер с мастерингом до −14 LUFS, результат в `video/out/`:

```powershell
.\scripts\render.ps1 -Studio lol -Comp lol-patch-26-19-demo -Out "lol-patch-26-19-demo\fragment"
```

## Проверки

| Что | Команда (из `video/`) |
|---|---|
| типы | `npx tsc --noEmit -p .` |
| слои импортов и детерминизм кадра | `node scripts/check-layers.mjs --strict` |
| ссылки в документах | `node scripts/doc-check.mjs --strict` |
| модульные тесты (чистая логика, секунды) | `npm test` |
| закреплённая реклама не изменилась | `node scripts/check-ads.mjs` |
| эталонные кадры ролика | `node scripts/yt-golden.mjs <id>` |
| ролик перед выпуском | `node scripts/yt-qa.mjs <id>` |

Хук перед коммитом запускает нужные из них сам: `git config core.hooksPath video/scripts/hooks`. На каждый push и pull request GitHub Actions (`.github/workflows/ci.yml`) прогоняет типы, слои, ссылки и тесты на чистой машине — без рендера.

## Новое направление

Новая игра, канал или площадка — по навыку `studio-new-direction`: бриф, данные игры, стиль-кадры на выбор, затем заготовка `node scripts/new-direction.mjs` (строка в реестре, студия, канал, проверки). Готовые студии она не трогает.

## Ассеты и права

Репозиторий публичный. В нём есть чужие материалы: арты и карты Hearthstone (© Blizzard Entertainment), ассеты League of Legends (© Riot Games), клипы авторов YouTube по CC BY. Права на них остаются у правообладателей. Что чьё и откуда — `video/ASSETS.md`.

Лицензия на код не выбрана: по умолчанию все права у владельца репозитория.
