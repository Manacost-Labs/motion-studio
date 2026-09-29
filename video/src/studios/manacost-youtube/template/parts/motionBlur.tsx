// Размытие в движении — как HtmlInCanvasMotionBlur из @remotion/motion-blur (усреднение снимков на дробных кадрах),
// но холст рисуется с плотностью пикселей экрана. Штатный компонент всегда рисует в 1×, и при рендере в 4K
// (--scale=2) колода во время движения камеры становилась вдвое мягче, чем в покое.
import React, {useCallback} from 'react';
import {Freeze, HtmlInCanvas, HtmlInCanvasOnPaint, useCurrentFrame, useVideoConfig} from 'remotion';

const Sample: React.FC<{children: React.ReactNode; width: number; height: number; index: number; count: number; shutter: number}> = ({
  children,
  width,
  height,
  index,
  count,
  shutter,
}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const at = Math.max(0, Math.min(durationInFrames - 1, frame + ((index + 0.5) / count - 0.5) * shutter));
  return (
    // атрибут drawable нужен Chrome, чтобы снимать элемент в холст
    <div {...{drawable: ''}} aria-hidden={index !== Math.floor(count / 2)} style={{position: 'absolute', inset: 0, width, height, isolation: 'isolate', pointerEvents: 'none'}}>
      <Freeze frame={at}>{children}</Freeze>
    </div>
  );
};

export const MotionBlur: React.FC<{children: React.ReactNode; width: number; height: number; samples?: number; shutterAngle?: number}> = ({
  children,
  width,
  height,
  samples = 8,
  shutterAngle = 180,
}) => {
  const shutter = shutterAngle / 360;
  const density = typeof window === 'undefined' ? 1 : Math.min(3, Math.max(1, window.devicePixelRatio || 1));
  const onPaint: HtmlInCanvasOnPaint = useCallback(
    ({canvas, element, elementImage}) => {
      const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D & {drawElementImage: (img: unknown, x: number, y: number) => DOMMatrix};
      const layout = element.parentElement as HTMLCanvasElement & {captureElementImage: (el: Element) => {close: () => void}};
      const els = Array.from(layout.children);
      if (els.length !== samples || els[0] !== element) throw new Error('Снимки для размытия ещё не готовы');
      ctx.reset();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1 / samples;
      els.forEach((el, i) => {
        const img = i === 0 ? elementImage : layout.captureElementImage(el);
        try {
          const m = ctx.drawElementImage(img, 0, 0);
          if (i === Math.floor(samples / 2)) (el as HTMLElement).style.transform = m.toString();
        } finally {
          if (i !== 0) img.close();
        }
      });
    },
    [samples],
  );
  const els = Array.from({length: samples}, (_, i) => (
    <Sample key={i} width={width} height={height} index={i} count={samples} shutter={shutter}>
      {children}
    </Sample>
  ));
  return (
    <HtmlInCanvas width={width} height={height} pixelDensity={density} onPaint={onPaint} _remotionInternalCanvasSiblings={els.slice(1)}>
      {els[0]}
    </HtmlInCanvas>
  );
};
