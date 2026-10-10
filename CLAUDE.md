# HearthPulse Ads — моушн-студия

Моушн-студия: реклама HearthPulse (hearthpulse.net), YouTube Манакоста по Hearthstone, дальше — новые направления (League of Legends и др.). Отвечать на русском. Проект Remotion — `video/`, все команды — из `video/`.

**Любой ролик — сначала навык `studio`** (`.claude/skills/studio/SKILL.md`): он определяет направление по таблице и загружает навык направления.

| Направление | Навык | Студия (`video/src/studios/`) | Игра | Вкус |
|---|---|---|---|---|
| Реклама HearthPulse (промо, launch30) | `hearthpulse-video` | `hp-ads` | Hearthstone | `video/taste/hearthpulse.md` |
| Обзоры новых функций HearthPulse | `hearthpulse-video` | `hp-features` | Hearthstone | `video/taste/hearthpulse.md` |
| YouTube Манакоста (топы, гайды, мета) | `manacost-youtube` | `manacost-youtube` | Hearthstone | `video/taste/manacost-hs.md` |
| YouTube League of Legends (обзор патча, гайды, тир-листы) — до шаблона: бриф и стиль-кадры ждут решений пользователя | `lol-youtube` | `lol-youtube` | LoL | `video/taste/lol.md` (стиль-кадры на выбор) |
| Любое новое направление (игра, канал, площадка) | `studio-new-direction` | — | — | — |

## Где что

- Архитектура, конвейер ролика, ворота качества, закрепление и эталоны — `video/STUDIO.md`.
- Код YouTube — по слоям (правила импортов и «куда класть новое» — `video/STUDIO.md`): движок `video/src/core`, стиль `video/src/looks/compendium`, игры `video/src/games/hearthstone` и `video/src/games/lol` (`GAME.md`), бренд канала `video/src/brands/manacost`; студия-канал — `channel.ts` и `videos.ts` в `video/src/studios/manacost-youtube`. Новая сцена — файл сцены и строка в `channel.ts`.
- Реестр студий — `video/src/studios/studios.json` (единственный список, его читают скрипты); реестр роликов и статусов — `video/src/studios/README.md`.
- Вкус пользователя — `video/TASTE.md` (общее для всех) + файл направления в `video/taste/`: читать перед творческими решениями, дописывать после каждого отзыва.
- Бренд HearthPulse — `video/BRAND.md` и код `video/src/hearthpulse/`.
- Чьи ассеты и откуда — `video/ASSETS.md` (репозиторий на GitHub публичный): новая папка или новый источник ассетов — строка туда.

## Нельзя без слова пользователя

- **Коммит:** готовый этап — *предложить* коммит; коммит, тег `freeze-<дата>`, push — только по слову пользователя (как в глобальных правилах).
- **Кредиты** (ElevenLabs, Higgsfield, TypeSafe, OpenRouter) — только после сметы (`node scripts/credits.mjs`; у `judge.mjs` — запуск без `--yes`) и «да». Картинки `scripts/imagegen.mjs` (Codex CLI) — по подписке ChatGPT, без поштучной оплаты.
- **Эталоны** (`yt-golden.mjs --approve`, `check-ads.mjs --update`) — только после «да» на фрагменте.
- **Закреплённые ролики** (`hp-ads/launch30`, `hp-ads/library-showcase`, `hp-features/feature-matchups`) не правим; после правок в `video/src/hearthpulse` — `node scripts/check-ads.mjs`.
- `video/.env` не выводить, ключи не передавать в аргументах и логах.

## Исходники

- `исходники/boosty-motion-brief.md` — исходный бриф рекламы. Где он расходится с `video/BRAND.md` (название, цена), верен `BRAND.md`.
- `исходники/` (арты Hearthstone, персонажи, скриншоты сайта) — оригиналы не правим, рабочие копии — в `video/public/`. Кадры сайта режет `video/scripts/crop-ui.ps1`; `prep-assets.ps1` не запускать — это рецепт первичной сборки, он перезапишет `public/ui` закреплённой рекламы.
