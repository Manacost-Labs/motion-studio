# HearthPulse Ads

Моушн-ролики для HearthPulse (hearthpulse.net). Отвечать на русском.

- Ролики делаются в проекте `video/` (Remotion). Порядок работы — навык `hearthpulse-video` (`.claude/skills/hearthpulse-video/SKILL.md`), правила бренда — `video/BRAND.md`.
- Готовые ролики — `video/src/ads/<ролик>/`, реестр и правила — `video/src/ads/README.md`. Они закреплены: их папки не правим, после правок в `video/src/brand` запускаем `node scripts/check-ads.mjs` (из `video/`). Шаблоны — `video/src/templates/`.
- Проект под git (корень). Готовый этап — коммит; закрепление роликов — тег `freeze-<дата>`.
- `boosty-motion-brief.md` — исходный бриф. Где он расходится с `BRAND.md` (название, цена), верен `BRAND.md`.
- Исходники в корне (`арты харстоун/`, `персонажи/`, скриншоты) не трогать: рабочие копии лежат в `video/public/`.
