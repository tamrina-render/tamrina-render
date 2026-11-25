"""Camera tracking for a handheld footage clip, as it appears in the 1080x1920 reel (cover-fit, centred).

For every frame: how the picture moved since the previous frame (a similarity: shift, zoom, roll), measured from
hundreds of tracked corners (Lucas-Kanade optical flow + RANSAC), so the coin can stay planted in the room while the
phone moves. Optional named anchors (a point on the bed, the floor by the door...) are tracked locally the same way.

Usage: python scripts/track.py <clip.mp4> [--anchor name:t:x:y ...] [--from s] [--to s] > track.json
  x, y in reel px (1080 x 1920) at time t (seconds into the clip). Output (reel px, per frame at the clip's fps):
  { fps, frames: [{t, dx, dy, s, r, ok, inl, g}], grid: {xs, ys}, anchors: {name: [{t, x, y, s}]} }
  g = LOCAL motion on a grid (flat [dx, dy, s] per node, row by row): near things (the floor under your feet) move much
  more than the far walls when you walk (parallax), so the coin's feet must follow the patch they stand on, not the
  average of the picture.
  dx, dy, s, r = the motion of the picture from the previous frame (centre-based: p' = s R(r) (p - c) + c + (dx, dy)).
"""
import json, math, sys
import cv2
import numpy as np

W, H = 1080, 1920
args = sys.argv[1:]
src = args[0]
anchors_in = []
t_from, t_to = 0.0, 1e9
i = 1
while i < len(args):
    if args[i] == "--anchor": n, t, x, y = args[i + 1].split(":"); anchors_in.append((n, float(t), float(x), float(y))); i += 2
    elif args[i] == "--from": t_from = float(args[i + 1]); i += 2
    elif args[i] == "--to": t_to = float(args[i + 1]); i += 2
    else: i += 1

cap = cv2.VideoCapture(src)
fps = cap.get(cv2.CAP_PROP_FPS) or 30


def reel(frame):
    """the frame as the reel shows it: cover-fit into 1080x1920, centred (OpenCV already applies the phone rotation)"""
    h, w = frame.shape[:2]
    s = max(W / w, H / h)
    f = cv2.resize(frame, (round(w * s), round(h * s)), interpolation=cv2.INTER_AREA)
    oy, ox = (f.shape[0] - H) // 2, (f.shape[1] - W) // 2
    return f[oy:oy + H, ox:ox + W]


# work at half size (speed), report in reel px
K = 0.5
C = np.array([W / 2, H / 2])
GX = np.linspace(60, W - 60, 9)
GY = np.linspace(80, H - 80, 16)
frames, prev, prev_pts = [], None, None
anchors = {n: [] for n, *_ in anchors_in}
apos = {}  # anchor name -> current (x, y, s) in reel px, once started
idx = 0
while True:
    okr, fr = cap.read()
    if not okr: break
    t = idx / fps
    idx += 1
    if t < t_from - 1e-6 or t > t_to + 1e-6: continue
    g = cv2.cvtColor(cv2.resize(reel(fr), (int(W * K), int(H * K))), cv2.COLOR_BGR2GRAY)
    rec = {"t": round(t, 4), "dx": 0.0, "dy": 0.0, "s": 1.0, "r": 0.0, "ok": True, "inl": 0}
    if prev is not None and prev_pts is not None and len(prev_pts) >= 12:
        nxt, st, _ = cv2.calcOpticalFlowPyrLK(prev, g, prev_pts, None, winSize=(25, 25), maxLevel=4,
                                               criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 30, 0.01))
        good = st.reshape(-1) == 1
        a, b = prev_pts.reshape(-1, 2)[good] / K, nxt.reshape(-1, 2)[good] / K
        if len(a) >= 12:
            M, inl = cv2.estimateAffinePartial2D(a - C, b - C, method=cv2.RANSAC, ransacReprojThreshold=3.0, maxIters=3000, confidence=0.995)
            if M is not None:
                s = math.hypot(M[0, 0], M[1, 0]); r = math.atan2(M[1, 0], M[0, 0])
                rec.update(dx=float(M[0, 2]), dy=float(M[1, 2]), s=float(s), r=float(r), inl=int(inl.sum()))
                rec["ok"] = rec["inl"] >= 20 and 0.85 < s < 1.18
                # local motion per grid node: the nearest tracked corners (robust fit), else the global motion
                grid = []
                cr, sr = math.cos(r), math.sin(r)
                for gy in GY:
                    for gx in GX:
                        d2 = (a[:, 0] - gx) ** 2 + (a[:, 1] - gy) ** 2
                        idxs = np.argsort(d2)[:16]
                        idxs = idxs[d2[idxs] < 300 ** 2]
                        Ml = None
                        if len(idxs) >= 8:
                            node = np.array([gx, gy])
                            Ml, _ = cv2.estimateAffinePartial2D(a[idxs] - node, b[idxs] - node, method=cv2.LMEDS)
                        if Ml is not None:
                            grid += [round(float(Ml[0, 2]), 2), round(float(Ml[1, 2]), 2), round(float(math.hypot(Ml[0, 0], Ml[1, 0])), 4)]
                        else:
                            q = np.array([gx, gy]) - C
                            p2 = s * np.array([cr * q[0] - sr * q[1], sr * q[0] + cr * q[1]]) + C + M[:, 2]
                            grid += [round(float(p2[0] - gx), 2), round(float(p2[1] - gy), 2), round(float(s), 4)]
                rec["g"] = grid
        # anchors: local tracking (points within 220 px) so an object moves with its own surface, not the whole picture
        for n, (ax, ay, asc) in list(apos.items()):
            near = np.hypot(a[:, 0] - ax, a[:, 1] - ay) < 220
            if near.sum() >= 8:
                Ml, inl2 = cv2.estimateAffinePartial2D(a[near], b[near], method=cv2.RANSAC, ransacReprojThreshold=3.0)
                if Ml is not None:
                    p = Ml @ np.array([ax, ay, 1.0]); sl = math.hypot(Ml[0, 0], Ml[1, 0])
                    apos[n] = (float(p[0]), float(p[1]), asc * sl); anchors[n].append({"t": rec["t"], "x": round(apos[n][0], 1), "y": round(apos[n][1], 1), "s": round(apos[n][2], 4), "local": True})
                    continue
            # too few points near it: follow the whole picture
            p = np.array([ax, ay]) - C
            cr, sr = math.cos(rec["r"]), math.sin(rec["r"])
            q = rec["s"] * np.array([cr * p[0] - sr * p[1], sr * p[0] + cr * p[1]]) + C + np.array([rec["dx"], rec["dy"]])
            apos[n] = (float(q[0]), float(q[1]), asc * rec["s"])
            anchors[n].append({"t": rec["t"], "x": round(apos[n][0], 1), "y": round(apos[n][1], 1), "s": round(apos[n][2], 4), "local": False})
    # anchors that start at this frame
    for n, at, ax, ay in anchors_in:
        if n not in apos and t >= at - 0.5 / fps:
            apos[n] = (ax, ay, 1.0); anchors[n].append({"t": rec["t"], "x": ax, "y": ay, "s": 1.0, "local": True})
    frames.append({k: (round(v, 5) if isinstance(v, float) else v) for k, v in rec.items()})
    # refresh the corners every frame (the picture keeps changing as the phone moves)
    prev = g
    prev_pts = cv2.goodFeaturesToTrack(g, maxCorners=600, qualityLevel=0.01, minDistance=8, blockSize=7)

json.dump({"src": src, "fps": fps, "w": W, "h": H, "grid": {"xs": GX.tolist(), "ys": GY.tolist()}, "frames": frames, "anchors": anchors}, sys.stdout)
