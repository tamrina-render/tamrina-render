"""Visual check of a track: draws points that should stay planted in the room (integrated from track.json, or the
tracked anchors) onto the clip, and writes a contact sheet. If a dot slides off its spot, the track is wrong there.
Usage: python scripts/track-check.py <clip.mp4> <track.json> <out.png> [--pin t:x:y ...] [--every 0.5]"""
import json, math, sys
import cv2
import numpy as np

W, H = 1080, 1920
src, tj, out = sys.argv[1:4]
pins, every = [], 0.5
a = sys.argv[4:]
for i, v in enumerate(a):
    if v == "--pin": t, x, y = a[i + 1].split(":"); pins.append([float(t), float(x), float(y)])
    if v == "--every": every = float(a[i + 1])
d = json.load(open(tj))
C = np.array([W / 2, H / 2])


def reel(frame):
    h, w = frame.shape[:2]
    s = max(W / w, H / h)
    f = cv2.resize(frame, (round(w * s), round(h * s)), interpolation=cv2.INTER_AREA)
    oy, ox = (f.shape[0] - H) // 2, (f.shape[1] - W) // 2
    return f[oy:oy + H, ox:ox + W]


GX = np.array(d["grid"]["xs"]) if "grid" in d else None
GY = np.array(d["grid"]["ys"]) if "grid" in d else None


def local(p, g):
    """bilinear motion of the grid at p -> (dx, dy, s)"""
    nx, ny = len(GX), len(GY)
    fx = np.clip((p[0] - GX[0]) / (GX[1] - GX[0]), 0, nx - 1.001); fy = np.clip((p[1] - GY[0]) / (GY[1] - GY[0]), 0, ny - 1.001)
    ix, iy = int(fx), int(fy); u, v = fx - ix, fy - iy
    node = lambda x, y: np.array(g[(y * nx + x) * 3:(y * nx + x) * 3 + 3])
    return (node(ix, iy) * (1 - u) + node(ix + 1, iy) * u) * (1 - v) + (node(ix, iy + 1) * (1 - u) + node(ix + 1, iy + 1) * u) * v


def step(p, f):
    if f.get("g") and GX is not None:
        m = local(p, f["g"])
        return p + m[:2]
    q = p - C
    cr, sr = math.cos(f["r"]), math.sin(f["r"])
    return f["s"] * np.array([cr * q[0] - sr * q[1], sr * q[0] + cr * q[1]]) + C + np.array([f["dx"], f["dy"]])


cap = cv2.VideoCapture(src)
fps = d["fps"]
live = {}
tiles, nxt, idx = [], 0.0, 0
while True:
    ok, fr = cap.read()
    if not ok or idx >= len(d["frames"]): break
    f = d["frames"][idx]
    t = f["t"]
    for k, p in list(live.items()): live[k] = step(p, f)
    for k, (pt, px, py) in enumerate(pins):
        if k not in live and t >= pt - 0.5 / fps: live[k] = np.array([px, py])
    img = reel(fr)
    for k, p in live.items(): cv2.circle(img, (int(p[0]), int(p[1])), 26, (0, 0, 255) if k == 0 else (255, 120, 0), -1)
    for n, tr in d.get("anchors", {}).items():
        m = [q for q in tr if abs(q["t"] - t) < 0.5 / fps]
        if m: cv2.circle(img, (int(m[0]["x"]), int(m[0]["y"])), 30, (0, 220, 0), 6)
    if t >= nxt:
        cv2.putText(img, f"{t:.1f}s", (30, 90), cv2.FONT_HERSHEY_SIMPLEX, 2.6, (0, 255, 255), 6)
        tiles.append(cv2.resize(img, (216, 384))); nxt += every
    idx += 1
cols = 8
rows = [np.hstack(tiles[i:i + cols] + [np.zeros_like(tiles[0])] * (cols - len(tiles[i:i + cols]))) for i in range(0, len(tiles), cols)]
cv2.imwrite(out, np.vstack(rows))
