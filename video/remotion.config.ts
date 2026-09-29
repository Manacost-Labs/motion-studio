import {Config} from '@remotion/cli/config';

// Точка входа по умолчанию — студия рекламы HearthPulse; другие студии: npm run studio:features / studio:youtube
Config.setEntryPoint('src/studios/hp-ads/index.ts');
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(92);
Config.setConcurrency(4);
