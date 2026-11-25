"""Look at one frame of a footage scene, as it appears in the 1080x1920 reel (cover-fit, centred):
light (which side is brighter, its colour and level) and the biggest face (where the coin should look).
Usage: python scripts/footage-probe.py <frame.png>   -> JSON on stdout. Face model: scripts/models/face.tflite (MediaPipe BlazeFace)."""
import json, os, sys
import cv2
import numpy as np

W, H = 1080, 1920
img = cv2.imread(sys.argv[1])
h, w = img.shape[:2]
s = max(W / w, H / h)
img = cv2.resize(img, (round(w * s), round(h * s)), interpolation=cv2.INTER_AREA)
oy, ox = (img.shape[0] - H) // 2, (img.shape[1] - W) // 2
img = img[oy:oy + H, ox:ox + W]
rgb = img[:, :, ::-1].astype(np.float32)

# light: brightness of the left vs right half (upper 70 %, where the light sources are), mean colour, level 0..1
top = rgb[: int(H * 0.7)]
lum = top @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
left, right = float(lum[:, : W // 2].mean()), float(lum[:, W // 2:].mean())
side = max(-1.0, min(1.0, (right - left) / max(1.0, (right + left) / 2) * 3))   # -1 = light from the left
avg = rgb.reshape(-1, 3).mean(0)
col = avg / max(1.0, avg.max())                                                   # hue only, brightest channel = 1
out = {"light": {"x": round(side, 3), "color": "#%02x%02x%02x" % tuple(int(40 + 215 * c) for c in col), "level": round(float(lum.mean()) / 255, 3)}}
# plate: median saturation and brightness (0..1) and edge strength (99th percentile gradient at half size), so the
# coin can come a little toward the picture he stands in (look.match)
hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
half = cv2.resize(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), (W // 2, H // 2), interpolation=cv2.INTER_AREA).astype(np.float32)
gy, gx = np.gradient(half)
out["plate"] = {"sat": round(float(np.median(hsv[:, :, 1])) / 255, 3), "lum": round(float(np.median(lum)) / 255, 3) if lum.size else 0.5, "sharp": round(float(np.percentile(np.hypot(gx, gy), 99)), 1)}

# face: MediaPipe tasks face detector, biggest face, centre of the face box in reel px
try:
    import mediapipe as mp
    from mediapipe.tasks.python import vision, BaseOptions
    model = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models", "face.tflite")
    det = vision.FaceDetector.create_from_options(vision.FaceDetectorOptions(base_options=BaseOptions(model_asset_path=model), min_detection_confidence=0.4))
    res = det.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(img[:, :, ::-1])))
    if res.detections:
        b = max(res.detections, key=lambda d: d.bounding_box.width * d.bounding_box.height).bounding_box
        out["face"] = {"x": int(b.origin_x + b.width / 2), "y": int(b.origin_y + b.height * 0.45), "w": int(b.width)}
except Exception as e:  # no face model / mediapipe: the coin just keeps its own gaze
    out["faceError"] = str(e)[:120]
print(json.dumps(out))
