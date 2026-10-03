# Карта глубины для «живого» арта: параллакс в Remotion (manacost-youtube/template/parts/depth.tsx).
#   .venv-vo/Scripts/python.exe scripts/depth.py public/art/nathria.jpg [ещё.jpg ...]
# Модель — Depth Anything V2 Small (ONNX, Apache 2.0; веса Base/Large — только некоммерческие, их не брать),
# скачивается один раз в кэш Hugging Face (~100 МБ). Пишет public/depth/<имя>.png: серый, белое — близко,
# чёрное — далеко. Считается на процессоре за секунды; усреднение с зеркальным прогоном убирает шум.
# Ближнее на карте чуть расширено (GROW): иначе при сдвиге камеры за фигурами тянутся полосы их краёв.
import os
import subprocess
import sys
import time

import numpy as np

MEAN = np.array([0.485, 0.456, 0.406], np.float32)
STD = np.array([0.229, 0.224, 0.225], np.float32)
LONG = 1288  # длинная сторона на входе модели, кратно 14: мельче — теряются детали, крупнее — плывёт общий план
GROW = 4  # на сколько точек карты расширить ближнее (≈ 8 точек арта 2752 px)


def size(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', path], capture_output=True, text=True).stdout
    w, h = out.strip().split(',')[:2]
    return int(w), int(h)


def rgb(path, w, h):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-vf', f'scale={w}:{h}:flags=bicubic', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(h, w, 3).astype(np.float32) / 255


def window(a, r, op):
    # квадратное окно (2r+1)² по двум осям: op = np.max — расширение ближнего, np.mean — сглаживание
    for ax in (0, 1):
        p = np.pad(a, [(r, r) if i == ax else (0, 0) for i in (0, 1)], mode='edge')
        a = op(np.stack([np.take(p, range(i, i + a.shape[ax]), axis=ax) for i in range(2 * r + 1)]), axis=0)
    return a


def main(files):
    from huggingface_hub import hf_hub_download
    import onnxruntime as ort
    model = hf_hub_download('onnx-community/depth-anything-v2-small', 'onnx/model.onnx')
    sess = ort.InferenceSession(model, providers=['CPUExecutionProvider'])
    os.makedirs(os.path.join('public', 'depth'), exist_ok=True)
    for f in files:
        t0 = time.time()
        w0, h0 = size(f)
        k = LONG / max(w0, h0)
        w, h = round(w0 * k / 14) * 14, round(h0 * k / 14) * 14
        x = ((rgb(f, w, h) - MEAN) / STD).transpose(2, 0, 1)[None]
        d = sess.run(None, {'pixel_values': x})[0][0]
        d = (d + sess.run(None, {'pixel_values': x[..., ::-1].copy()})[0][0][:, ::-1]) / 2  # зеркальный прогон
        lo, hi = np.percentile(d, [0.5, 99.5])
        d = np.clip((d - lo) / (hi - lo), 0, 1)
        # ближнее чуть шире настоящего контура: при сдвиге камеры за фигурой тянется фон, а не край фигуры
        d = window(window(d, GROW, np.max), 1, np.mean)
        out = os.path.join('public', 'depth', os.path.splitext(os.path.basename(f))[0] + '.png')
        g = (d * 255 + 0.5).astype(np.uint8)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'gray', '-s', f'{g.shape[1]}x{g.shape[0]}', '-i', '-', out], input=g.tobytes(), check=True)
        print(f'{out}  {g.shape[1]}x{g.shape[0]}  {time.time() - t0:.1f} с')


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit('depth.py <картинка> [...]')
    main(sys.argv[1:])
