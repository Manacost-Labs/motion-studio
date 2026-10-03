# Планы видео по склейкам (PySceneDetect, AdaptiveDetector — устойчив к движению камеры и анимациям). Вызывает eyes.mjs scenes.
#   .venv-vo/Scripts/python.exe scripts/scenes.py <видео> [--from 0] [--to 0] [--min 1.5]
# Печатает JSON [[начало, конец], …] в секундах от начала файла; планы короче --min с присоединяются к соседнему.
import json
import sys

from scenedetect import AdaptiveDetector, detect

a = sys.argv[1:]
opt = lambda n, d: float(a[a.index(n) + 1]) if n in a else d
start, end, min_len = opt('--from', 0), opt('--to', 0), opt('--min', 1.5)
scenes = detect(a[0], AdaptiveDetector(), start_time=start or None, end_time=end or None)
spans = [[s.get_seconds(), e.get_seconds()] for s, e in scenes]
if not spans:  # ни одной склейки — один план на весь отрезок
    spans = [[start, end]] if end else []
merged = []
for s, e in spans:
    if merged and (e - s < min_len or merged[-1][1] - merged[-1][0] < min_len):
        merged[-1][1] = e
    else:
        merged.append([s, e])
print(json.dumps([[round(s, 2), round(e, 2)] for s, e in merged]))
