// Три студии — у каждой своя точка входа Remotion (src/studios/<папка>/index.ts), описание — src/studios/README.md
import path from 'node:path';

export const STUDIOS = {ads: 'hp-ads', features: 'hp-features', youtube: 'manacost-youtube'};

// Папка студии: studioDir('youtube') → абсолютный путь к src/studios/manacost-youtube
export const studioDir = (studio) => {
  if (!STUDIOS[studio]) throw new Error(`Нет студии «${studio}»: ${Object.keys(STUDIOS).join(', ')}`);
  return path.resolve('src/studios', STUDIOS[studio]);
};
export const entryPoint = (studio) => path.join(studioDir(studio), 'index.ts');
