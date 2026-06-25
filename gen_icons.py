#!/usr/bin/env python3
"""Génère les icônes PWA MOON-RZ (lune violette sur fond nuit)."""
from PIL import Image, ImageDraw, ImageFilter

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

def make_icon(size, moon_frac, rounded=False):
    S = size * 4  # super-sampling pour des bords nets
    base = Image.new("RGBA", (S, S), (0, 0, 0, 255))
    d = ImageDraw.Draw(base)
    # fond dégradé nuit (haut violet -> bas presque noir)
    top, bot = (29, 21, 66), (10, 10, 20)
    for y in range(S):
        d.line([(0, y), (S, y)], fill=lerp(top, bot, y / S) + (255,))

    cx = cy = S / 2
    R = S * moon_frac / 2

    # halo lumineux (cercle flou)
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gr = R * 1.25
    gd.ellipse([cx - gr, cy - gr, cx + gr, cy + gr], fill=(124, 92, 240, 170))
    glow = glow.filter(ImageFilter.GaussianBlur(S * 0.05))
    base = Image.alpha_composite(base, glow)

    # disque lune : dégradé radial (centre blanc -> bord violet)
    moon = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    md = ImageDraw.Draw(moon)
    edge, mid, center = (124, 92, 240), (167, 139, 250), (255, 255, 255)
    steps = int(R)
    for i in range(steps, 0, -1):
        t = i / steps  # 1 au bord, 0 au centre
        c = lerp(mid, edge, (t - 0.5) * 2) if t > 0.5 else lerp(center, mid, t * 2)
        r = R * t
        md.ellipse([cx - r, cy - r, cx + r, cy + r], fill=c + (255,))
    base = Image.alpha_composite(base, moon)

    # cratères (cercles sombres légèrement flous)
    crat = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    cd = ImageDraw.Draw(crat)
    for dx, dy, cr in [(0.30, -0.20, 0.14), (-0.20, 0.28, 0.10), (0.08, 0.34, 0.07)]:
        ccx, ccy, rr = cx + dx * R, cy + dy * R, cr * R
        cd.ellipse([ccx - rr, ccy - rr, ccx + rr, ccy + rr], fill=(12, 10, 28, 80))
    crat = crat.filter(ImageFilter.GaussianBlur(S * 0.004))
    base = Image.alpha_composite(base, crat)

    img = base.resize((size, size), Image.LANCZOS)

    if rounded:  # coins arrondis (apple-touch n'aime pas le carré pur)
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, size, size], radius=int(size * 0.22), fill=255)
        out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        out.paste(img, (0, 0), mask)
        img = out
    return img

# icônes "any" (contenu plein cadre)
make_icon(192, 0.66).save("icon-192.png")
make_icon(512, 0.66).save("icon-512.png")
# maskable : lune plus petite dans la zone de sécurité (~60%)
make_icon(512, 0.52).save("icon-maskable-512.png")
# apple-touch (iOS) : 180px, coins arrondis
make_icon(180, 0.66, rounded=True).save("apple-touch-icon.png")
# favicon
make_icon(64, 0.74).save("favicon.png")
print("OK: icônes générées")
