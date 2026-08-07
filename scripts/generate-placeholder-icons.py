#!/usr/bin/env python3
"""
Generate placeholder PWA icons.

No Brill Ops brand assets were supplied with the handoff, but manifest.webmanifest
has to point at real files or "Add to Home Screen" produces a broken icon. This
draws a plain "BO" monogram on the site's ink colour so the install flow works.

Delete this script once real branding exists. See public/icons/README.md.

    python3 scripts/generate-placeholder-icons.py
"""

import os
from PIL import Image, ImageDraw, ImageFont

INK = (15, 23, 42)      # tailwind.config.ts -> colors.ink.DEFAULT
WHITE = (255, 255, 255)
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "icons")

FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
]


def font_for(px):
    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            return ImageFont.truetype(path, px)
    return ImageFont.load_default()


def monogram(size, out, safe_ratio=1.0):
    """safe_ratio < 1 shrinks the glyph so a maskable icon survives Android's
    circular crop, which can clip roughly 20% off each edge."""
    img = Image.new("RGB", (size, size), INK)
    d = ImageDraw.Draw(img)
    f = font_for(int(size * 0.42 * safe_ratio))
    box = d.textbbox((0, 0), "BO", font=f)
    d.text(
        ((size - (box[2] - box[0])) / 2 - box[0],
         (size - (box[3] - box[1])) / 2 - box[1]),
        "BO", font=f, fill=WHITE,
    )
    img.save(out)
    print(f"wrote {out} ({size}x{size})")


if __name__ == "__main__":
    os.makedirs(OUT_DIR, exist_ok=True)
    monogram(192, os.path.join(OUT_DIR, "icon-192.png"))
    monogram(512, os.path.join(OUT_DIR, "icon-512.png"))
    monogram(512, os.path.join(OUT_DIR, "icon-maskable-512.png"), safe_ratio=0.72)
