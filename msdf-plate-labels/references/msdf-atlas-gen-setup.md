# msdf-atlas-gen：下载、安装与生成汉字+数字+字母图集

本文件是"从零开始"的完整指南，覆盖下载、解压、charset 文件语法、命令行参数与故障排查。
所有结论均在本 skill 开发过程中实测验证。

## 1. 下载与安装（Windows）

### 方案 A：官方预编译 Release（推荐，免编译）

1. 打开 GitHub：`https://github.com/Chlumsky/msdf-atlas-gen/releases`
2. 下载 `msdf-atlas-gen-win64.zip`（v1.4 及以后提供 win64 预编译包；v1.3 / v1.2.2 也有）
3. 解压到任意目录，例如 `D:\tools\msdf-atlas-gen\`
4. 注意：解压后可能多嵌套一层目录，实际可执行文件在
   `D:\tools\msdf-atlas-gen\msdf-atlas-gen\msdf-atlas-gen.exe`

验证安装：

```
msdf-atlas-gen.exe --help
```

若输出参数列表说明可用。

### 方案 B：源码编译（仅在需要最新特性时）

需要 CMake + 支持 C++17 的编译器。Windows 上建议 Visual Studio Build Tools：

```
git clone --recursive https://github.com/Chlumsky/msdf-atlas-gen.git
cmake -S . -B build -DMSDF_ATLAS_BUILD_STANDALONE=ON
cmake --build build --config Release
```

### 方案 C：msdf-bmfont（npm 包，不推荐）

`msdf-bmfont` 依赖 node-canvas，在 Windows 上常因原生编译失败（gyp ERR）不可用。
本 skill 不使用它。

### 字体准备

- 需要一款**有授权且覆盖目标字符**的字体文件（.ttf / .otf）
- Windows 自带黑体：`C:\Windows\Fonts\simhei.ttf`（覆盖全部常用汉字，适合车牌演示）
- 商用项目请确认字体授权

## 2. charset 文件语法（关键，最容易踩坑）

msdf-atlas-gen 的字符集文件**必须是双引号包裹的 UTF-8 字符串**：

```
"京津沪渝冀晋蒙辽吉黑苏浙皖闽赣鲁豫鄂湘粤桂琼川贵云藏陕甘青宁新台港澳0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
```

踩坑记录（均已实测）：

| 错误做法 | 现象 | 原因 |
| --- | --- | --- |
| 裸 UTF-8 字符文件（每行一个字符） | `Failed to load character set specification.` | charset 解析器只接受双引号包裹的字符串字面量 |
| 在命令行参数直接传中文（`-chars 京津沪渝…`） | 汉字丢失 / 乱码 / 只生成部分字形 | Windows 控制台把命令行参数按系统代码页（中文系统为 GBK）编码，非 ASCII 字符被破坏 |
| 文件带 BOM | 解析失败或首字符异常 | 解析器按字节流读取，BOM 会干扰 |

正确做法：用 Python 写入 charset 文件（本 skill 的 `build_atlas.py` 已封装）：

```python
with open('charset.txt', 'w', encoding='utf-8', newline='') as f:
    f.write('"' + CHARS + '"')
```

字符集是**业务契约**：图集里有哪些字形，HTML 端 `GLYPH_CHARS` 就必须是哪些字符（顺序可自定义，但集合必须一致）。显示其他地区简称时，应把字符加入字符集并重新生成图集，而不是把不认识的字符替换成已有字符。

## 3. 生成命令（汉字 + 数字 + 字母）

完整命令（v1.3 / v1.4 通用）：

```
msdf-atlas-gen.exe ^
  -font C:\Windows\Fonts\simhei.ttf ^
  -charset charset.txt ^
  -type msdf ^
  -size 64 ^
  -pxrange 8 ^
  -format png ^
  -dimensions 1024 1024 ^
  -yorigin bottom ^
  -json atlas.json ^
  -imageout atlas.png
```

参数说明：

| 参数 | 作用 | 建议值 |
| --- | --- | --- |
| `-font` | 字体文件 | 覆盖目标字符的授权字体 |
| `-charset` | 字符集文件（双引号包裹的 UTF-8 字符串） | 见上文 |
| `-type msdf` | 多通道有符号距离场 | `msdf`（教程前提） |
| `-size` | 字形像素尺寸 | 64（更高清晰度可 96/128，图集会更大） |
| `-pxrange` | 像素距离范围 | 8（越小边缘越锐利，太大可能发虚） |
| `-format png` | 输出格式 | png |
| `-dimensions W H` | 图集尺寸（v1.4 用这个；`-pot`/`-strict` 在 v1.4 不可用） | 1024 1024（70 字形绰绰有余；字符多时用 2048） |
| `-yorigin bottom` | JSON 中 y 轴原点约定 | 显式写 `bottom`，与纹理 flipY 配套 |
| `-json` / `-imageout` | 输出文件 | 自定义路径 |

## 4. 验证产物

生成后检查 `atlas.json`：

```json
{
  "atlas": {
    "type": "msdf",
    "width": 1024, "height": 1024,
    "distanceRange": 8,
    "yOrigin": "bottom"
  },
  "glyphs": [
    { "unicode": 20140, "atlasBounds": {"left":..,"bottom":..,"right":..,"top":..}, "planeBounds": {...} }
  ]
}
```

- `atlas.type` 必须为 `msdf`，`distanceRangeMiddle` 应为 0（对称距离场，0.5 为轮廓边界）
- `glyphs.length` 应等于字符集数量（70 字形 → 70 条记录）
- `unicode` 是十进制的码点（如"京"=20140）

## 5. 故障排查

| 现象 | 检查 |
| --- | --- |
| `Failed to load character set specification.` | charset 文件必须双引号包裹 |
| 汉字丢失只出数字字母 | 命令行直接传了中文 → 改用 charset 文件 |
| 生成成功但 HTML 端报"图集缺少字形" | `GLYPH_CHARS` 与 `--chars` 不一致 |
| 文字上下颠倒 | JSON `yOrigin` 与纹理 `flipY` 未配套（见 plate-rendering.md） |
| 文字是实心色块 | 图集被当成 sRGB 颜色处理，或片元未输出覆盖率 |

## 6. 一键脚本

本 skill 提供 `scripts/build_atlas.py` 封装以上全部步骤（自动写 charset 文件、自动探测 exe 路径）：

```
python build_atlas.py --chars "京津沪渝…ABC…" --out atlas-cn
```
