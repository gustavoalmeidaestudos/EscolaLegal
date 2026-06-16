"""Gera QR-CODE/qr-ficha-cadastral-card.png — cartão quadrado dourado com QR e texto."""
from pathlib import Path

import qrcode
from PIL import Image, ImageDraw, ImageFont

OUT_CARD = Path(__file__).resolve().parent.parent / "QR-CODE" / "qr-ficha-cadastral-card.png"
OUT_QR = Path(__file__).resolve().parent.parent / "QR-CODE" / "qr-ficha-cadastral.png"
URL = "https://escolalegal.vercel.app/ficha-cadastral"

CARD = 900
QR_SIZE = 340
RADIUS = 36

GOLD = "#C5943E"
GOLD_LIGHT = "#E6C277"
GOLD_DARK = "#A67A2E"
NAVY = "#001D3D"
CREAM = "#FAF9F6"
CREAM_DARK = "#F3EDE4"
WHITE = "#FFFFFF"

TITLE = "Escaneie o Código QR para\nrealizar o cadastro no Grupo VIP"
BADGE = "GRUPO VIP"
SUB = "Deliane Santos · Advocacia Educacional"


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def load_font(size, bold=False):
    candidates = [
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def draw_rounded_rect(draw, box, radius, fill=None, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def make_qr():
    qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=10, border=1)
    qr.add_data(URL)
    qr.make(fit=True)
    img = qr.make_image(fill_color=NAVY, back_color=WHITE).convert("RGB")
    return img.resize((QR_SIZE, QR_SIZE), Image.Resampling.NEAREST)


def wrap_text(draw, text, font, max_width):
    lines = []
    for paragraph in text.split("\n"):
        words = paragraph.split()
        if not words:
            lines.append("")
            continue
        current = words[0]
        for word in words[1:]:
            test = f"{current} {word}"
            if draw.textlength(test, font=font) <= max_width:
                current = test
            else:
                lines.append(current)
                current = word
        lines.append(current)
    return lines


def main():
    qr_img = make_qr()
    qr_img.save(OUT_QR, "PNG", optimize=True)

    img = Image.new("RGBA", (CARD, CARD), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    pad = 18
    inner_pad = 14
    outer = [pad, pad, CARD - pad, CARD - pad]
    inner = [pad + inner_pad, pad + inner_pad, CARD - pad - inner_pad, CARD - pad - inner_pad]

    # Moldura dourada externa
    draw_rounded_rect(draw, outer, RADIUS, fill=hex_rgb(GOLD_LIGHT))
    draw_rounded_rect(draw, [outer[0] + 4, outer[1] + 4, outer[2] - 4, outer[3] - 4], RADIUS - 4, outline=hex_rgb(GOLD), width=4)
    draw_rounded_rect(draw, [outer[0] + 8, outer[1] + 8, outer[2] - 8, outer[3] - 8], RADIUS - 6, outline=hex_rgb(GOLD_DARK), width=2)

    # Fundo creme interno
    draw_rounded_rect(draw, inner, RADIUS - 10, fill=hex_rgb(CREAM))
    draw_rounded_rect(draw, inner, RADIUS - 10, outline=hex_rgb(GOLD), width=2)

    cx = CARD // 2
    y = inner[1] + 28

    # Badge GRUPO VIP
    badge_font = load_font(22, bold=True)
    badge_w = draw.textlength(BADGE, font=badge_font)
    badge_h = 34
    bx0 = int(cx - badge_w / 2 - 20)
    bx1 = int(cx + badge_w / 2 + 20)
    draw_rounded_rect(draw, [bx0, y, bx1, y + badge_h], 17, fill=hex_rgb(GOLD))
    draw.text((cx, y + badge_h / 2), BADGE, font=badge_font, fill=WHITE, anchor="mm")
    y += badge_h + 22

    # Moldura do QR
    frame_pad = 14
    frame_w = QR_SIZE + frame_pad * 2
    frame_h = frame_w
    fx0 = int(cx - frame_w / 2)
    fy0 = y
    fx1 = fx0 + frame_w
    fy1 = fy0 + frame_h
    draw_rounded_rect(draw, [fx0, fy0, fx1, fy1], 18, fill=WHITE, outline=hex_rgb(GOLD), width=4)
    draw_rounded_rect(draw, [fx0 + 6, fy0 + 6, fx1 - 6, fy1 - 6], 14, outline=hex_rgb(GOLD_LIGHT), width=1)

    # Cantoneiras decorativas
    corner = 20
    for ox, oy, flip_x, flip_y in [
        (fx0 + 10, fy0 + 10, 1, 1),
        (fx1 - 10, fy1 - 10, -1, -1),
    ]:
        lx = ox + (corner * flip_x)
        ly = oy
        draw.line([(ox, oy), (lx, oy)], fill=hex_rgb(GOLD_DARK), width=3)
        draw.line([(ox, oy), (ox, oy + corner * flip_y)], fill=hex_rgb(GOLD_DARK), width=3)

    img.paste(qr_img, (fx0 + frame_pad, fy0 + frame_pad))
    y = fy1 + 28

    # Título
    title_font = load_font(30, bold=True)
    max_w = inner[2] - inner[0] - 48
    lines = wrap_text(draw, TITLE.replace("\n", " "), title_font, max_w)
    # Forçar quebra no meio da frase para layout equilibrado
    lines = [
        "Escaneie o Código QR para",
        "realizar o cadastro no Grupo VIP",
    ]
    for line in lines:
        draw.text((cx, y), line, font=title_font, fill=hex_rgb(NAVY), anchor="mt")
        y += 38

    # Subtítulo
    sub_font = load_font(18, bold=True)
    draw.text((cx, y + 8), SUB, font=sub_font, fill=hex_rgb(GOLD_DARK), anchor="mt")

    OUT_CARD.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT_CARD, "PNG", optimize=True)
    print(f"QR simples: {OUT_QR}")
    print(f"Cartão:     {OUT_CARD} ({CARD}x{CARD})")
    print(f"URL:        {URL}")


if __name__ == "__main__":
    main()
