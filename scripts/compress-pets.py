# -*- coding: utf-8 -*-
"""压缩宠物卡通形象：
1. 原图备份到 img-src-backup/
2. 缩放到 640x640 + 256 色调色板 PNG（保留透明通道）
"""
import os, shutil
from PIL import Image

SRC = os.path.join(os.path.dirname(__file__), '..', 'public', 'img', 'pets')
BAK = os.path.join(os.path.dirname(__file__), '..', 'img-src-backup')
os.makedirs(BAK, exist_ok=True)

total_before = 0
total_after = 0
for n in range(1, 25):
    p = os.path.join(SRC, 'pet-%d.png' % n)
    if not os.path.exists(p):
        print('MISS', p)
        continue
    b = os.path.join(BAK, 'pet-%d.png' % n)
    if not os.path.exists(b):
        shutil.copy2(p, b)
    before = os.path.getsize(p)
    im = Image.open(b).convert('RGBA')
    im = im.resize((640, 640), Image.LANCZOS)
    q = im.quantize(colors=256, method=Image.FASTOCTREE)
    q.save(p, optimize=True)
    after = os.path.getsize(p)
    total_before += before
    total_after += after
    print('pet-%-2d  %7.0fKB -> %5.0fKB' % (n, before / 1024, after / 1024))

print('TOTAL %.1fMB -> %.1fMB' % (total_before / 1048576, total_after / 1048576))
