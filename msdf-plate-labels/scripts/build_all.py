#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""一键生成车牌 HTML：生成 MSDF 图集（含汉字+数字+字母）→ 构建自包含 WebGL2 HTML

用法（最简单，零参数）:
  python build_all.py

自定义用法:
  python build_all.py --chars "京津沪渝冀晋蒙辽吉黑苏浙皖闽赣鲁豫鄂湘粤桂琼川贵云藏陕甘青宁新台港澳0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ" --out plate-cn.html

参数:
  --chars     字符集（默认全国 34 省 70 字符，无需指定）
  --out       HTML 输出路径（默认 plate.html）
  --atlas     图集输出前缀（默认 atlas-cn，生成 <atlas>.png + <atlas>.json）
  --three     three.min.js 路径（默认取包根目录 three.min.js，随包已提供）
  --no-atlas  图集已存在时跳过生成，只构建 HTML
  --font / --exe / --size / --pxrange / --dim   透传给 build_atlas.py
"""
import argparse
import os
import subprocess
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PKG_DIR = os.path.dirname(SCRIPT_DIR)
sys.path.insert(0, SCRIPT_DIR)
from build_atlas import DEFAULT_CHARS  # noqa: E402


def run_script(py, args):
    cmd = [sys.executable, os.path.join(SCRIPT_DIR, py)] + args
    print('>>', ' '.join(cmd))
    r = subprocess.run(cmd)
    if r.returncode != 0:
        raise SystemExit('[错误] 步骤失败: ' + py + '（返回码 %d）' % r.returncode)


def main():
    ap = argparse.ArgumentParser(description='一键生成车牌 HTML（图集 + 构建）')
    ap.add_argument('--chars', default=DEFAULT_CHARS, help='字符集字符串（默认全国 34 省 70 字符）')
    ap.add_argument('--out', default='plate.html', help='HTML 输出路径（默认 plate.html）')
    ap.add_argument('--atlas', default='atlas-cn', help='图集输出前缀（默认 atlas-cn）')
    ap.add_argument('--three', default=None, help='three.min.js 路径（默认取包根目录）')
    ap.add_argument('--no-atlas', action='store_true', help='跳过图集生成，仅构建 HTML')
    ap.add_argument('--font', default=None)
    ap.add_argument('--exe', default=None)
    ap.add_argument('--size', type=int, default=None)
    ap.add_argument('--pxrange', type=int, default=None)
    ap.add_argument('--dim', type=int, default=None)
    args = ap.parse_args()

    three = args.three
    if not three:
        pkg_three = os.path.join(PKG_DIR, 'three.min.js')
        script_three = os.path.join(SCRIPT_DIR, 'three.min.js')
        three = pkg_three if os.path.isfile(pkg_three) else script_three
    if not os.path.isfile(three):
        raise SystemExit('[错误] 未找到 three.min.js，请联网运行 fetch_three_js.py 或 --three 指定路径')

    if not args.no_atlas:
        atlas_args = ['--chars', args.chars, '--out', args.atlas]
        if args.font: atlas_args += ['--font', args.font]
        if args.exe: atlas_args += ['--exe', args.exe]
        if args.size: atlas_args += ['--size', str(args.size)]
        if args.pxrange: atlas_args += ['--pxrange', str(args.pxrange)]
        if args.dim: atlas_args += ['--dim', str(args.dim)]
        run_script('build_atlas.py', atlas_args)
    else:
        print('>> 跳过图集生成（--no-atlas）')

    run_script('build_html.py', [
        '--atlas-json', args.atlas + '.json',
        '--atlas-png', args.atlas + '.png',
        '--chars', args.chars,
        '--three', three,
        '--out', args.out,
    ])
    print('完成。双击打开:', os.path.abspath(args.out))


if __name__ == '__main__':
    main()
