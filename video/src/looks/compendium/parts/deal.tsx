// Раздача из колоды: карты по одной слетают со стопки на свои места — с мягким разгоном (каждая следующая уходит чуть
// раньше), спокойной дугой, посадкой и лёгким «прижатием» к столу; тень садится на 3 кадра позже карты. Перед первой
// картой — замах: стопка проседает, верхняя карта оттягивается против раздачи. Полёт тем дольше, чем дальше место
// (скорость не выше ~60 px за кадр при 60 к/с), без размытия — карта читается и в полёте. Карты целиком (рендер не
// обрезается), после посадки неподвижны (transform без изменений — кадры сходятся). Стиль не знает игры: картинки и места
// приходят пропсами.
// По мотивам Vincentwei1021/video-shotcraft, demos/ui-entrance/deck-deal-flyin/DeckDealFlyin.tsx (Apache-2.0):
// оттуда — раздача с сокращающимся интервалом, полёт с дугой и пиком масштаба, посадка 4 кадра с крошечным перелётом,
// прижатие 0,996 → 1, замах 44/30 px и тень с запаздыванием. У нас — вид сверху без 3D-камеры (высота = масштаб и тень),
// спокойнее по вкусу «Компендиума»: полёт 14–28 кадров по дальности вместо 8, интервал 6 → 4 кадра вместо 4 → 0,2,
// без размытия и «призрака»; время — «кадры-30»
import React from 'react';
import {Easing, Img, interpolate} from 'remotion';
import {useFrame} from '../../../core/time/fps';
import {clamp} from '../../../core/time/ease';
import {lagged} from '../../../core/time/motion';
import {EASE_IN_OUT, ramp} from '../theme';

export const CARD_RATIO = 512 / 776; // рендер карты HearthstoneJSON
const FLY_MIN = 14; // кадров полёта до ближнего места
const FLY_MAX = 28; // … и до дальнего
const FLY_PX = 56; // px пути на кадр полёта: при FLY_EASE пик скорости ≈ 2 × 56 = 112 px за кадр-30 (56 при 60 к/с)
const SETTLE = 4; // кадров посадки
const FLY_EASE = Easing.bezier(0.36, 0, 0.4, 1); // мягко трогается и долго тормозит; пик скорости ≈ 2 × средней
const SETTLE_EASE = Easing.bezier(0.3, 0, 0.25, 1.15); // y > 1 — перелёт на доли пикселя, не пружина
const WIND = 12; // кадров замаха до первой карты
const PRESS_DOWN = 44; // px — стопка проседает
const PULL = 30; // px — верхняя карта оттягивается против раздачи
const RELEASE = 16; // кадров — стопка возвращается после первой карты
const ARC = 40; // px — дуга полёта вверх по кадру
const LEAN = 3; // ° — карта клонится по ходу полёта
const SHADOW_LAG = 3; // кадров — тень догоняет карту
const GAP_FIRST = 6; // кадров между первой и второй картой
const GAP_STEP = 0.18; // на столько короче каждый следующий интервал
const GAP_MIN = 3;

// Кадр, когда k-я карта уходит со стопки: интервал 6 кадров сокращается на 0,18 за карту (не короче 3) — раздача разгоняется
export const dealCue = (at: number, k: number) => {
  let t = at;
  for (let j = 1; j <= k; j++) t += Math.max(GAP_MIN, GAP_FIRST - GAP_STEP * (j - 1));
  return t;
};

type Pt = {x: number; y: number};
type State = {x: number; y: number; rot: number; scale: number; lift: number};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Стопка: карта k лежит под k картами; разброс — по формуле от номера (рендер воспроизводим), каждая следующая чуть ниже-правее
const inPile = (k: number, f: number, pile: Pt, at: number): State => {
  const wind = interpolate(f, [at - WIND, at], [0, 1], {...clamp, easing: Easing.out(Easing.quad)});
  const press = wind * (1 - ramp(f, at, at + RELEASE, EASE_IN_OUT));
  return {
    x: pile.x + (((k * 7) % 9) - 4) * 2 + k * 1.3 - (k === 0 ? PULL * wind : 0),
    y: pile.y + (((k * 5) % 7) - 3) * 2 + k * 1.7 + PRESS_DOWN * press,
    rot: (((k * 11) % 7) - 3) * 0.8,
    scale: 1 - 0.012 * press,
    lift: 0,
  };
};

const stateAt = (k: number, f: number, slot: Pt, pile: Pt, at: number): State => {
  const cue = dealCue(at, k);
  if (f <= cue) return inPile(k, f, pile, at);
  const from = inPile(k, cue, pile, at); // полёт начинается ровно оттуда, где карта была в миг броска
  const fly = Math.min(FLY_MAX, Math.max(FLY_MIN, Math.hypot(slot.x - from.x, slot.y - from.y) / FLY_PX));
  const t = Math.min(1, (f - cue) / fly);
  const e = FLY_EASE(t);
  // дуга — по пройденному пути, а не по времени: карта трогается и садится без рывка (скорость на концах — ноль)
  const arc = Math.sin(Math.PI * e);
  const s = interpolate(f, [cue + fly, cue + fly + SETTLE], [0, 1], {...clamp, easing: SETTLE_EASE});
  const hover = e * (1 - s); // карта зависает над местом и садится
  const tap = interpolate(f, [cue + fly + 2, cue + fly + 3, cue + fly + 4], [1, 0.996, 1], clamp);
  return {
    x: lerp(from.x, slot.x, e),
    y: lerp(from.y, slot.y, e) - ARC * arc,
    rot: lerp(from.rot, 0, e) + LEAN * arc * Math.sign(slot.x - from.x),
    // высота читается масштабом: пик +4 % на середине дуги, +2 % в зависании; прижатие — 0,996 за кадр до конца посадки
    scale: lerp(from.scale, 1, e) * (1 + 0.04 * arc + 0.02 * hover) * tap,
    lift: arc + 0.3 * hover,
  };
};

type Props = {cards: string[]; slots: Pt[]; h: number; pile: Pt; at: number};

const Card: React.FC<Props & {k: number}> = ({cards, slots, h, pile, at, k}) => {
  const f = useFrame();
  const w = h * CARD_RATIO;
  const st = stateAt(k, f, slots[k], pile, at);
  // тень садится позже карты: высота для тени — та, что была SHADOW_LAG кадров назад
  const lift = Math.min(1.2, Math.max(0, lagged((g) => stateAt(k, g, slots[k], pile, at).lift, f, SHADOW_LAG)));
  const flown = f > dealCue(at, k);
  return (
    <Img
      src={cards[k]}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: w,
        height: h,
        objectFit: 'contain',
        zIndex: flown ? 100 + k : cards.length - k,
        transform: `translate(${(st.x - w / 2).toFixed(2)}px, ${(st.y - h / 2).toFixed(2)}px) rotate(${st.rot.toFixed(3)}deg) scale(${st.scale.toFixed(4)})`,
        filter: `drop-shadow(0 ${(8 + 40 * lift).toFixed(1)}px ${(10 + 30 * lift).toFixed(1)}px rgba(60,25,10,${(0.4 - 0.14 * Math.min(1, lift)).toFixed(3)}))`,
      }}
    />
  );
};

// cards — картинки в порядке раздачи (staticFile), slots — центры мест, h — высота карты, pile — центр стопки,
// at — кадр, когда уходит первая карта (замах — за WIND кадров до него)
export const DeckDeal: React.FC<Props> = (props) => (
  <>
    {props.cards.map((_, k) => (
      <Card key={k} {...props} k={k} />
    ))}
  </>
);
