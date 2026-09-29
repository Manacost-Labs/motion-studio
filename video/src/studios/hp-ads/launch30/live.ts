// Живые клипы Higgsfield для этого ролика. Чего нет — рисуется статичный арт.
// len — длина клипа в кадрах при 30 fps: если сцена длиннее, клип слегка замедляется.
import {LiveSrc} from '../../../hearthpulse';

export type LiveId = 'hook' | 'standard' | 'cards' | 'arena' | 'bg' | 'end';

export const LIVE: Record<LiveId, LiveSrc> = {
  hook: {v: 'live/hook.mp4', h: 'live-h/hook.mp4', len: 121},
  standard: {v: 'live/standard.mp4', len: 151}, // 16:9 модель отклонила (ip_detected)
  cards: {v: 'live/cards.mp4', h: 'live-h/cards.mp4', len: 121},
  arena: {v: 'live/arena.mp4', h: 'live-h/arena.mp4', len: 151},
  bg: {v: 'live/bg.mp4', h: 'live-h/bg.mp4', len: 121},
  end: {}, // арт «Бесплодных земель» отклонён в обеих ориентациях
};
