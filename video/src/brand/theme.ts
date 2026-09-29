import {loadFont} from '@remotion/fonts';
import {loadFont as loadInter} from '@remotion/google-fonts/Inter';
import {staticFile} from 'remotion';

// Палитра снята с интерфейса hearthpulse.net
export const C = {
  bordo: '#6F1818',
  bordoDeep: '#3A0A0E',
  night: '#16050A',
  parchment: '#F5E2BC',
  parchmentLight: '#FBF2D5',
  gold: '#D1AB70',
  goldBright: '#F4CF72',
  purple: '#543671',
  cream: '#FFF3D6',
  ink: '#2A0608',
  boosty: '#F15F2C',
};

loadFont({family: 'HSDisplay', url: staticFile('brand/HSDisplay.otf')});
export const {fontFamily: INTER} = loadInter('normal', {
  weights: ['500', '700', '800'],
  subsets: ['cyrillic', 'latin'],
});
export const DISPLAY = 'HSDisplay, serif';

export const FPS = 30;
export const W = 1080;
export const H = 1920;
