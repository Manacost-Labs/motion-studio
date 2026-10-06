import {Config} from '@remotion/cli/config';

// Точка входа по умолчанию — студия рекламы HearthPulse; другие студии: npm run studio:features / studio:youtube
Config.setEntryPoint('src/studios/hp-ads/index.ts');
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(92);
Config.setConcurrency(4); // замер npx remotion benchmark 04.10.2026: 4 быстрее 8 и 12, на 16 браузер не отвечает (scripts/render.ps1)
