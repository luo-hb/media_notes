#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成 MSDF 图集（汉字 + 数字 + 字母）：输出 <out>.png + <out>.json

用法示例:
  python build_atlas.py --chars "京津沪渝冀晋蒙辽吉黑苏浙皖闽赣鲁豫鄂湘粤桂琼川贵云藏陕甘青宁新台港澳0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
  python build_atlas.py --chars "0123456789ABC" --out atlas-en --dim 512
  python build_atlas.py --download-exe        # 自动下载 msdf-atlas-gen.exe 到本脚本目录

exe 查找顺序:
  1. 本脚本同目录下的 msdf-atlas-gen.exe（推荐：把 exe 放在 build_atlas.py 旁边，随包分发）
  2. 本脚本目录下任意子目录（解压的 win64 包可能多嵌套一层）
  3. --exe 显式指定的路径
  4. 常见安装位置（tools/、C:\\msdfwork\\ 等）
  找不到时提示手动下载，或加 --download-exe 自动下载。

关键点（踩坑记录）:
  - charset 文件必须用双引号包裹的 UTF-8 字符串（msdf-atlas-gen 官方解析语法）；
    裸 UTF-8 字符文件会被解析器拒绝: "Failed to load character set specification."
  - 不要在命令行参数里直接传中文（Windows 控制台按 GBK 编码参数，汉字会乱码丢失）；
    必须走 charset 文件（文件按字节流读取，不经过命令行编码转换）。
  - v1.4 不支持 -pot / -strict，用 -dimensions 固定尺寸。
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import urllib.request
import zipfile

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
GITHUB_REPO = 'Chlumsky/msdf-atlas-gen'
RELEASE_API = 'https://api.github.com/repos/%s/releases/latest' % GITHUB_REPO
RELEASE_PAGE = 'https://github.com/%s/releases' % GITHUB_REPO

# 默认字符集：全国 34 个省级行政区车牌汉字 + 数字 + 大写字母（70 字形）
DEFAULT_CHARS = '京津沪渝冀晋蒙辽吉黑苏浙皖闽赣鲁豫鄂湘粤桂琼川贵云藏陕甘青宁新台港澳0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'

# 常见安装位置（按顺序探测；仅保留通用路径，不绑定本机固定目录）
FALLBACK_EXE_CANDIDATES = [
    r'C:\msdfwork\v13\msdf-atlas-gen\msdf-atlas-gen.exe',
    r'C:\msdfwork\v122\msdf-atlas-gen\msdf-atlas-gen.exe',
    r'C:\msdf-atlas-gen\msdf-atlas-gen.exe',
    'msdf-atlas-gen',
]


def find_exe(explicit):
    """按优先级查找 exe：同目录 → 子目录 → --exe → 常见位置"""
    # 1) 本脚本同目录
    p = os.path.join(SCRIPT_DIR, 'msdf-atlas-gen.exe')
    if os.path.isfile(p):
        return p
    # 2) 本脚本目录下任意子目录（解压的 zip 可能多嵌套一层）
    for root, _dirs, files in os.walk(SCRIPT_DIR):
        if 'msdf-atlas-gen.exe' in files:
            return os.path.join(root, 'msdf-atlas-gen.exe')
    # 3) --exe 显式指定
    if explicit and os.path.isfile(explicit):
        return explicit
    # 4) 常见安装位置
    for c in FALLBACK_EXE_CANDIDATES:
        if os.path.isfile(c) or shutil.which(c):
            return c
    return None


def download_exe():
    """从 GitHub Releases 下载 win64 预编译 zip，解压到脚本目录，返回 exe 路径"""
    print('正在查询最新 Release:', RELEASE_API)
    req = urllib.request.Request(RELEASE_API, headers={'User-Agent': 'msdf-plate-labels/1.0'})
    with urllib.request.urlopen(req, timeout=30) as r:
        release = json.loads(r.read().decode('utf-8'))
    assets = [a for a in release.get('assets', []) if a['name'].lower().endswith('.zip')]
    win = next((a for a in assets if 'win64' in a['name'].lower() or 'win' in a['name'].lower()),
               assets[0] if assets else None)
    if not win:
        raise RuntimeError('未在 Release 中找到 zip 包，请手动下载: ' + RELEASE_PAGE)
    url = win['browser_download_url']
    name = win['name']
    print('下载:', name, '->', url)
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    tmp = os.path.join(tempfile.gettempdir(), name)
    with urllib.request.urlopen(req, timeout=180) as r, open(tmp, 'wb') as f:
        shutil.copyfileobj(r, f)
    print('解压到:', SCRIPT_DIR)
    with zipfile.ZipFile(tmp) as z:
        z.extractall(SCRIPT_DIR)
    for root, _dirs, files in os.walk(SCRIPT_DIR):
        if 'msdf-atlas-gen.exe' in files:
            exe = os.path.join(root, 'msdf-atlas-gen.exe')
            print('已就绪:', exe)
            return exe
    raise RuntimeError('zip 中未找到 msdf-atlas-gen.exe，请手动解压 ' + tmp)


def print_download_help():
    print('')
    print('=' * 60)
    print('[未找到 msdf-atlas-gen.exe] 请任选一种方式：')
    print('')
    print('  A) 自动下载（需要网络）:')
    print('       python build_atlas.py --download-exe')
    print('')
    print('  B) 手动下载:')
    print('       打开 ' + RELEASE_PAGE)
    print('       下载 msdf-atlas-gen-win64.zip，解压后把')
    print('       msdf-atlas-gen.exe 放到本脚本同目录即可')
    print('')
    print('  C) 已有 exe 但不在同目录:')
    print('       python build_atlas.py --exe <msdf-atlas-gen.exe 完整路径> ...')
    print('=' * 60)
    print('')


def main():
    ap = argparse.ArgumentParser(description='调用 msdf-atlas-gen 生成 MSDF 图集 png + json')
    ap.add_argument('--chars', default=DEFAULT_CHARS, help='字符集字符串（默认全国 34 省 70 字符，无需指定）')
    ap.add_argument('--font', default=r'C:\Windows\Fonts\simhei.ttf', help='字体文件路径')
    ap.add_argument('--exe', default=None, help='msdf-atlas-gen.exe 路径；缺省按 同目录→子目录→常见位置 自动探测')
    ap.add_argument('--download-exe', action='store_true', help='自动下载 msdf-atlas-gen.exe 到本脚本目录后退出')
    ap.add_argument('--out', default='atlas', help='输出前缀，生成 <out>.png 与 <out>.json')
    ap.add_argument('--size', type=int, default=64, help='字形像素尺寸（默认 64）')
    ap.add_argument('--pxrange', type=int, default=8, help='像素距离范围（默认 8）')
    ap.add_argument('--dim', type=int, default=1024, help='图集边长（正方形，默认 1024）')
    args = ap.parse_args()

    if args.download_exe:
        download_exe()
        return

    exe = find_exe(args.exe)
    if not exe:
        print_download_help()
        sys.exit(1)

    # 1) charset 文件：双引号包裹的 UTF-8 字符串（关键！）
    tmpdir = tempfile.mkdtemp(prefix='msdf_')
    charset_file = os.path.join(tmpdir, 'charset.txt')
    with open(charset_file, 'w', encoding='utf-8', newline='') as f:
        f.write('"' + args.chars + '"')
    print('chars 数量:', len(args.chars))

    # 2) 调用 msdf-atlas-gen
    out_json = os.path.abspath(args.out + '.json')
    out_png = os.path.abspath(args.out + '.png')
    cmd = [
        exe,
        '-font', args.font,
        '-charset', charset_file,
        '-type', 'msdf',
        '-size', str(args.size),
        '-pxrange', str(args.pxrange),
        '-format', 'png',
        '-dimensions', str(args.dim), str(args.dim),
        '-yorigin', 'bottom',
        '-json', out_json,
        '-imageout', out_png,
    ]
    print('使用 exe:', exe)
    print('RUN:', ' '.join(cmd))
    r = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
    print('退出码:', r.returncode)
    if r.stdout:
        print('STDOUT:', r.stdout)
    if r.stderr:
        print('STDERR:', r.stderr)
    if r.returncode != 0:
        raise SystemExit('[错误] msdf-atlas-gen 执行失败（返回码 %d）' % r.returncode)
    if not (os.path.isfile(out_json) and os.path.isfile(out_png)):
        raise SystemExit('[错误] 未生成预期产物，请检查上面输出')
    print('产物:')
    print('  ', out_json, os.path.getsize(out_json), 'bytes')
    print('  ', out_png, os.path.getsize(out_png), 'bytes')


if __name__ == '__main__':
    main()
