"""Gera a imagem de prévia (og.png, 1200x630) de cada trabalho.

Uso: python og.py <pasta-do-trabalho> "<linha 1>" "<linha 2>" "<subtítulo>"
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

F = "/System/Library/Fonts/Supplemental/"
NAVY, CLARO = (19, 48, 107), (200, 214, 240)

pasta, l1, l2, sub = Path(sys.argv[1]), sys.argv[2], sys.argv[3], sys.argv[4]
img = Image.new("RGB", (1200, 630), NAVY)
d = ImageDraw.Draw(img)
d.text((80, 90), f"XLVI ENEGEP 2026 · Trabalho {pasta.name}", font=ImageFont.truetype(F + "Arial.ttf", 34), fill=CLARO)
grande = ImageFont.truetype(F + "Arial Bold.ttf", 66)
d.text((80, 190), l1, font=grande, fill="white")
d.text((80, 275), l2, font=grande, fill="white")
d.text((80, 410), sub, font=ImageFont.truetype(F + "Arial.ttf", 36), fill=CLARO)
d.text((80, 530), "Geovane Virmecati · José Bezerra da Silva Filho", font=ImageFont.truetype(F + "Arial.ttf", 30), fill=CLARO)
img.save(pasta / "og.png", optimize=True)
print(pasta / "og.png")
