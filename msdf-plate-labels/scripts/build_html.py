#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 three.min.js + atlas json/png 内嵌进模板，生成自包含 HTML（WebGL2 / GLSL3 车牌渲染）

用法示例:
  python build_html.py --atlas-json atlas-cn.json --atlas-png atlas-cn.png --chars "京津沪渝...ABC" --out plate.html
  python build_html.py --atlas-json atlas.json --atlas-png atlas.png --chars "0123456789ABC" --three three.min.js --out plate-en.html

参数说明:
  --three       直接指定 three.min.js 文件路径
  --three-from  从已有自包含 html 中提取第一个 <script> 块作为 three.js（避免重新下载）
                两参数至少提供一个，--three 优先
  --chars       字符集字符串，注入模板替换 GLYPH_CHARS 占位符（必须与图集生成时的 --chars 完全一致）
  --part1/--part2  模板文件路径（缺省使用本 skill 自带 assets 模板）
"""
import argparse
import base64
import json
import os
import re
import sys

SKILL_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_PART1 = os.path.join(SKILL_DIR, 'assets', 'plate_template_part1.html')
DEFAULT_PART2 = os.path.join(SKILL_DIR, 'assets', 'plate_template_part2.html')


def read_three_js(args):
    if args.three and os.path.isfile(args.three):
        with open(args.three, 'r', encoding='utf-8', errors='strict') as f:
            return f.read()
    if args.three_from and os.path.isfile(args.three_from):
        with open(args.three_from, 'r', encoding='utf-8') as f:
            html = f.read()
        m = re.search(r'<script>(.*?)</script>', html, re.S)
        if not m:
            raise SystemExit('[错误] 未能从 %s 提取 three.min.js' % args.three_from)
        return m.group(1)
    raise SystemExit('[错误] 需要 --three 或 --three-from 提供 three.min.js')


def main():
    ap = argparse.ArgumentParser(description='构建自包含 WebGL2 车牌 HTML')
    ap.add_argument('--atlas-json', required=True, help='msdf-atlas-gen 生成的 json 元数据')
    ap.add_argument('--atlas-png', required=True, help='msdf-atlas-gen 生成的 png 图集')
    ap.add_argument('--chars', required=True, help='字符集字符串（必须与图集 --chars 一致）')
    ap.add_argument('--out', default='plate.html', help='输出 html 路径')
    ap.add_argument('--three', default=None)
    ap.add_argument('--three-from', default=None)
    ap.add_argument('--part1', default=DEFAULT_PART1)
    ap.add_argument('--part2', default=DEFAULT_PART2)
    args = ap.parse_args()

    with open(args.part1, 'r', encoding='utf-8') as f:
        part1 = f.read()
    with open(args.part2, 'r', encoding='utf-8') as f:
        part2 = f.read()

    # 1) three.min.js
    three_js = read_three_js(args).replace('</script>', '<\\/script>')

    # 2) atlas.json -> 压缩 JSON 对象
    with open(args.atlas_json, 'r', encoding='utf-8') as f:
        atlas_json = json.load(f)
    json_text = json.dumps(atlas_json, ensure_ascii=False, separators=(',', ':'))

    # 3) atlas.png -> data URL
    with open(args.atlas_png, 'rb') as f:
        png_b64 = base64.b64encode(f.read()).decode('ascii')
    data_url = '"data:image/png;base64,' + png_b64 + '"'

    # 4) 组装 + 替换占位符
    html = part1 + part2
    html = html.replace('/*__THREE_JS__*/', three_js)
    html = html.replace('/*__ATLAS_JSON__*/', json_text)
    html = html.replace('/*__ATLAS_PNG__*/', data_url)
    html = html.replace('"__GLYPH_CHARS__"', json.dumps(args.chars, ensure_ascii=False))
    # GLYPH_CHARS 占位符可能在模板里以 var GLYPH_CHARS = "..."; 形式出现，两种都覆盖
    html = re.sub(r'var GLYPH_CHARS = ".*?";', 'var GLYPH_CHARS = ' + json.dumps(args.chars, ensure_ascii=False) + ';', html)

    for ph in ['/*__THREE_JS__*/', '/*__ATLAS_JSON__*/', '/*__ATLAS_PNG__*/', '__GLYPH_CHARS__']:
        assert ph not in html, '占位符未替换: ' + ph

    out = os.path.abspath(args.out)
    with open(out, 'w', encoding='utf-8') as f:
        f.write(html)
    print('生成:', out, os.path.getsize(out), 'bytes')
    print('glyphChars 数量:', len(args.chars))


if __name__ == '__main__':
    main()
