---
name: msdf-plate-labels
description: MSDF 车牌/标签渲染全流程：下载安装 msdf-atlas-gen，用汉字+数字+字母字符集生成 MSDF 距离场图集（png + json），再基于 Three.js WebGL2（RawShaderMaterial + GLSL3）用 InstancedMesh 实例化渲染海量车牌标签。当用户要求"生成车牌图集""MSDF 图集""msdf-atlas-gen""WebGL2 渲染车牌/标签""实例化海量车牌""海量文字标签"/"atlas.png + atlas.json + 车牌 HTML"等时使用；也可用于任何"有限字符集 → 图集 → GPU 实例化文字标签"的渲染任务。
---

# MSDF 车牌标签全流程

从零到交付的四步工作流。所有脚本已实测可用，模板已通过 Chrome 截图验证（34 省级汉字正确渲染）。

## 工作流总览

```
用户需求
  ↓
① 确认/安装 msdf-atlas-gen   （读 references/msdf-atlas-gen-setup.md）
  ↓
② 生成图集 png + json        （跑 scripts/build_atlas.py）
  ↓
③ 构建自包含 HTML            （跑 scripts/build_html.py + 模板 assets/）
  ↓
④ 验证并交付                 （浏览器打开 / 截图检查，交付 .html 单文件）
```

## ① 确认/安装 msdf-atlas-gen

- 若 exe 尚未安装，完整读 `references/msdf-atlas-gen-setup.md`（下载、解压、版本差异、charset 语法、故障排查）。
- 探测常见安装位置由脚本自动完成；也可 `--exe` 显式指定。

## ② 一键生成（图集 + HTML，推荐）

零参数即可（默认全国 34 省 70 字形，exe/three.js 随包自动使用）：

```text
python build_all.py
```

自定义时：`--chars` 换字符集、`--out` 改输出名、`--no-atlas` 跳过图集重建、`--size/--dim` 调图集分辨率。

分步（可选）：仅图集 `python build_atlas.py`；仅 HTML `python build_html.py --atlas-json atlas-cn.json --atlas-png atlas-cn.png --chars "与图集一致" --three three.min.js --out plate.html`。

硬性约束（违反必失败）：

- **charset 必须走文件、用双引号包裹的 UTF-8 字符串**；命令行直接传中文会被 GBK 破坏。
- `--chars` 就是业务契约：图集含哪些字形，HTML 端 `GLYPH_CHARS` 必须一致。
- 输出 `atlas-cn.png` + `atlas-cn.json`，验证 `atlas.type == "msdf"` 且 `glyphs.length == 字符数`。

## ③ 构建自包含 HTML（WebGL2）

`three.min.js` 随包提供，`build_all.py` 已自动处理；仅在需要更新版本时联网跑 `fetch_three_js.py`。

要点：

- 模板（`assets/plate_template_part1.html` + `part2.html`）是已验证的完整实现：
  8 槽模板几何（背景 + 8 字符槽）、双 vec4 实例属性、GLSL3 顶点着色器（选字/居中/背景伸缩/视空间 Billboard）、MSDF 片元着色器、轨道控制 + 车辆动画。
- 构建脚本自动把 three.js、压缩 JSON、PNG dataURL 注入占位符，输出**单个自包含 html**（双击即用，无外部依赖）。
- `--chars` 必须与图集生成时完全一致（脚本会替换模板内 `GLYPH_CHARS`）。
- 若需修改车牌数据（示例数组、随机生成规则、数量上限、颜色、字号），改 `part2` 中 `PROVINCE_PLATES` / `randomPlate` / `MAX_VEHICLES` 等常量后重跑构建。
- 渲染原理与 Shader 细节见 `references/plate-rendering.md`。

## ④ 验证与交付

1. 语法检查：提取 `<script>` 块 `node --check`（或在浏览器直接打开）。
2. 打开页面确认：WebGL2 生效（无 Shader 编译错误）、汉字/字母/数字正常显示、相机旋转时标签保持面向相机。
3. 若环境有 html skill 的 `shot.py`，用它截图核对桌面/移动端与 console 错误。
4. 交付：`present_files` 交付 .html 单文件（+ 可选 png/json 供用户复跑）。

## 资源导航

| 资源 | 何时读/用 |
| --- | --- |
| `references/msdf-atlas-gen-setup.md` | 首次安装/生成失败时：下载安装、charset 语法、参数、故障排查 |
| `references/plate-rendering.md` | 需要理解/修改 Shader 或模板逻辑时 |
| `scripts/build_all.py` | 一键：图集 + HTML（推荐入口） |
| `scripts/build_atlas.py` | 仅生成图集（自动写 charset 文件） |
| `scripts/fetch_three_js.py` | 联网更新 three.min.js（已随包，一般不需要） |
| `scripts/build_html.py` | 仅构建 html（图集 + three.js → 自包含） |
| `assets/plate_template_part1.html` | 核心逻辑模板（图集解析/几何/着色器/工厂函数） |
| `assets/plate_template_part2.html` | 场景模板（车辆/相机/控制/循环/车牌数据） |

## 常见问题速查

| 现象 | 处理 |
| --- | --- |
| 图集缺少字形错误 | `--chars` 与模板 `GLYPH_CHARS` 不一致 |
| 文字上下颠倒 | JSON `yOrigin` 与纹理 `flipY` 未配套（默认 bottom + flipY=true） |
| 文字是色块/实心矩形 | 图集被当 sRGB 处理（应 NoColorSpace）或未输出 coverage |
| 所有车牌显示成一样 | 误用普通属性代替实例属性，或写入偏移不是 `i*4` |
| 七字符偏一侧 | `aVisibleCount` 错误或未减 `(L-1)*s/2` |
