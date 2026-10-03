// Переход между сценами — «перелистывание страницы компендиума»: тело сцены (всё под шапкой) уезжает влево
// с лёгким поворотом и тенью у края, следующая страница въезжает справа. Сцены на стыке перекрываются на OVL кадров
// (YtVideo продлевает уходящую сцену). Красная шапка стоит на месте: полоса не перерисовывается, меняются надписи,
// номер места прокручивается со старого на новый (HeaderBand читает prevRank отсюда)
import React, {createContext, useContext} from 'react';
import {AbsoluteFill, interpolate} from 'remotion';
import {EASE_IN_OUT} from '../theme';
import {useFrame} from '../fps';

export const OVL = 18; // кадров перекрытия сцен на стыке

type Motion = {enter: number; exit: number; persistBand: boolean; prevRank?: number; prevRankOf?: number};
const Ctx = createContext<Motion>({enter: 1, exit: 0, persistBand: false});
export const useSceneMotion = () => useContext(Ctx);

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

// dur — длина сцены без хвоста перекрытия; first — у первой сцены нет входа, last — нет выхода
// prevRank/prevRankOf — место в шапке предыдущей сцены (если было): новое прокручивается с него или оно уезжает
export const SceneMotion: React.FC<{dur: number; first: boolean; last: boolean; prevRank?: number; prevRankOf?: number; children: React.ReactNode}> = ({dur, first, last, prevRank, prevRankOf, children}) => {
  const f = useFrame();
  const enter = first ? 1 : interpolate(f, [0, OVL], [0, 1], {...clamp, easing: EASE_IN_OUT});
  const exit = last ? 0 : interpolate(f, [dur, dur + OVL], [0, 1], {...clamp, easing: EASE_IN_OUT});
  return <Ctx.Provider value={{enter, exit, persistBand: !first, prevRank, prevRankOf}}>{children}</Ctx.Provider>;
};

// Перелистывание внутри сцены (итоговая таблица → конечная заставка): страница со своими enter/exit,
// не заданное берётся у сцены. До начала въезда страница не рисуется
export const PageLayer: React.FC<{enter?: number; exit?: number; children: React.ReactNode}> = ({enter, exit, children}) => {
  const m = useSceneMotion();
  const v = {...m, enter: enter ?? m.enter, exit: exit ?? m.exit};
  if (v.enter <= 0 || v.exit >= 1) return null;
  return (
    <Ctx.Provider value={v}>
      <SceneBody>{children}</SceneBody>
    </Ctx.Provider>
  );
};

// Тело сцены — «страница»: въезд справа, уход влево, тень у ведущего края
export const SceneBody: React.FC<{children: React.ReactNode}> = ({children}) => {
  const {enter, exit} = useSceneMotion();
  if (enter >= 1 && exit <= 0) return <AbsoluteFill>{children}</AbsoluteFill>;
  const x = (1 - enter) * 62 - exit * 38; // % ширины
  const rot = (1 - enter) * 10 - exit * 7;
  const shade = Math.max(1 - enter, exit);
  return (
    <AbsoluteFill style={{perspective: 2400}}>
      <AbsoluteFill
        style={{
          transform: `translateX(${x}%) rotateY(${rot}deg)`,
          transformOrigin: enter < 1 ? 'right center' : 'left center',
          opacity: Math.min(1, enter * 4) * (1 - exit * exit),
          boxShadow: `${enter < 1 ? -26 : 26}px 0 60px rgba(60,30,10,${0.45 * shade})`,
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
