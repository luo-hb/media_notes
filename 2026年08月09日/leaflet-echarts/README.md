# demo_a

这套代码是重新生成的独立版本，目标是：

- `Leaflet` 地图由业务侧自己初始化
- 底图、中心点、缩放级别全部由 `L.map(...)` 和 `L.tileLayer(...)` 自己控制
- 插件只负责把 `ECharts` 叠加到 Leaflet 地图上显示

## 文件

- `leaflet-echarts.js`
  - 新插件源码
  - 基于 `dist/leaflet-echarts-legacy.js` 的“外部地图 + 覆盖层”思路重新实现
  - 适配 `ECharts 5`、`Leaflet 1.9.4`
- `index.html`
  - 最小可运行示例

## 用法

```html
<script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="./leaflet-echarts.js"></script>
```

```js
var map = L.map('map').setView([34.25, 108.95], 5);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

var overlay = L.echartsLayer(map, echarts, {
  renderOnMoving: false,
  renderOnZooming: false
});

overlay.setOption({
  series: [{
    type: 'scatter',
    data: [
      { name: '西安', value: [108.9398, 34.3416, 76] }
    ]
  }]
});
```

## 说明

- 插件会对 `scatter`、`effectScatter`、`lines`、`heatmap`、`custom` 自动补 `coordinateSystem: 'leaflet'`
- 推荐使用现代 ECharts 5 系列写法，不再兼容 ECharts 2 的 `markPoint/markLine/mapType:'none'`
- 地图移动/缩放时，插件只负责重绘 ECharts，不会改 Leaflet 的底图和地图配置
