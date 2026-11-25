"""Voice pitch (f0, Hz) per video frame, for the human layer (src/lib/human.ts): the head tilts with the voice
and the gesture strokes land on the loud + high syllables. numpy only (no librosa), ~1 s for a 30 s voice.

usage: python -I scripts/pitch.py <audio> <fps>  -> prints JSON {"fps": fps, "f0": [Hz or 0 when unvoiced, ...]}
Method: normalised autocorrelation (a light YIN) on a 40 ms window at 16 kHz, 70-400 Hz, voiced when the peak > 0.45
and the window is not silent.
"""
import json
import subprocess
import sys

import numpy as np

src, fps = sys.argv[1], float(sys.argv[2])
SR = 16000
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", src, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                     capture_output=True, check=True).stdout
x = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
hop, win = SR / fps, int(0.04 * SR)
lo, hi = int(SR / 400), int(SR / 70)
n = int(len(x) / hop)
rms_all = np.sqrt(np.mean(x ** 2)) if len(x) else 0.0
f0 = []
for i in range(n):
    c = int(i * hop + hop / 2)
    seg = x[max(0, c - win // 2): c + win // 2]
    if len(seg) < win or np.sqrt(np.mean(seg ** 2)) < 0.25 * rms_all:
        f0.append(0); continue
    seg = seg - seg.mean()
    ac = np.correlate(seg, seg, "full")[win - 1:]
    if ac[0] <= 0:
        f0.append(0); continue
    ac = ac / ac[0]
    lag = lo + int(np.argmax(ac[lo:hi]))
    if ac[lag] < 0.45:
        f0.append(0); continue
    # parabolic refinement of the peak
    if 0 < lag < len(ac) - 1:
        a, b, g = ac[lag - 1], ac[lag], ac[lag + 1]
        d = 0.5 * (a - g) / (a - 2 * b + g) if (a - 2 * b + g) != 0 else 0
    else:
        d = 0
    f0.append(round(SR / (lag + d), 1))
print(json.dumps({"fps": fps, "f0": f0}))
