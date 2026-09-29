# Время каждого слова в записях голоса — локально, без облака (faster-whisper). Вызывается из vo-align.mjs.
#   video/.venv-vo/Scripts/python scripts/vo-words.py <задания.json> [--model small]
# задания: [{"audio": "...mp3", "out": "...words.json", "hint": "текст, который читал диктор"}] — модель грузится один раз.
# hint подсказывает распознаванию имена карт и колод. Установка один раз:
#   python -m venv .venv-vo && .venv-vo/Scripts/python -m pip install faster-whisper
import json
import re
import sys

from faster_whisper import WhisperModel

jobs = json.load(open(sys.argv[1], encoding='utf-8'))
model_name = sys.argv[sys.argv.index('--model') + 1] if '--model' in sys.argv else 'small'
model = WhisperModel(model_name, device='cpu', compute_type='int8')

for job in jobs:
    hint = re.sub(r'\[[^\]]*\]', ' ', job.get('hint', ''))
    names = sorted({w for w in re.findall(r'[А-ЯЁ][а-яё\'-]+', hint)})
    prompt = ', '.join(names)[:600]
    segments, info = model.transcribe(job['audio'], language='ru', word_timestamps=True, initial_prompt=prompt or None, beam_size=5)
    words = [{'text': w.word.strip(), 'start': round(w.start, 3), 'end': round(w.end, 3), 'p': round(w.probability, 3)} for s in segments for w in s.words]
    json.dump({'words': words, 'duration': info.duration}, open(job['out'], 'w', encoding='utf-8'), ensure_ascii=False)
    print(f"{job['out']}: {len(words)} слов, {info.duration:.1f} с", flush=True)
