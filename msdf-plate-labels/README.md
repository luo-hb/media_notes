<!--  本项目 基于  微信-公众号： 大前端私房小菜 大佬 分享的微信文章 借助AI实现的
Three.js 高性能渲染海量车牌标签
https://mp.weixin.qq.com/s/esIbjNbQaGbFCO0WzAQ3Yg
 -->
# msdf-plate-labels · 一条命令生成 WebGL2 车牌标签

把 34 省汉字车牌做成可交互的 3D 网页（Three.js + WebGL2 + MSDF 图集 + GPU 实例化，海量车牌高性能渲染）。所有工具已随包，**全程不需要网络**。

## 怎么用（就一条命令）

```text
python scripts/build_all.py
```

完成后双击生成的 `plate.html` 即可看到 34 省汉字车牌。

- 需要 Python 3.8+（装一次即可）
- 其他都是可选项：
  - 自定义字符集：`--chars "京津沪渝…ABC…"`
  - 改输出名：`--out my.html`
  - 只重新生成网页（图集已存在）：`--no-atlas`
  - 更高清图集：`--size 96 --dim 2048`

## 目录

```
msdf-plate-labels/
├── SKILL.md              给 AI 看的主文档
├── three.min.js          Three.js（随包，离线可用）
├── scripts/
│   ├── msdf-atlas-gen.exe  图集工具（随包）
│   ├── build_all.py        一键生成（推荐入口）
│   ├── build_atlas.py      只生成图集 png+json
│   ├── build_html.py       只生成 HTML
│   └── fetch_three_js.py   可选：联网更新 three.js
├── assets/                HTML 模板（改车牌数据/样式用）
└── references/            原理与排错详解
```

## 常见问题

| 现象 | 处理 |
| --- | --- |
| 提示缺 three.min.js | 确认包根目录有 `three.min.js`（随包自带，别删） |
| 提示缺 msdf-atlas-gen.exe | 确认 `scripts/msdf-atlas-gen.exe` 在（随包自带，别删） |
| 网页里文字是色块/颠倒 | 重新跑 `python scripts/build_all.py` 覆盖生成 |
| 想换车牌样式/数量 | 改 `assets/plate_template_part2.html` 后重跑一键命令 |

细节原理见 `references/plate-rendering.md`，工具安装与排错见 `references/msdf-atlas-gen-setup.md`。

<!--  本项目 基于  微信-公众号： 大前端私房小菜 大佬 分享的微信文章 借助AI实现的
Three.js 高性能渲染海量车牌标签
https://mp.weixin.qq.com/s/esIbjNbQaGbFCO0WzAQ3Yg
 -->
<!-- 分享的意义，文章大家上手有难度，大佬没有分享项目效果，我也是借助AI都搞了四五个小时才实现的 -->
