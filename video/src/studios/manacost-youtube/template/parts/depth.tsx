// «Живой» арт: параллакс по карте глубины. Камера медленно сдвигается и наезжает, ближние фигуры смещаются сильнее
// дальних — арт не перерисовывается (пиксели Blizzard как есть, никакого «ИИ-почерка»). Карта глубины —
// scripts/depth.py → public/depth/<имя>.png. Луч ищет ближайшую поверхность по карте (как в DepthFlow), поэтому
// передний план честно закрывает задний. WebGL2: рендер с --gl=angle (видеокарта), иначе Chrome считает на процессоре.
import React, {useLayoutEffect, useRef, useState} from 'react';
import {cancelRender, continueRender, delayRender, Easing, interpolate, staticFile, useVideoConfig} from 'remotion';
import {useFrame} from '../fps';

// x, y — сдвиг камеры (−1…1, ±1 — полный ход параллакса), zoom — общий масштаб (≥ 1.08: запас на края),
// dolly — наезд по глубине: ближнее растёт быстрее дальнего (0 — плоский зум, 0.1 — заметный наезд)
export type DepthCam = {x: number; y: number; zoom: number; dolly?: number};

const VS = `#version 300 es
in vec2 p; out vec2 vUv;
void main() { vUv = vec2(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5); gl_Position = vec4(p, 0.0, 1.0); }`;

const FS = `#version 300 es
precision highp float;
uniform sampler2D uImg, uDepth;
uniform vec2 uRes, uImgSize, uOff;
uniform float uZoom, uDolly, uHeight, uFocus;
in vec2 vUv; out vec4 o;
// точка экрана (центр 0, единица — высота кадра) на глубине d → координаты в арте (арт заполняет кадр, как cover)
vec2 project(vec2 q, float d) {
  float k = d - uFocus;
  vec2 v = q / (uZoom * (1.0 + uDolly * k)) + uOff * k * uHeight;
  float sa = uRes.x / uRes.y, ia = uImgSize.x / uImgSize.y;
  vec2 s = sa > ia ? vec2(1.0, ia / sa) : vec2(sa / ia, 1.0);
  return 0.5 + vec2(v.x / sa, v.y) * s;
}
void main() {
  vec2 q = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  vec2 g = project(q, uFocus);
  vec2 gx = dFdx(g), gy = dFdy(g);
  // от ближнего к дальнему: первая глубина, где поверхность арта не ниже луча, — то, что видно в этой точке
  const int N = 72;
  float prev = 1.0, t = 0.0;
  for (int i = 1; i <= N; i++) {
    float d = 1.0 - float(i) / float(N);
    if (textureLod(uDepth, project(q, d), 0.0).r >= d) { t = d; break; }
    prev = d;
  }
  float a = t, b = prev;  // уточнение между последним промахом и попаданием
  for (int i = 0; i < 6; i++) {
    float m = 0.5 * (a + b);
    if (textureLod(uDepth, project(q, m), 0.0).r >= m) a = m; else b = m;
  }
  o = vec4(textureGrad(uImg, project(q, a), gx, gy).rgb, 1.0);
}`;

const load = (src: string) =>
  new Promise<HTMLImageElement>((ok, fail) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = () => fail(new Error(`не загрузилась картинка ${src}`));
    i.src = src;
  });

type GL = {gl: WebGL2RenderingContext; u: (n: string) => WebGLUniformLocation | null; img: [number, number]};

const setup = (canvas: HTMLCanvasElement, img: HTMLImageElement, depth: HTMLImageElement): GL => {
  const gl = canvas.getContext('webgl2', {preserveDrawingBuffer: true, antialias: false, alpha: false});
  if (!gl) throw new Error('DepthArt: нет WebGL2 — рендерить с --gl=angle');
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'шейдер');
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'программа');
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const tex = (unit: number, im: HTMLImageElement, mip: boolean) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
    if (mip) gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  };
  tex(0, img, true);
  tex(1, depth, false);
  const u = (n: string) => gl.getUniformLocation(prog, n);
  gl.uniform1i(u('uImg'), 0);
  gl.uniform1i(u('uDepth'), 1);
  return {gl, u, img: [img.naturalWidth, img.naturalHeight]};
};

export const DepthArt: React.FC<{
  src: string; // арт в public/, например 'art/nathria.jpg'
  depth?: string; // карта глубины; по умолчанию depth/<имя арта>.png
  from: DepthCam;
  to: DepthCam;
  dur: number; // путь камеры, кадров-30
  delay?: number;
  height?: number; // сила параллакса: сдвиг ближнего относительно дальнего при ходе ±1, доля высоты кадра
  focus?: number; // глубина, которая стоит на месте (0 — даль, 1 — передний план)
  style?: React.CSSProperties;
}> = ({src, depth, from, to, dur, delay = 0, height = 0.05, focus = 0.4, style}) => {
  const {width, height: h} = useVideoConfig();
  const f = useFrame();
  const ref = useRef<HTMLCanvasElement>(null);
  const [ctx, setCtx] = useState<GL | null>(null);
  const [handle] = useState(() => delayRender(`DepthArt ${src}`));
  const drawn = useRef(false);

  useLayoutEffect(() => {
    const d = depth ?? `depth/${src.split('/').pop()!.replace(/\.\w+$/, '')}.png`;
    Promise.all([load(staticFile(src)), load(staticFile(d))])
      .then(([im, dm]) => setCtx(setup(ref.current!, im, dm)))
      .catch(cancelRender);
  }, [src, depth]);

  useLayoutEffect(() => {
    if (!ctx) return;
    const {gl, u, img} = ctx;
    const t = interpolate(f, [delay, delay + dur], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.sin)});
    const lerp = (a: number, b: number) => a + (b - a) * t;
    gl.viewport(0, 0, width, h);
    gl.uniform2f(u('uRes'), width, h);
    gl.uniform2f(u('uImgSize'), img[0], img[1]);
    gl.uniform2f(u('uOff'), lerp(from.x, to.x), lerp(from.y, to.y));
    gl.uniform1f(u('uZoom'), lerp(from.zoom, to.zoom));
    gl.uniform1f(u('uDolly'), lerp(from.dolly ?? 0, to.dolly ?? 0));
    gl.uniform1f(u('uHeight'), height);
    gl.uniform1f(u('uFocus'), focus);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.finish();
    if (!drawn.current) continueRender(handle);
    drawn.current = true;
  }, [ctx, f, delay, dur, from, to, height, focus, width, h, handle]);

  return <canvas ref={ref} width={width} height={h} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', ...style}} />;
};
