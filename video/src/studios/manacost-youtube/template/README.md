# Перенесено: шаблон YouTube-роликов разобран по слоям (этап B, шаги 5–7)

Этой папки больше нет как шаблона — здесь только карта для старых ссылок. Паспорт студии и справочник сцен и полей — `../README.md`. Правила слоёв — `scripts/check-layers.mjs`.

| Было (src/studios/manacost-youtube/…) | Стало (от src/) |
|---|---|
| template/README.md | `studios/manacost-youtube/README.md` (паспорт студии, сцены, поля, озвучка) |
| template/YtVideo.tsx (calcYt, YtVideo, YtThumb, YtCompositions) | `core/voice/calc.ts` (`calcVoiced`), `core/video/VoicedVideo.tsx`, `core/video/compositions.tsx` (`voicedCompositions`), обложка — `games/hearthstone/scenes/thumb.tsx`; регистрация — `studios/manacost-youtube/Root.tsx` + `videos.ts` |
| template/types.ts (YtConfig, YtFields, YtSeo, YtSegment, YtThumbSpec, YtTiming) | `studios/manacost-youtube/channel.ts`; сегменты — `looks/compendium/types.ts` и `games/hearthstone/scenes/types.ts`; данные HS — `games/hearthstone/data/types.ts`; общие — `core/video/types.ts` |
| template/article.ts (articleDeck, divider, manacostOutro, YT_BASE, DeckText) | `studios/manacost-youtube/channel.ts` поверх `games/hearthstone/data/article.ts` и `brands/manacost/channel.ts` |
| template/qa.ts | `core/qa/audit.ts` (`qaOf(channel)`), проверки канала по Hearthstone — `games/hearthstone/data/audit.ts` (`hsQa`, `deckPace`), сцены — `SceneDef.audit`, `jumps`, `pace`, `silent`; в Node собирает `scripts/lib/channel.mjs` |
| template/limits.ts (LIMITS, JUDGE) | `LIMITS` — `studios/manacost-youtube/channel.ts` (из `core/qa/limits.ts` и `games/hearthstone/data/audit.ts`), `JUDGE` — `studios/manacost-youtube/judge.ts`. Скрипты берут их через `scripts/lib/channel.mjs` (`loadChannel`) |
| template/timing.ts, template/fps.ts, template/lint.tsx | `core/voice/timing.ts`, `core/time/fps.ts`, `core/qa/lint.tsx`; `recapTurn` — `looks/compendium/scenes/outro.tsx` |
| template/poster.ts | `games/hearthstone/data/poster.ts` |
| template/demo.ts | `studios/manacost-youtube/motion-showcase/demo.ts` |
| template/PosterCalib.tsx | `games/hearthstone/fixtures/PosterCalib.tsx` |
| template/theme.ts, template/parts/*, template/scenes/* | `looks/compendium/` (стиль, его сцены и детали), `games/hearthstone/scenes/` (сцены и детали Hearthstone) |
| brand/ (base.ts, index.ts, manacost.tsx) | `MANACOST` — `brands/manacost/channel.ts`; шрифт — `looks/compendium/theme.ts`; архив отвергнутого вида — `brands/manacost/archive.tsx` |
