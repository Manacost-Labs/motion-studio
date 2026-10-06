# «Уши» студии: объективные цифры по звуку, чтобы судить о голосе и отделке, не слыша их.
#   .venv-vo/Scripts/python.exe scripts/ears.py <id> [сцена ...]       — голос по сценам: public/vo/<id>/<сцена>.mp3 или .wav (+ .json)
#   .venv-vo/Scripts/python.exe scripts/ears.py --video <файл.mp4>     — готовое видео: громкость и звуки, которые громче голоса
#   .venv-vo/Scripts/python.exe scripts/ears.py --compare <дубль1> <дубль2> — два дубля одного текста: какой спокойнее
#   .venv-vo/Scripts/python.exe scripts/ears.py --metrics <файл...>    — цифры в JSON (для vo-takes.mjs)
# Главный признак крика — высота голоса: тот же текст вступления «[excited]» 219 Гц, спокойно 136 Гц (02.10).
# По сценам: длительность, темп (знаков в секунду речи), паузы с местом в тексте, «напряжённость» (средний центр спектра —
# при крике растёт: спокойная запись 2300–2700 Гц, «[excited]» ~3200), высота голоса и её разброс в полутонах (меньше
# 1,5 — монотонно), диапазон громкости LRA. Сцены, которые выбиваются из остальных, помечаются. Пишет out/<id>/ears-report.md.
import json
import os
import re
import subprocess
import sys

import numpy as np

SR = 16000


def pcm(path, t0=None, dur=None):
    cut = (['-ss', str(t0)] if t0 is not None else []) + (['-t', str(dur)] if dur is not None else [])
    raw = subprocess.run(['ffmpeg', '-v', 'error', *cut, '-i', path, '-ac', '1', '-ar', str(SR), '-f', 's16le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768


def ff(args):
    return subprocess.run(['ffmpeg', '-hide_banner', *args, '-f', 'null', '-'], capture_output=True, text=True, encoding='utf-8', errors='replace')


def pauses(path, db=-40, d=0.25):
    log = ff(['-i', path, '-af', f'silencedetect=n={db}dB:d={d}']).stderr
    starts = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', log)]
    ends = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', log)]
    return list(zip(starts, ends))


def centroid(path):
    out = ff(['-i', path, '-af', 'aspectralstats=measure=centroid,ametadata=print:key=lavfi.aspectralstats.1.centroid:file=-']).stdout
    v = [float(x) for x in re.findall(r'centroid=([\d.]+)', out)]
    v = [x for x in v if x > 0]
    return float(np.mean(v)) if v else 0.0


def lra(path):
    log = ff(['-i', path, '-af', 'ebur128']).stderr
    m = re.findall(r'LRA:\s+([\d.]+) LU', log)
    return float(m[-1]) if m else 0.0


def pitch(x):
    # высота голоса по кадрам 64 мс с шагом 20 мс: автокорреляция, голос 70–400 Гц, звонкие кадры — пик > 0,45
    n, hop = 1024, 320
    lo, hi = SR // 400, SR // 70
    f0 = []
    for i in range(0, len(x) - n, hop):
        fr = x[i:i + n] - x[i:i + n].mean()
        if np.sqrt(np.mean(fr ** 2)) < 0.02:
            continue
        spec = np.fft.rfft(fr, 2 * n)
        ac = np.fft.irfft(spec * np.conj(spec))[:n]
        if ac[0] <= 0:
            continue
        lag = lo + int(np.argmax(ac[lo:hi]))
        if ac[lag] / ac[0] < 0.45:
            continue
        f0.append(SR / lag)
    if len(f0) < 10:
        return 0.0, 0.0
    f0 = np.array(f0)
    med = float(np.median(f0))
    st = 12 * np.log2(f0 / med)
    st = st[np.abs(st) < 12]  # срывы на октаву — ошибки оценки
    return med, float(np.std(st))


def where(text, start, t):
    # место в тексте для момента t (по времени символов из <сцена>.json)
    i = next((k for k, s in enumerate(start) if s >= t), len(text))
    a, b = max(0, i - 18), min(len(text), i + 18)
    return f'«…{text[a:i].strip()} | {text[i:b].strip()}…»'


def scenes(vid, only):
    root = os.path.join('public', 'vo', vid)
    rows = []
    # голос сцены — <сцена>.mp3 или .wav; если есть оба — более свежий
    found = {}
    for f in os.listdir(root):
        seg, ext = os.path.splitext(f)
        if ext in ('.mp3', '.wav'):
            p = os.path.join(root, f)
            if seg not in found or os.path.getmtime(p) > os.path.getmtime(found[seg]):
                found[seg] = p
    for seg in sorted(found):
        if only and not any(re.search(p, seg) for p in only):
            continue
        path = found[seg]
        meta = json.load(open(os.path.join(root, seg + '.json'), encoding='utf-8')) if os.path.exists(os.path.join(root, seg + '.json')) else None
        x = pcm(path)
        dur = len(x) / SR
        ps = [(a, b) for a, b in pauses(path) if a > 0.05 and b < dur - 0.05]  # тишина по краям — не паузы
        speech = dur - sum(b - a for a, b in ps)
        text = meta['text'] if meta else ''
        rate = len(re.sub(r'\s', '', text)) / speech if text and speech > 0 else 0
        med, spread = pitch(x)
        rows.append({'seg': seg, 'dur': dur, 'rate': rate, 'pauses': [(a, b - a, where(text, meta['start'], a) if meta else '') for a, b in ps], 'centroid': centroid(path), 'f0': med, 'spread': spread, 'lra': lra(path)})
    return rows


def report_scenes(vid, rows):
    med = lambda k: float(np.median([r[k] for r in rows if r[k]])) if rows else 0
    mc, mr, mf = med('centroid'), med('rate'), med('f0')
    lines = [f'# Голос «{vid}»', '', '| сцена | с | знаков/с | пауз | центр спектра, Гц | высота, Гц | разброс, пт | LRA | заметки |', '|---|---|---|---|---|---|---|---|---|']
    for r in rows:
        notes = []
        # центр спектра зависит и от текста (шипящие поднимают его), поэтому «напряжённо» — только вместе с поднятым голосом
        if r['f0'] > mf * 1.15:
            notes.append('голос поднят — похоже на крик')  # «возбуждённое» вступление: 219 Гц против 136 у спокойного
        elif r['centroid'] > max(2900, mc * 1.12) and r['f0'] > mf * 1.06:
            notes.append('напряжённо — возможен крик')
        if mr and r['rate'] > mr * 1.15:
            notes.append('быстрее остальных')
        if mr and r['rate'] and r['rate'] < mr * 0.85:
            notes.append('медленнее остальных')
        if r['spread'] and r['spread'] < 1.5:
            notes.append('монотонно')
        if r['dur'] > 12 and len(r['pauses']) / r['dur'] * 10 < 0.4:
            notes.append('мало пауз')
        r['notes'] = notes
        lines.append(f"| {r['seg']} | {r['dur']:.1f} | {r['rate']:.1f} | {len(r['pauses'])} | {r['centroid']:.0f} | {r['f0']:.0f} | {r['spread']:.1f} | {r['lra']:.1f} | {', '.join(notes)} |")
    lines += ['', f'Медианы: центр спектра {mc:.0f} Гц, темп {mr:.1f} знака/с.', '', '## Паузы (≥ 0,25 с)']
    for r in rows:
        if r['pauses']:
            lines.append(f"- **{r['seg']}**: " + '; '.join(f'{a:.1f} с ({d:.2f} с) {w}' for a, d, w in r['pauses']))
    return lines


def report_video(path):
    log = ff(['-i', path, '-af', 'ebur128=metadata=1,ametadata=print:key=lavfi.r128.M:file=-'])
    t, ms = 0.0, []
    for line in log.stdout.splitlines():
        m = re.search(r'pts_time:([\d.]+)', line)
        if m:
            t = float(m.group(1))
        m = re.search(r'lavfi\.r128\.M=(-?[\d.]+)', line)
        if m:
            ms.append((t, float(m.group(1))))
    vals = np.array([v for _, v in ms if v > -50])
    base = float(np.median(vals)) if len(vals) else -20
    loud = []
    for tt, v in ms:
        if v > base + 6 and (not loud or tt - loud[-1][0] > 1.0):
            loud.append((tt, v))
    total = ff(['-i', path, '-af', 'ebur128=peak=true']).stderr
    integ = re.findall(r'I:\s+(-?[\d.]+) LUFS', total)
    lr = re.findall(r'LRA:\s+([\d.]+) LU', total)
    lines = [f'# Звук видео {os.path.basename(path)}', '', f'Громкость {integ[-1] if integ else "?"} LUFS, диапазон LRA {lr[-1] if lr else "?"} LU, обычный уровень (медиана M) {base:.1f} LUFS.', '', '## Моменты громче обычного на 6+ LU (эффекты, музыка — проверить, не перекрывают ли голос)']
    lines += [f'- {tt:.1f} с: {v:.1f} LUFS (+{v - base:.1f})' for tt, v in loud] or ['- нет']
    return lines


def report_compare(a, b):
    # два дубля одного текста: здесь центр спектра честно показывает напряжённость (текст одинаковый)
    rows = []
    for p in (a, b):
        x = pcm(p)
        f0, spread = pitch(x)
        ps = pauses(p)
        rows.append((os.path.basename(p), len(x) / SR, centroid(p), f0, spread, len(ps)))
    lines = ['# Сравнение дублей', '', '| дубль | с | центр спектра, Гц | высота, Гц | разброс, пт | пауз |', '|---|---|---|---|---|---|']
    lines += [f'| {n} | {d:.1f} | {c:.0f} | {f:.0f} | {s:.1f} | {k} |' for n, d, c, f, s, k in rows]
    (_, _, c1, f1, _, _), (_, _, c2, f2, _, _) = rows
    lines += ['', f'Второй дубль {"спокойнее" if c2 < c1 * 0.95 else "напряжённее" if c2 > c1 * 1.05 else "по напряжённости такой же"}: центр спектра {c1:.0f} → {c2:.0f} Гц, высота {f1:.0f} → {f2:.0f} Гц.']
    return lines


def metrics(files):
    # цифры для скриптов (vo-takes.mjs): по строке JSON на файл
    for p in files:
        x = pcm(p)
        dur = len(x) / SR
        f0, spread = pitch(x)
        ps = [(s, e) for s, e in pauses(p) if s > 0.05 and e < dur - 0.05]
        print(json.dumps({'file': p, 'dur': dur, 'f0': f0, 'spread': spread, 'centroid': centroid(p), 'pauses': len(ps)}))


if __name__ == '__main__':
    a = sys.argv[1:]
    if not a:
        sys.exit('ears.py <id> [сцена...] | --video <файл> | --compare <дубль1> <дубль2> | --metrics <файл...>')
    if a[0] == '--metrics':
        metrics(a[1:])
        sys.exit(0)
    if a[0] == '--compare':
        lines = report_compare(a[1], a[2])
        out = os.path.join(os.path.dirname(a[2]) or '.', 'ears-compare.md')
    elif a[0] == '--video':
        lines = report_video(a[1])
        out = os.path.join(os.path.dirname(a[1]) or '.', 'ears-video.md')
    else:
        os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # по id — пути от video/, откуда бы ни запустили
        rows = scenes(a[0], a[1:])
        lines = report_scenes(a[0], rows)
        out = os.path.join('out', a[0], 'ears-report.md')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
    print('\n'.join(lines[:30]))
    print(f'→ {out}')
