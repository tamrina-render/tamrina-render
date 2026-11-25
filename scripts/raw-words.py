# Speech-to-text with word times for a raw take (free, local, faster_whisper).
#   python -I scripts/raw-words.py <clip> <out.json> [--lang ar] [--model small]
# Writes { "words": [{w,start,end}], "segments": [{text,start,end}] }. Skips when out.json is newer than the clip.
import json, os, sys

args = sys.argv[1:]
def opt(name, default):
    return args[args.index("--" + name) + 1] if "--" + name in args else default
pos = [a for i, a in enumerate(args) if not a.startswith("--") and (i == 0 or not args[i - 1].startswith("--"))]
if len(pos) < 2:
    sys.exit("usage: python -I scripts/raw-words.py <clip> <out.json> [--lang ar] [--model small]")
clip, out = pos[0], pos[1]
lang, model_name = opt("lang", "ar"), opt("model", "small")

if os.path.exists(out) and os.path.getmtime(out) > os.path.getmtime(clip):
    print(f"cached: {out}")
    sys.exit(0)

import subprocess
import numpy as np
from faster_whisper import WhisperModel
# decode with ffmpeg ourselves (the installed PyAV is too old for faster_whisper's own decoder): 16 kHz mono float32
pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", clip, "-vn", "-ac", "1", "-ar", "16000", "-f", "s16le", "-"],
                     capture_output=True, check=True).stdout
audio = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768.0
model = WhisperModel(model_name, device="cpu", compute_type="int8")
# vad ON: without it whisper skips a sentence that follows a long silence and repeats an earlier one (measured on a retake);
# faster_whisper maps the word times back to the original timeline. No previous-text conditioning so a repeated sentence is not "fixed".
segs, _ = model.transcribe(audio, language=lang, word_timestamps=True, vad_filter=True,
                           vad_parameters={"min_silence_duration_ms": 300},
                           condition_on_previous_text=False, beam_size=5)
words, segments = [], []
for s in segs:
    segments.append({"text": s.text.strip(), "start": round(s.start, 3), "end": round(s.end, 3)})
    for w in s.words or []:
        t = w.word.strip()
        if t:
            words.append({"w": t, "start": round(w.start, 3), "end": round(w.end, 3)})
os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
with open(out, "w", encoding="utf-8") as f:
    json.dump({"words": words, "segments": segments}, f, ensure_ascii=False, indent=1)
print(f"{len(words)} words, {len(segments)} segments -> {out}")
