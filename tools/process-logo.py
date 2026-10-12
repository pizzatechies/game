"""Turns the official Pizza Technologies logo (gold on dark) into a transparent PNG for the game.
Usage: python3 tools/process-logo.py   (reads brand/pizza-technologies-logo-original.png)"""
import numpy as np
from PIL import Image
src = Image.open('brand/pizza-technologies-logo-original.png').convert('RGB')
a = np.asarray(src).astype(np.float32)
lum = a.max(axis=2)                                   # gold has a high max channel, the dark backdrop/shadow does not
t = np.clip((lum - 60) / (125 - 60), 0, 1)
alpha = t * t * (3 - 2 * t)                           # smoothstep
# un-premultiply against the dark backdrop so edges stay gold instead of grey
bg = 28.0
rgb = np.clip((a - bg * (1 - alpha[..., None])) / np.maximum(alpha[..., None], 1e-3), 0, 255)
out = np.dstack([rgb, alpha * 255]).astype(np.uint8)
img = Image.fromarray(out, 'RGBA')
ys, xs = np.where(alpha > 0.35)
x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
pad = 14
cx, cy, half = (x0 + x1) // 2, (y0 + y1) // 2, max(x1 - x0, y1 - y0) // 2 + pad
img = img.crop((cx - half, cy - half, cx + half, cy + half)).resize((512, 512), Image.LANCZOS)
img.save('www/img/pt-logo.png', optimize=True)
print('bbox', (x0, y0, x1, y1), '->', img.size)
