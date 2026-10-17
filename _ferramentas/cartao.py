"""Gera QR (PNG) e cartão (PNG + PDF) de um trabalho em ~/Downloads.

Uso: python cartao.py <codigo> "<linha 1>" "<linha 2>" "<autores>"
Requer segno (QR) e Pillow.
"""
import sys
from pathlib import Path

import segno
from PIL import Image, ImageDraw, ImageFont

F = "/System/Library/Fonts/Supplemental/"
NAVY, MUT = (19, 48, 107), (91, 103, 130)
BASE = "https://geovime1977.github.io/enegep-2026/"

codigo, l1, l2, autores = sys.argv[1:5]
url = f"{BASE}{codigo}/"
dl = Path.home() / "Downloads"
qr_png = dl / f"QR-ENEGEP-{codigo}.png"
segno.make(url, error="h").save(qr_png, scale=24, border=2, dark="#13306b")


def f(n, s):
    return ImageFont.truetype(F + n, s)


W, H = 1240, 1754
img = Image.new("RGB", (W, H), "white")
d = ImageDraw.Draw(img)
d.rectangle([0, 0, W, 300], fill=NAVY)
d.text((W / 2, 80), f"XLVI ENEGEP 2026 · Trabalho {codigo}", font=f("Arial.ttf", 38), fill=(200, 214, 240), anchor="mm")
for i, linha in enumerate([l1, l2]):
    d.text((W / 2, 160 + i * 72), linha, font=f("Arial Bold.ttf", 60), fill="white", anchor="mm")
qr = Image.open(qr_png).convert("RGB").resize((760, 760), Image.NEAREST)
img.paste(qr, ((W - 760) // 2, 370))
y = 370 + 760 + 60
d.text((W / 2, y), "Aponte a câmera do celular", font=f("Arial Bold.ttf", 54), fill=NAVY, anchor="mm")
y += 80
for linha in ["Método em infográfico · glossário com busca", "Referencial teórico · perguntas frequentes"]:
    d.text((W / 2, y), linha, font=f("Arial.ttf", 38), fill=MUT, anchor="mm")
    y += 56
d.text((W / 2, H - 150), url.removeprefix("https://").rstrip("/"), font=f("Arial.ttf", 34), fill=MUT, anchor="mm")
d.text((W / 2, H - 90), autores, font=f("Arial.ttf", 30), fill=MUT, anchor="mm")
img.save(dl / f"QR-ENEGEP-{codigo}-cartao.png", dpi=(150, 150))
img.save(dl / f"QR-ENEGEP-{codigo}-cartao.pdf", resolution=150)
print(url)
