"""把 images/ 下的车图转换为 WebP，显著减小页面体积。

用法：
    python optimize_images.py            # 转换并保留原图
    python optimize_images.py --replace  # 转换后删除原始 jpg/png

需要 Pillow：pip install pillow
"""

import argparse
import pathlib
import sys

from PIL import Image

IMAGES_DIR = pathlib.Path(__file__).parent / "images"
MAX_WIDTH = 900  # 足够全宽轮播使用，卡片按 2x 显示也清晰
QUALITY = 72
SOURCE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}


def convert(path: pathlib.Path, replace: bool) -> tuple[int, int]:
    """返回 (原始字节数, 输出字节数)。"""
    target = path.with_suffix(".webp")
    before = path.stat().st_size

    # 源文件可能就是目标文件（重新编码），先写临时文件再替换，避免边读边写
    tmp = target.with_suffix(".webp.tmp")
    with Image.open(path) as im:
        im = im.convert("RGB")
        if im.width > MAX_WIDTH:
            height = round(im.height * MAX_WIDTH / im.width)
            im = im.resize((MAX_WIDTH, height), Image.LANCZOS)
        im.save(tmp, "WEBP", quality=QUALITY, method=6)

    if replace and path != target:
        path.unlink()
    tmp.replace(target)

    return before, target.stat().st_size


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--replace", action="store_true", help="转换后删除原始图片")
    args = parser.parse_args()

    if not IMAGES_DIR.is_dir():
        print(f"找不到目录：{IMAGES_DIR}")
        return 1

    sources = sorted(p for p in IMAGES_DIR.iterdir() if p.suffix.lower() in SOURCE_SUFFIXES)
    if not sources:
        print("没有需要转换的图片。")
        return 0

    total_before = total_after = 0
    for path in sources:
        before, after = convert(path, args.replace)
        total_before += before
        total_after += after
        print(f"{path.name:32} {before / 1024:7.0f} KB -> {after / 1024:7.0f} KB")

    saved = 100 * (1 - total_after / total_before) if total_before else 0
    print(f"\n合计 {total_before / 1024 / 1024:.2f} MB -> {total_after / 1024 / 1024:.2f} MB（减少 {saved:.0f}%）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
