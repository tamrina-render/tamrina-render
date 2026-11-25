"""Decode the data-URL files written by the Edge browser tool into JPEGs sized for the reel.

usage: python -I scripts/save-b64-images.py <slug>
Reads every <name>.b64.txt in the project root (the browser tool's output folder), writes
public/footage/<slug>/gemini/<name>.jpg (as pulled) and public/footage/<slug>/<name>.jpg (1080x1920),
then deletes the .b64.txt files. A file with no image in it is reported and left out.
"""
import base64, glob, os, re, subprocess, sys

slug = sys.argv[1]
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = os.path.join(root, "public", "footage", slug)
raw = os.path.join(out, "gemini")
os.makedirs(raw, exist_ok=True)
for f in sorted(glob.glob(os.path.join(root, "*.b64.txt"))):
    name = os.path.basename(f)[: -len(".b64.txt")]
    m = re.search(r"base64,([A-Za-z0-9+/=]+)", open(f, encoding="utf-8").read())
    if not m:
        print(name, "NO IMAGE (Gemini drew nothing; ask again with simpler words)")
    else:
        src = os.path.join(raw, name + ".jpg")
        open(src, "wb").write(base64.b64decode(m.group(1)))
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-vf",
                        "scale=1080:-1:flags=lanczos,crop=1080:1920,unsharp=5:5:0.6", "-q:v", "2",
                        os.path.join(out, name + ".jpg")], check=True)
        print(name, "ok")
    os.remove(f)
