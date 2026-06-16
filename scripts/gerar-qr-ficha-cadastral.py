"""Gera QR-CODE/qr-ficha-cadastral.png para a página da Ficha Cadastral Grupo VIP."""
from pathlib import Path

import qrcode
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "QR-CODE" / "qr-ficha-cadastral.png"
URL = "https://delianesantos.vercel.app/ficha-cadastral"

QR_SIZE = 380
FRAME_PAD = 16
BORDER_OUT = 10
RADIUS = 20


def main():
    qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=12, border=1)
    qr.add_data(URL)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="#001D3D", back_color="#FFFFFF").convert("RGB")
    qr_img = qr_img.resize((QR_SIZE, QR_SIZE), Image.Resampling.NEAREST)

    inner_w = QR_SIZE + FRAME_PAD * 2
    inner_h = QR_SIZE + FRAME_PAD * 2
    w = inner_w + BORDER_OUT * 2
    h = inner_h + BORDER_OUT * 2

    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    x0, y0 = BORDER_OUT, BORDER_OUT
    x1, y1 = BORDER_OUT + inner_w, BORDER_OUT + inner_h

    draw.rounded_rectangle([x0, y0, x1, y1], radius=RADIUS, fill=(255, 255, 255, 255))

    for offset, color, width in (
        (0, "#E6C277", 5),
        (3, "#C5943E", 3),
        (7, "#A67A2E", 2),
    ):
        draw.rounded_rectangle(
            [x0 - offset, y0 - offset, x1 + offset, y1 + offset],
            radius=RADIUS + offset,
            outline=color,
            width=width,
        )

    draw.rounded_rectangle([x0 + 10, y0 + 10, x1 - 10, y1 - 10], radius=14, outline="#E6C277", width=1)
    img.paste(qr_img, (x0 + FRAME_PAD, y0 + FRAME_PAD))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT, "PNG", optimize=True)
    print(f"Salvo: {OUT} ({w}x{h})")
    print(f"URL: {URL}")


if __name__ == "__main__":
    main()
