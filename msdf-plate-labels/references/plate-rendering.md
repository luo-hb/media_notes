# WebGL2 实例化渲染海量车牌：原理与模板说明

本文件解释 `assets/plate_template_part1.html`（核心逻辑）与 `plate_template_part2.html`（场景接入）的实现原理。
模板使用 Three.js WebGLRenderer + **RawShaderMaterial + GLSL3（强制 WebGL2）**。

## 1. 为什么是"一块车牌 = 一个实例"

两种实例粒度：

| 粒度 | 组织成本 | 适用性 |
| --- | --- | --- |
| 一个字符 | 需额外组织标签归属、偏移、背景 | 自由文字系统 |
| **一整块车牌** | 只需一个锚点 + 8 个字符索引 | 固定 8 槽车牌（本 skill 采用） |

模板几何体 = 1 个背景 Quad + 8 个字符槽 Quad，共 36 顶点 / 54 索引 / 18 三角形。
**所有 Quad 都先重叠在原点**，只标记 `charSlot`（-1 为背景，0-7 为槽位）与 `isBackground`。
真正的位置展开交给顶点着色器 → CPU 永不重写顶点。

## 2. 实例数据：两个 vec4 + 一个 Float

每个实例（每辆车）只上传：

```
aGlyphSet0    = [槽0, 槽1, 槽2, 槽3]   // InstancedBufferAttribute, 4 分量
aGlyphSet1    = [槽4, 槽5, 槽6, 槽7]   // InstancedBufferAttribute, 4 分量
aVisibleCount = 实际字符数              // InstancedBufferAttribute, 1 分量
```

- 字符以"字形编号"（glyph index）存储，不是字符串
- 空槽用 `EMPTY_GLYPH = -1` 标记
- 实例 i 的写入起点：`i * 4`（vec4 数组内偏移）

## 3. 图集 UV 约定（必配套，否则文字颠倒）

msdf-atlas-gen 生成 JSON 时指定 `-yorigin bottom`：

- JSON 的 `atlasBounds` 以 bottom 为原点
- 纹理加载：`texture.flipY = true`（WebGL 纹理原点在左下）
- UV 计算：`v0 = bottom/height, v1 = top/height`（yOrigin=bottom 时）
- 纹理设置：`colorSpace = NoColorSpace`（MSDF 是数值数据不是颜色）、
  `minFilter/magFilter = Linear`、`generateMipmaps = false`

顶点着色器选字：

```glsl
vec4 bounds = uGlyphUVs[int(glyphIndex)];
vUv = mix(bounds.xy, bounds.zw, uv);
```

## 4. 顶点着色器：选字 / 居中 / 背景伸缩 / Billboard

### 4.1 槽位读取

```glsl
int slot = int(charSlot);
if (slot < 4) glyphIndex = aGlyphSet0[slot];
else         glyphIndex = aGlyphSet1[slot - 4];
```

### 4.2 居中：`(L-1) * s / 2`

第 i 个字符中心 `i*s`，整体居中需减去首尾中点 `(L-1)*s/2`：

```glsl
float centerOffset = (aVisibleCount - 1.0) * 0.5 * uCharSpacing;
localOffset.x += charSlot * uCharSpacing - centerOffset;
```

### 4.3 背景伸缩

```glsl
float contentWidth = (aVisibleCount - 1.0) * uCharSpacing + 1.0;
localOffset *= vec2(contentWidth + 2.0*uPadding, 1.0 + 2.0*uPadding);
```

### 4.4 Billboard：只变换原点，在视空间展开

把"位置随车辆"与"面板朝向相机"解耦：

```glsl
// 1) 先算锚点在相机空间的位置（w=1，作为位置参与平移）
vec4 centerView = modelViewMatrix * (instanceMatrix * vec4(0.0,0.0,0.0,1.0));
// 2) 面板偏移加在视空间 X/Y 上（w=0，作为向量）
vec4 vertexView = centerView + vec4(localOffset * scale, 0.0, 0.0);
gl_Position = projectionMatrix * vertexView;
```

- 输入局部原点 → 实例的旋转不会带进面板形状（A×0=0）
- 在相机坐标系的 X/Y 展开 → 面板恒平行成像平面
- Z 不变 → 保持正确深度，远处标签随透视变小（不是固定屏幕字号）

需要继承实例缩放时取世界矩阵轴向长度：

```glsl
mat4 worldMatrix = modelMatrix * instanceMatrix;
scale *= vec2(length(worldMatrix[0].xyz), length(worldMatrix[1].xyz));
```

## 5. 片元着色器：MSDF 解码

对称 MSDF：取 RGB 中位值，0.5 为轮廓边界，用 fwidth 估算屏幕距离范围：

```glsl
vec2 footprint = max(fwidth(vUv), vec2(0.000001));
float screenRange = max(dot(uUnitRange / footprint, vec2(0.5)), 1.0);
vec3 sampleValue = texture(uAtlas, vUv).rgb;
float middle = max(min(sampleValue.r, sampleValue.g),
                   min(max(sampleValue.r, sampleValue.g), sampleValue.b));
float coverage = clamp((middle - 0.5) * screenRange + 0.5, 0.0, 1.0);
if (coverage <= 0.0) discard;
fragColor = vec4(uTextColor, coverage);
```

- 图集 RGB 存的是距离，不是颜色；文字颜色来自 `uTextColor`
- `coverage` 必须真正输出到 Alpha 才有平滑边缘
- 背景分支先绘制（索引 0 在前），文字按覆盖率叠加在背景上；深度测试仍开启
- **深度遮挡实践（本包与原文不同之处）**：材质为 `depthWrite:true`。透明实例不写深度时，标签之间由绘制顺序（实例索引顺序）决定谁盖谁，远处小标签会盖住近处大标签。开启 depthWrite 后，标签间按真实深度测试遮挡；同面板背景与文字深度相等，默认 LessEqual 函数仍能正常绘制文字（模板固定如此）。代价：半透明背景也会遮挡后方物体（本包背景 alpha 0.94，视觉上等于广告牌遮挡，符合直觉）。
- 距离剔除：CPU 侧按标签到相机距离 > `LABEL_FAR`（模板默认 100）隐藏标签（`setText(i,"")` 走顶点裁剪区外），避免过远实例浪费像素并与近处标签错误叠层；恢复时重新 setText 原文本。注意 `frustumCulled=false` 是必须的（面板在 Shader 展开，包围体不覆盖外观），真正的视锥剔除需在 CPU 侧按展开尺寸做，或依赖上述距离剔除。

## 6. 更新策略

```js
labels.setText(i, "京A12345");   // 只改 8 个索引 + visibleCount，几何与图集不重建
labels.setPosition(i, x, y, z);  // 只改实例矩阵
```

- `setText` 有字符串缓存：相同文本直接返回
- 局部上传：`addUpdateRange(base, 4)` 声明更新区间，再 `needsUpdate = true`
- 相机变化不需要重写实例（Billboard 在着色器里完成）

## 7. 模板对接说明

模板（assets/）以 34 省级汉字 + 数字 + 字母的演示配置编写：

- `PROVINCE_PLATES`：34 个省级行政区示例车牌数组
- `randomPlate(i)`：确定性伪随机车牌（省份 + 字母 + 5 位数字）
- 前 3 辆支持控制台自定义输入

场景：400 辆（可调 10-3000）双层实例化车辆（车身 + 车顶 InstancedMesh）+ 车牌，
拖拽旋转 / 滚轮缩放（限位），车辆移动只更新实例矩阵。

## 8. 验证与性能说明

- 单车牌文本记录 36 字节（8×4 + 1×4），加实例矩阵共 100 字节；1 万实例约 0.954 MiB
- 一次相机渲染中，所有车牌是**一个绘制批次**（同一几何 + 同一材质）
- 注意：共享模板不意味着顶点/片元工作量消失；测试时分别观察静态、只动位置、文字频繁变化三种负载
- `mesh.frustumCulled = false` 是教学简化（真正面板尺寸在 Shader 中展开，包围体不准确），工程化时应建保守边界
