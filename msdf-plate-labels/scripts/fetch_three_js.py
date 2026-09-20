#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""下载 three.min.js（UMD 构建）到本地，供 build_html.py --three 使用。

用法:
  python fetch_three_js.py [--version 0.160.0] [--out three.min.js]

注意:
  - 仅走 jsDelivr（官方推荐镜像），禁止 bootcdn / staticfile / polyfill.io
  - r150+ 的控制台弃用警告不影响本渲染路径（只用到基础 API）
"""
import argparse
import os
import urllib.request

DEFAULT_VERSION = '0.160.0'
URL = 'https://cdn.jsdelivr.net/npm/three@{v}/build/three.min.js'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--version', default=DEFAULT_VERSION)
    ap.add_argument('--out', default='three.min.js')
    args = ap.parse_args()

    url = URL.format(v=args.version)
    print('下载:', url)
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read()
    with open(args.out, 'wb') as f:
        f.write(data)
    print('保存:', os.path.abspath(args.out), len(data), 'bytes')


if __name__ == '__main__':
    main()
