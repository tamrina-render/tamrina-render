"""Motion capture from a video (phase 2 of the human motion, 2026-11-08): MediaPipe pose, free and local.

usage:
  python -I scripts/mocap.py <clip.mp4> <out.json> [--people 2] [--sheet out.png]

Writes the body landmarks of the N main people, per video frame, in image fractions (0..1):
  {"fps", "w", "h", "n", "keys": [...], "people": [{"id", "x" (median x), "frames": [null | [[x, y, z, vis], ...]]}]}
people are sorted left to right by their median x, so a script says "person": "left" / "right" / 0 / 1.
MediaPipe does not keep identities between frames: each detection joins the track whose torso centre is nearest
(< 0.15 of the frame), so two people who don't cross keep their ids. Posters / background people are dropped: the N
tracks kept are the ones seen longest x biggest. --sheet draws the skeletons + ids on 12 frames: LOOK at it before
using the data (a wrong identity = the wrong coin copies the wrong person).
Models (one-time download, free): tools/mediapipe/pose_landmarker_full.task (see guides/motion.md "Mocap").
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import mediapipe as mp
from mediapipe.tasks.python import BaseOptions, vision

ROOT = Path(__file__).resolve().parent.parent
MODEL = ROOT / "tools" / "mediapipe" / "pose_landmarker_full.task"
# MediaPipe pose indices kept (image-left/right is decided later by x, not by these names)
KEYS = {"nose": 0, "eyeL": 2, "eyeR": 5, "earL": 7, "earR": 8, "shL": 11, "shR": 12, "elL": 13, "elR": 14,
        "wrL": 15, "wrR": 16, "piL": 17, "piR": 18, "inL": 19, "inR": 20, "hipL": 23, "hipR": 24}
NAMES = list(KEYS)
BONES = [("shL", "shR"), ("shL", "elL"), ("elL", "wrL"), ("shR", "elR"), ("elR", "wrR"), ("shL", "hipL"), ("shR", "hipR"),
         ("hipL", "hipR"), ("wrL", "inL"), ("wrR", "inR"), ("earL", "eyeL"), ("eyeL", "nose"), ("nose", "eyeR"), ("eyeR", "earR")]

ap = argparse.ArgumentParser()
ap.add_argument("clip"); ap.add_argument("out")
ap.add_argument("--people", type=int, default=2)
ap.add_argument("--sheet", default=None)
a = ap.parse_args()
if not MODEL.exists():
    sys.exit(f"missing {MODEL}: download pose_landmarker_full.task (see guides/motion.md 'Mocap')")

probe = json.loads(subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v", "-show_entries", "stream=width,height,r_frame_rate",
                                   "-of", "json", a.clip], capture_output=True, check=True).stdout)["streams"][0]
W, H = int(probe["width"]), int(probe["height"])
num, den = probe["r_frame_rate"].split("/"); fps = float(num) / float(den)
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", a.clip, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
n = len(raw) // (W * H * 3)
frames = np.frombuffer(raw, np.uint8)[: n * W * H * 3].reshape(n, H, W, 3)

pl = vision.PoseLandmarker.create_from_options(vision.PoseLandmarkerOptions(
    base_options=BaseOptions(model_asset_path=str(MODEL)), running_mode=vision.RunningMode.VIDEO,
    num_poses=a.people + 1, min_pose_detection_confidence=0.4, min_tracking_confidence=0.4))

def centre(p):
    pts = [p[KEYS[k]] for k in ("shL", "shR", "hipL", "hipR")]
    return np.array([np.mean([q.x for q in pts]), np.mean([q.y for q in pts])])

def size(p):
    sh = np.array([(p[11].x + p[12].x) / 2, (p[11].y + p[12].y) / 2]); hp = np.array([(p[23].x + p[24].x) / 2, (p[23].y + p[24].y) / 2])
    return float(np.linalg.norm(sh - hp))

tracks = []  # {"c": centre, "last": frame, "frames": {i: lm}, "size": [..]}
for i in range(n):
    r = pl.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(frames[i])), int(round(i * 1000 / fps)))
    dets = [(centre(p), p) for p in r.pose_landmarks]
    used = set()
    # greedy: closest (track, detection) pairs first
    pairs = sorted(((np.linalg.norm(t["c"] - c), ti, di) for ti, t in enumerate(tracks) if i - t["last"] <= 15 for di, (c, _) in enumerate(dets)))
    taken_t = set()
    for d, ti, di in pairs:
        if d > 0.15 or ti in taken_t or di in used:
            continue
        t = tracks[ti]; c, p = dets[di]
        t["c"], t["last"] = c, i; t["frames"][i] = p; t["size"].append(size(p))
        taken_t.add(ti); used.add(di)
    for di, (c, p) in enumerate(dets):
        if di not in used:
            tracks.append({"c": c, "last": i, "frames": {i: p}, "size": [size(p)]})

score = lambda t: len(t["frames"]) * float(np.median(t["size"]))
keep = sorted(tracks, key=score, reverse=True)[: a.people]
for t in keep:
    t["x"] = float(np.median([centre(p)[0] for p in t["frames"].values()]))
keep.sort(key=lambda t: t["x"])
out = {"fps": fps, "w": W, "h": H, "n": n, "keys": NAMES, "people": []}
for k, t in enumerate(keep):
    fr = []
    for i in range(n):
        p = t["frames"].get(i)
        fr.append(None if p is None else [[round(p[KEYS[nm]].x, 4), round(p[KEYS[nm]].y, 4), round(p[KEYS[nm]].z, 4), round(p[KEYS[nm]].visibility, 2)] for nm in NAMES])
    out["people"].append({"id": k, "x": round(t["x"], 3), "seen": round(len(t["frames"]) / n, 2), "frames": fr})
Path(a.out).parent.mkdir(parents=True, exist_ok=True)
Path(a.out).write_text(json.dumps(out, separators=(",", ":")))
print(f"mocap: {n} frames, {len(tracks)} tracks found, kept {len(keep)}: " + ", ".join(f"#{p['id']} x={p['x']} seen {p['seen']*100:.0f}%" for p in out["people"]))

if a.sheet:
    import cv2
    cols = [(255, 80, 80), (80, 200, 255), (120, 255, 120)]
    picks = np.linspace(0, n - 1, 12).astype(int)
    tiles = []
    for i in picks:
        im = np.ascontiguousarray(frames[i][:, :, ::-1])
        for k, pp in enumerate(out["people"]):
            f = pp["frames"][i]
            if not f:
                continue
            P = {nm: (int(v[0] * W), int(v[1] * H)) for nm, v in zip(NAMES, f)}
            for b0, b1 in BONES:
                cv2.line(im, P[b0], P[b1], cols[k % 3], 4)
            for nm in ("wrL", "wrR"):
                cv2.circle(im, P[nm], 10, cols[k % 3], -1)
            cv2.putText(im, f"#{k}", (P["nose"][0] - 20, P["nose"][1] - 30), cv2.FONT_HERSHEY_SIMPLEX, 1.6, cols[k % 3], 4)
        cv2.putText(im, f"{i / fps:.1f}s", (20, 60), cv2.FONT_HERSHEY_SIMPLEX, 1.8, (255, 255, 255), 4)
        tiles.append(cv2.resize(im, (W // 3, H // 3)))
    rows = [np.hstack(tiles[r * 6:(r + 1) * 6]) for r in range(2)]
    cv2.imwrite(a.sheet, np.vstack(rows))
    print(f"sheet -> {a.sheet}")
