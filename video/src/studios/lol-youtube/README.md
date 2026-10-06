# Студия «YouTube по League of Legends (канал — TODO)»

Заготовка направления — `scripts/new-direction.mjs` (2026-10-04). Порядок работы — чек-лист навыка `studio-new-direction`; когда навык направления заполнен — он (`.claude/skills/lol-youtube/SKILL.md`). Бриф — `BRIEF.md` рядом.

## Паспорт студии

Ключ `lol` в `src/studios/studios.json` (игра `lol`, стиль `gazette`, бренд `lol-channel`, id роликов `lol-…`, эталоны — `golden`), запуск — `npm run studio:lol` (порт 3003). В папке студии только:

| Файл | Что |
|---|---|
| `channel.ts` | канал: стиль, бренд, игра, виды сцен (`defineChannel`), ctx сцен, тип конфига `LolConfig`, пороги `LIMITS`, проверки канала `qa` |
| `videos.ts` | список роликов `VIDEOS` — строка на ролик |
| `Root.tsx`, `index.ts` | регистрация роликов из `videos.ts` (`voicedCompositions`, `src/core/video/compositions.tsx`); обложка — заглушка до стиль-кадров |
| `pronounce.json` | словарь бренда канала (термины игры — `src/games/lol/data/pronounce.json`) |
| `BRIEF.md` | бриф направления: канал, форматы, голос, данные, право, решения пользователя |
| `style-frames/` | стиль-кадры на выбор (не шаблон и не для публикации) |
| `lol-<тема>/` | ролик: `config.ts` (импортирует только `../channel`) |

Остальное — в общих слоях: движок под голос и проверки — `src/core`; стиль — `src/looks/gazette` («Газета»); игра — `src/games/lol` (`GAME.md`); имя, ссылки, финал, голос, музыка и юридический блок `legal` канала — `src/brands/lol-channel/channel.ts`. Правила импортов — `scripts/check-layers.mjs`.

## Статус

Стадия фрагмента (04.10): по стиль-кадру B выбран стиль «Газета»; сцена `patch-champion` и ролик `lol-patch-26-19-demo` (папка `lol-patch-26-19-demo/`, видео `out/lol-patch-26-19-demo/fragment.mp4`) ждут отзыва; остальные сцены — после «да». Стиль-кадры остаются образцом — `style-frames/` (`lol-style-a`, `-b`, `-c`). Бриф и вопросы пользователю — `BRIEF.md`. Вкус направления — `video/taste/lol.md`, навык — `.claude/skills/lol-youtube/SKILL.md`.
