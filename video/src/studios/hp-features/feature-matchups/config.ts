// Анонс раздела «Матчапы» по шаблону «новая функция» (hp-features/template).
// Для нового анонса скопируйте эту папку в src/studios/hp-features/feature-<тема> и замените содержимое.
import {RIGHT_X} from '../../../hearthpulse';
import {FeatureSpotConfig} from '../template/FeatureSpot';

export const MATCHUPS: FeatureSpotConfig = {
  hook: {
    kicker: 'Новое на HearthPulse',
    title: 'Против кого\nты играешь?',
    art: 'art/frozen-throne.jpg',
    cards: ['CORE_EX1_298', 'JAIL_720', 'CATA_200', 'CORE_RLK_567', 'JAIL_504'],
  },
  logo: {tagline: 'Статистика и аналитика Hearthstone'},
  features: [
    {
      dur: 150,
      kicker: 'Стандарт · Вольный',
      title: 'Матчапы',
      titleSize: 130,
      sub: 'Винрейт каждой колоды против каждой',
      backdrop: {
        art: 'art/gvg.jpg',
        focus: '45% 50%',
        dim: 0.84,
        char: {
          v: {src: 'chars/warlock.png', h: 900, side: 'right', offset: -200, bottom: -60},
          h: {src: 'chars/warlock.png', h: 700, side: 'left', offset: 40, bottom: -60},
        },
      },
      // Быстрый просмотр матчапов → «прокрутка» к сводке лучших архетипов
      panels: [
        {
          src: 'ui/matchups.png',
          size: [2238, 1328],
          layout: {v: {w: 980, y: 600}, h: {w: 1000, x: RIGHT_X + 20, y: 200}},
          delay: 10,
          exitAt: 80,
          exitMode: 'scroll',
          highlights: [{rect: [80, 530, 650, 84], delay: 36}],
        },
        {
          src: 'ui/matchups-summary.png',
          size: [2238, 1450],
          layout: {v: {w: 980, y: 600}, h: {w: 1000, x: RIGHT_X + 20, y: 180}},
          from: 'scroll',
          delay: 80,
          highlights: [{rect: [38, 128, 1056, 77], delay: 114}],
        },
      ],
    },
  ],
  end: {label: 'Уже в подписке', price: 'от 99 ₽/мес'},
};
