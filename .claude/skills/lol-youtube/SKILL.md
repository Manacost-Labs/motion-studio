---
name: lol-youtube
description: Направление «YouTube по League of Legends» моушн-студии (проект HearthPulse Ads, video/, студия lol-youtube) — обзоры патчей, гайды на чемпионов, тир-листы и топы на русском. Сейчас стадия до шаблона: бриф, данные Data Dragon / CommunityDragon, юридический блок Riot, стиль-кадры на выбор. Использовать, когда просят что-то по LoL: стиль-кадры, данные игры, бриф канала, первый ролик-обзор патча. Не для Hearthstone (YouTube Манакоста — manacost-youtube, реклама HearthPulse — hearthpulse-video) и не для других новых игр (studio-new-direction).
---

# YouTube по League of Legends (канал — TODO)

Все команды — из `video/`. Общие правила, траты, коммиты — навык `studio`; порядок нового направления — чек-лист навыка `studio-new-direction` (здесь пройдены шаги 1–4 до выбора пользователя).

## Сначала прочитай (не больше трёх)

1. `video/src/studios/lol-youtube/BRIEF.md` — что известно и «Вопросы пользователю».
2. `video/TASTE.md` и `video/taste/lol.md` — вкус и стиль-кадры на выбор.
3. `video/src/games/lol/GAME.md` — источники, нумерация патчей, правило цифр, политика Riot.

## ШАБЛОН НЕ СТРОИТЬ ДО ВЫБОРА СТИЛЬ-КАДРА

04.10 пользователь выбрал стиль B «Газета» для фрагмента («это интересный стиль, сделай фрагмент на 20 секунд»): стиль — `src/looks/gazette`, первая сцена — `patch-champion` (`src/games/lol/scenes/patchChampion.tsx`), фрагмент — ролик `lol-patch-26-19-demo` (`out/lol-patch-26-19-demo/fragment.mp4`). Пока нет «да» на фрагмент: остальные сцены (вступление, финал, тир-лист), демо всех сцен и эталоны не делать. После «да»: слова пользователя — в `video/taste/lol.md`, кадр — в `qa/taste/lol/`, дальше шаги 6–9 `studio-new-direction`.

## Что уже есть

| Что | Где |
|---|---|
| Студия (ключ `lol`, порт 3003, id роликов `lol-…`) | `video/src/studios/lol-youtube/` — `channel.ts` (сцен нет), `videos.ts` (пусто), `Root.tsx`, `README.md`, `BRIEF.md`; запуск `npm run studio:lol` |
| Стиль-кадры | `src/studios/lol-youtube/style-frames/` (StyleA/B/C, данные `data.ts`) → композиции `lol-style-a`, `-b`, `-c` |
| Игра: id, имена, словарь | `src/games/lol/data/{ids.ts, champions.ts, pronounce.json}` (ids и champions СГЕНЕРИРОВАНЫ) |
| Загрузчики | `scripts/games/lol/lol-data.mjs` (Data Dragon + осколки рун из CommunityDragon, `--check`), `lol-assets.mjs` (картинки по запросу), `lol-lib.mjs` (`ddToPublic`, `publicToDd`) |
| Бренд канала | `src/brands/lol-channel/channel.ts` — имя, ссылки, финал TODO; `legal` заполнен, кроме дословной оговорки |
| Стиль | `src/looks/gazette/` — «Газета»: theme.ts (краски, шрифты), parts.tsx (шапка, линейки, штамп, фото, строка «было → стало»), look.tsx (бумага, смена полос, субтитры) |

## Ждёт решений пользователя

Список вопросов — `BRIEF.md`, «Вопросы пользователю» (задавать одним списком): название канала, аудитория, голос (сейчас временно Alex Bell), стиль-кадр, длина и ориентация, музыка (Creator-Safe Playlist), ссылки в финале, статистика для тир-листов (OP.GG письменно), донаты.

## Быстрые команды

| # | Что | Команда | Что должно получиться |
|---|---|---|---|
| 1 | Данные Data Dragon | `node scripts/games/lol/lol-data.mjs` (без сети: `--check`) | 173 чемпиона, 251 предмет Ущелья, 62 руны, 10 осколков; `ids.ts` записан или «без изменений» |
| 2 | Картинки | `node scripts/games/lol/lol-assets.mjs Ноктюрн Атрокс --only splash,icon,abilities`; `--items`, `--runes`, `--spells`, `--shards` | файлы в `public/lol/…`, готовые не перезаписываются |
| 3 | Стиль-кадр | `npx remotion still src/studios/lol-youtube/index.ts lol-style-a out/lol-style/a.png` | PNG 1920×1080 |
| 4 | Проверки | `npx tsc --noEmit -p .` · `node scripts/check-layers.mjs --strict` · `node scripts/doc-check.mjs` · `npx remotion compositions src/studios/lol-youtube/index.ts` | 0 ошибок; в списке `lol-showcase`, `lol-style-a/b/c` |

## Данные игры

- В ролике только публичный номер патча: Data Dragon `16.19.1` = «патч 26.19» (`ddToPublic`). «Патч 16.x» — ошибка.
- Цифры — только с источником (Data Dragon конкретной версии, патчноут, одобренная статистика с подписью). Прирост силы атаки из DD (0 с 16.5) и числа из описаний DD (`{{ }}`) не брать.
- В конфиге — только id (`ChampionId`, `ItemId`, `RuneId`, `ShardId`), на экране и в голосе — имена ru_RU из `champions.ts`.
- Сплэш DD 1215×717: не шире ~910 px в кадре 1080 (≤ 1,5× в 4K), целиком, без наездов, режущих лица. Иконки умений и предметов — не крупнее 64 px.

## Право (Riot «Legal Jibber Jabber»)

- `legal` бренда: `policyUrl` — https://www.riotgames.com/en/legal; `forbidden` — «League of Legends», «LoL», «Riot» (yt-qa ❌ только в названии канала: имя и сайт, ссылки и подписи финала, подвал описания); `forbiddenInVideo` — «официальный/-ая/-ое», «official», «Riot Games представляет» и т. п. (yt-qa ❌ в названии, вариантах названия, тегах, хэштегах ролика); `forbiddenInTags` — «League of Legends», «LoL», «Riot», «Riot Games» (yt-qa ❌ в тегах и хэштегах — так в тексте политики); `required: true`.
- Назвать игру и чемпионов в названии ролика, чтобы описать его («Гайд на Ари | League of Legends»), — описательное упоминание (окончательно решает пользователь перед запуском, вопрос в BRIEF.md). Выдавать ролик или канал за официальный — нельзя. Теги: текст политики запрещает товарные знаки и IP Riot как поисковые теги — `forbiddenInTags` («League of Legends», «LoL», «Riot», «Riot Games») → yt-qa ❌; имена чемпионов в тегах — вопрос пользователю, пока проверка глазами (`src/games/lol/GAME.md`, «Нельзя»).
- `legal.disclaimer` — TODO: официальный текст оговорки со страницы политики дословно, с названием канала. Не сочинять. Пока в нём TODO, он считается незаданным: yt-export не дописывает, release (пункт 22) — ❌.
- Нельзя: логотипы Riot, товарные знаки Riot и имена чемпионов в названии канала, платный доступ (Boosty), музыка вне Creator-Safe Playlist, перезалив киберспорта.

## Готово (для текущей стадии), когда

Пользователь выбрал стиль-кадр и ответил на вопросы брифа; ответы — в таблице `BRIEF.md` и в `video/taste/lol.md`. Коммит — предложить, делать только по слову пользователя.

## Грабли

- Это не Hearthstone: пергамент, сукно, сургуч, `ManaGem`, «Компендиум» сюда не переносить; тёмный HUD Rift Codex как есть — тоже нет.
- Rift Codex (`C:/Users/zulut/Documents/lol-website`) не импортировать по пути — только копировать логику с пометкой источника; своего API у него нет.
- CommunityDragon — путь с патчем (`/16.19/`), не `/latest/`; Universe, видео умений, реплики — ещё не в загрузчиках.
- Проверка латиницы пропускает римские цифры (Джарван IV) и слова из ключей pronounce; английские имена в тексте диктора — ошибка.
- Общие грабли — `.claude/skills/studio/reference/pitfalls.md`.
