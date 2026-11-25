"""Draw a big cartoon hex dumbbell (ink outline, toon shading like the coins) lying on the floor of a set photo.

python scripts/floor-dumbbell.py <in.jpg> <out.jpg> --x 560 --y 1400 --len 340 [--label "50 KG"]
x,y = centre of the dumbbell's floor contact (px of the 1080x1920 photo), len = full length in px.
The photo is a still, so the dumbbell stays planted. Keep the clean photo (in) and write a new one (out).
"""
import argparse, os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ap = argparse.ArgumentParser()
ap.add_argument("src"); ap.add_argument("dst")
ap.add_argument("--x", type=float, default=540); ap.add_argument("--y", type=float, default=1400)
ap.add_argument("--len", type=float, default=340); ap.add_argument("--label", default="50 KG")
a = ap.parse_args()

S = 4  # supersample
L = a.len * S
headW, headH = L * 0.27, L * 0.46          # each head (side view of a hex block)
handleH = headH * 0.22
W, H = int(L + 40 * S), int(headH + 80 * S)
img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
ink = (22, 22, 26, 255); ow = int(5 * S)
x0, cy = 20 * S, 20 * S + headH / 2

# handle: chrome cylinder with knurl lines
hx0, hx1 = x0 + headW * 0.9, x0 + L - headW * 0.9
d.rounded_rectangle([hx0, cy - handleH / 2, hx1, cy + handleH / 2], radius=handleH / 2, fill=(178, 184, 192, 255), outline=ink, width=ow)
d.rectangle([hx0 + ow, cy - handleH * 0.32, hx1 - ow, cy - handleH * 0.12], fill=(236, 240, 244, 255))
for i in range(1, 9):
    gx = hx0 + (hx1 - hx0) * (0.3 + 0.4 * i / 9)
    d.line([gx, cy - handleH * 0.05, gx, cy + handleH * 0.4], fill=(120, 126, 134, 255), width=int(1.5 * S))

def head(xl):
    # a hex block seen from the side = three bands: light top facet, main face, dark bottom facet
    r = headH * 0.12
    d.rounded_rectangle([xl, cy - headH / 2, xl + headW, cy + headH / 2], radius=r, fill=(52, 54, 60, 255))
    d.rectangle([xl + ow, cy - headH / 2 + r * 0.6, xl + headW - ow, cy - headH * 0.26], fill=(92, 96, 104, 255))
    d.rectangle([xl + ow, cy + headH * 0.26, xl + headW - ow, cy + headH / 2 - r * 0.6], fill=(34, 35, 40, 255))
    d.line([xl + headW * 0.18, cy - headH * 0.4, xl + headW * 0.18, cy - headH * 0.3], fill=(150, 154, 162, 255), width=int(3 * S))
    d.rounded_rectangle([xl, cy - headH / 2, xl + headW, cy + headH / 2], radius=r, outline=ink, width=ow)

head(x0); head(x0 + L - headW)

# label across the left head's main face, vertical like a real hex dumbbell's number plate
font = ImageFont.truetype(os.path.join(os.path.dirname(__file__), "..", "public", "fonts", "Manrope.ttf"), int(headW * 0.42))
try: font.set_variation_by_name("ExtraBold")
except Exception: pass
for xl in (x0, x0 + L - headW):
    t = Image.new("RGBA", (int(headH * 0.9), int(headW)), (0, 0, 0, 0))
    td = ImageDraw.Draw(t)
    td.text((t.width / 2, t.height / 2), a.label, font=font, fill=(255, 255, 255, 255), anchor="mm", stroke_width=int(1 * S), stroke_fill=(255, 255, 255, 255))
    t = t.rotate(90, expand=True)
    img.alpha_composite(t, (int(xl + headW / 2 - t.width / 2), int(cy - t.height / 2)))

img = img.resize((W // S, H // S), Image.LANCZOS)
bg = Image.open(a.src).convert("RGBA")
px, py = int(a.x - img.width / 2), int(a.y - (20 + headH / S / 2) - headH / S / 2)
# soft contact shadow under it
sh = Image.new("RGBA", bg.size, (0, 0, 0, 0))
ImageDraw.Draw(sh).ellipse([a.x - a.len * 0.55, a.y - a.len * 0.05, a.x + a.len * 0.55, a.y + a.len * 0.07], fill=(0, 0, 0, 120))
bg.alpha_composite(sh.filter(ImageFilter.GaussianBlur(a.len * 0.04)))
bg.alpha_composite(img, (px, py))
bg.convert("RGB").save(a.dst, quality=93)
print(a.dst)
