# HearthPulse Ads

Моушн-ролики для HearthPulse (hearthpulse.net). Отвечать на русском.

- Ролики делаются в проекте `video/` (Remotion). Порядок работы — навык `hearthpulse-video` (`.claude/skills/hearthpulse-video/SKILL.md`), правила бренда — `video/BRAND.md`, вкус пользователя (что одобрено и отвергнуто, с примерами) — `video/TASTE.md`: читать перед творческими решениями. YouTube-ролики Манакоста по Hearthstone (топы, гайды) — навык `manacost-youtube` (`.claude/skills/manacost-youtube/SKILL.md`).
- Три студии — `video/src/studios/`: `hp-ads` (реклама HearthPulse), `hp-features` (обзоры новых функций), `manacost-youtube` (YouTube для hs-manacost.ru, свой стиль). У каждой свой `Root.tsx`, шаблоны и папки роликов; запуск — `npm run studio:ads|studio:features|studio:youtube`. Реестр и правила — `video/src/studios/README.md`.
- Бренд HearthPulse (общий для `hp-ads` и `hp-features`) — `video/src/hearthpulse/`. Готовые ролики закреплены: их папки не правим, после правок в `video/src/hearthpulse` запускаем `node scripts/check-ads.mjs` (из `video/`).
- Проект под git (корень). Готовый этап — коммит; закрепление роликов — тег `freeze-<дата>`.
- `исходники/boosty-motion-brief.md` — исходный бриф. Где он расходится с `BRAND.md` (название, цена), верен `BRAND.md`.
- Исходники — `исходники/` (`арты харстоун/`, `персонажи/`, `скриншоты сайта/`): оригиналы не правим, рабочие копии лежат в `video/public/` (готовит `video/scripts/prep-assets.ps1`).
