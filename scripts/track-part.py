"""Track one MOVING part of a clip (a leg-press plate, a swing, a door) frame by frame, for the coin to ride on it.

track.py follows the camera (and its anchors drift when the part moves against a still background); this follows the
part itself: template matching of a box around it, searched in a band around its last spot, smoothed.

Usage: python -I scripts/track-part.py <clip.mp4> <name> <x> <y> [--box 400x200] [--t 0] [--axis y|xy] > part.json
  x, y = the point to ride (reel px, 1080x1920 cover-fit) at clip time t; the box is centred on it.
  --axis y = the part only moves up / down (x stays fixed): steadier for machines on rails.
  --hsv h1,h2,smin = follow a COLOURED part instead (OpenCV hue 0-180, e.g. 18,40,90 = yellow pedal pads): the blob of that
  colour nearest to its last spot (two look-alike parts, like two pedals, keep their own identity). Template mode otherwise.
Output: {"anchors": {name: [{t, x, y, s: 1, local: true}, ...]}} -> script companion "anchorsFile" (merged by make.mjs).
"""
import sys, json
import cv2
import numpy as np

W, H = 1080, 1920
a = sys.argv[1:]
src, name, X, Y = a[0], a[1], float(a[2]), float(a[3])
bw, bh, t0, axis, hsv = 400, 200, 0.0, "y", None
i = 4
while i < len(a):
    if a[i] == "--box": bw, bh = (int(v) for v in a[i + 1].split("x")); i += 2
    elif a[i] == "--t": t0 = float(a[i + 1]); i += 2
    elif a[i] == "--axis": axis = a[i + 1]; i += 2
    elif a[i] == "--hsv": hsv = [int(v) for v in a[i + 1].split(",")]; i += 2
    else: i += 1


def reel(f):
    h, w = f.shape[:2]
    s = max(W / w, H / h)
    f = cv2.resize(f, (round(w * s), round(h * s)), interpolation=cv2.INTER_AREA)
    oy, ox = (f.shape[0] - H) // 2, (f.shape[1] - W) // 2
    f = f[oy:oy + H, ox:ox + W]
    if hsv:  # mask of the part's colour
        m = cv2.inRange(cv2.cvtColor(f, cv2.COLOR_BGR2HSV), (hsv[0], hsv[2], 70), (hsv[1], 255, 255))
        return cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    return cv2.cvtColor(f, cv2.COLOR_BGR2GRAY)


cap = cv2.VideoCapture(src)
fps = cap.get(cv2.CAP_PROP_FPS) or 30
frames = []
while True:
    ok, f = cap.read()
    if not ok: break
    frames.append(reel(f))
k0 = min(len(frames) - 1, round(t0 * fps))
x0, y0 = int(X - bw / 2), int(Y - bh / 2)
tpl = frames[k0][y0:y0 + bh, x0:x0 + bw]
pos = {k0: (X, Y)}


def run_hsv(order):
    cx, cy = X, Y
    for k in order:
        n, lab, st, cen = cv2.connectedComponentsWithStats(frames[k])
        best = None
        for j in range(1, n):
            if st[j, cv2.CC_STAT_AREA] < 150: continue
            d = np.hypot(cen[j][0] - cx, cen[j][1] - cy)
            if d < 260 and (best is None or d < best[0]): best = (d, cen[j])
        if best is not None: cx, cy = float(best[1][0]), float(best[1][1])
        pos[k] = (cx, cy)


def run(order):
    if hsv: return run_hsv(order)
    cx, cy = X, Y
    for k in order:
        g = frames[k]
        mx = 40 if axis == "y" else 160
        sx0, sy0 = int(max(0, cx - bw / 2 - mx)), int(max(0, cy - bh / 2 - 160))
        sx1, sy1 = int(min(W, cx + bw / 2 + mx)), int(min(H, cy + bh / 2 + 160))
        r = cv2.matchTemplate(g[sy0:sy1, sx0:sx1], tpl, cv2.TM_CCOEFF_NORMED)
        _, m, _, loc = cv2.minMaxLoc(r)
        if m > 0.5:
            nx, ny = sx0 + loc[0] + bw / 2, sy0 + loc[1] + bh / 2
            cx, cy = (X if axis == "y" else nx), ny
        pos[k] = (cx, cy)


run(range(k0 + 1, len(frames)))
run(range(k0 - 1, -1, -1))
ks = sorted(pos)
xs = np.array([pos[k][0] for k in ks]); ys = np.array([pos[k][1] for k in ks])
ker = np.ones(5) / 5  # light smoothing (a 1-frame wobble would show as a jitter under him)
pad = lambda v: np.convolve(np.pad(v, 2, mode="edge"), ker, mode="valid")
xs, ys = pad(xs), pad(ys)
out = [{"t": round(k / fps, 4), "x": round(float(x), 1), "y": round(float(y), 1), "s": 1, "local": True} for k, x, y in zip(ks, xs, ys)]
json.dump({"anchors": {name: out}}, sys.stdout)
