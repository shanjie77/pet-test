# -*- coding: utf-8 -*-
"""宠物卡通形象背景移除：
1. 从 img-src-backup/ 读取 1024px 原图
2. 判定"中性浅色"像素（白底与假棋盘格），取与图像边界连通的整块作为背景置为透明
3. 轻量去白边（透明邻接的浅色像素再剥 2 轮）
4. 按内容裁切为正方形（留 6% 边距），缩放到 640px，256 色调色板压缩
5. 生成奶油底色的 4x6 拼图 contact-sheet.png 供人工检查
"""
import os
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'img-src-backup')
DST = os.path.join(ROOT, 'public', 'img', 'pets')
SHEET = os.path.join(ROOT, 'shots', 'contact-sheet.png')

STRUCT = np.ones((3, 3), dtype=bool)  # 8 连通


def process(path):
    im = Image.open(path).convert('RGB')
    a = np.asarray(im).astype(np.int16)
    mx = a.max(axis=2)
    mn = a.min(axis=2)
    spread = mx - mn
    cand = (mn >= 215) & (spread <= 24)

    lab, n = ndimage.label(cand, structure=STRUCT)
    if n == 0:
        return im, 0.0
    border_ids = np.unique(np.concatenate([
        lab[0, :], lab[-1, :], lab[:, 0], lab[:, -1]]))
    border_ids = border_ids[border_ids > 0]
    bg = np.isin(lab, border_ids)
    bg_ratio = bg.mean()

    alpha = np.where(bg, 0, 255).astype(np.uint8)

    # 去白边/网格残留：与透明相邻的浅色像素也置为透明，有界迭代
    # （棋盘格缝隙线比格子略深，首轮阈值吃不到，靠这里从透明边界向内咬掉）
    for _ in range(6):
        trans = alpha == 0
        near = np.zeros_like(trans)
        near[1:, :] |= trans[:-1, :]
        near[:-1, :] |= trans[1:, :]
        near[:, 1:] |= trans[:, :-1]
        near[:, :-1] |= trans[:, 1:]
        fringe = near & (mn >= 200) & (spread <= 26) & ~trans
        if not fringe.any():
            break
        alpha[fringe] = 0

    rgba = np.dstack([a.astype(np.uint8), alpha])
    out = Image.fromarray(rgba, 'RGBA')

    # 按内容裁切为正方形，留 6% 边距
    ys, xs = np.where(alpha > 0)
    if len(xs) == 0:
        return out, bg_ratio
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    cw, ch = x1 - x0 + 1, y1 - y0 + 1
    side = int(max(cw, ch) * 1.12)
    side = min(side, max(im.size))
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    half = side // 2
    l = max(0, cx - half); t = max(0, cy - half)
    r = min(im.width, l + side); b = min(im.height, t + side)
    l = max(0, r - side); t = max(0, b - side)
    out = out.crop((l, t, r, b))
    return out, bg_ratio


total = 0
tiles = []
for i in range(1, 25):
    src = os.path.join(SRC, 'pet-%d.png' % i)
    out, bg_ratio = process(src)
    out = out.resize((640, 640), Image.LANCZOS)
    q = out.quantize(colors=256, method=Image.FASTOCTREE)
    dst = os.path.join(DST, 'pet-%d.png' % i)
    q.save(dst, optimize=True)
    sz = os.path.getsize(dst)
    total += sz
    tiles.append((i, out))
    print('pet-%-2d bg=%.0f%%  %4.0fKB' % (i, bg_ratio * 100, sz / 1024))

print('TOTAL %.2fMB' % (total / 1048576))

# 拼图预览（奶油底色）
cell = 260
sheet = Image.new('RGB', (cell * 4, cell * 6), (251, 237, 221))
for idx, (i, im) in enumerate(tiles):
    r, c = divmod(idx, 4)
    tile = im.resize((cell - 20, cell - 20), Image.LANCZOS)
    sheet.paste(tile, (c * cell + 10, r * cell + 10), tile)
sheet.save(SHEET)
print('sheet ->', SHEET)
