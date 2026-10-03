# Плавность камеры в готовом видео: покадровый сдвиг картинки в нескольких окнах (фазовая корреляция с субпиксельной
# доводкой) и «шум» — отклонение сдвига от сглаженной кривой. Плавный ход камеры даёт ровные сдвиги (−3,6 −3,6 −3,5 …),
# привязка к пикселям — скачущие (−3 −4 −3 −4): колода мелко дрожит, хотя кадр за кадром этого не видно.
#   .venv-vo/Scripts/python.exe scripts/cam-jitter.py <видео> <начало, с> <длина, с> [x,y x,y …]
# Окна 256×256 по умолчанию — область постера в сцене колоды (1080p). Ориентиры (02.10.2026): шум 0,02–0,04 px — ровно,
# 0,1 px и больше — дрожь (до перевода постера на transform было 0,29).
import subprocess
import sys

import numpy as np

video, t0, dur = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
wins = [tuple(map(int, a.split(','))) for a in sys.argv[4:]] or [(1000, 260), (1400, 260), (1000, 640), (1400, 640)]
W, H, S = 1920, 1080, 256
raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(t0), '-t', str(dur), '-i', video, '-vf', f'scale={W}:{H}', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], capture_output=True).stdout
fr = np.frombuffer(raw, np.uint8).reshape(-1, H, W).astype(np.float32)
han = np.outer(np.hanning(S), np.hanning(S))


def shift(a, b):
    A = np.fft.fft2((a - a.mean()) * han)
    B = np.fft.fft2((b - b.mean()) * han)
    R = A * np.conj(B)
    R /= np.abs(R) + 1e-9
    r = np.fft.ifft2(R).real
    y, x = np.unravel_index(np.argmax(r), r.shape)

    def sub(c, m, n):  # параболическая доводка пика
        l, cc, rr = m[(c - 1) % n], m[c], m[(c + 1) % n]
        v = c + (l - rr) / (2 * (l - 2 * cc + rr) + 1e-9)
        return v - n if v > n / 2 else v

    return sub(x, r[y, :], S), sub(y, r[:, x], S)


out = np.array([[shift(fr[i][y:y + S, x:x + S], fr[i + 1][y:y + S, x:x + S]) for i in range(len(fr) - 1)] for (x, y) in wins])
smooth = np.apply_along_axis(lambda v: np.convolve(v, np.ones(5) / 5, 'same'), 1, out)
noise = float(np.abs(out - smooth)[:, 2:-2].mean())
np.set_printoptions(linewidth=200, precision=2, suppress=True)
print(f'кадров {len(fr)}, средний сдвиг за кадр {np.abs(out).mean(axis=(0, 1)).round(2)} px')
print('сдвиг по x, окно 1:', out[0, :30, 0])
print(f'шум {noise:.3f} px — {"ровно" if noise < 0.06 else "проверить глазами" if noise < 0.1 else "дрожь"}')
