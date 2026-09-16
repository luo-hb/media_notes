import Map from "../Map.js";
import MyPrimitive from "./MyPrimitive.js"; //  Z轴 切片

import * as Cesium from "cesium";
import * as dat from "dat.gui";

window.onload = function () {
  const map = new Map("mapContent");
  const viewer = map.viewer;
  viewer.cesiumWidget.creditContainer.style.display = "none";

  let demTex,
    imgTex,
    buffers,
    sMin = 0,
    sMax = 0,
    zScale = 30.0,
    rot = 0,
    currentMode = 2;
  let dW = 0,
    dH = 0;

  // 去掉所有 await，改成纯 Promise 链式
  fetch("dem_data_100.bin")
    .then((res) => {
      if (!res.ok) throw new Error("文件加载失败");
      return res.arrayBuffer(); // 这里不 await，直接返回 Promise
    })
    .then((arrayBuffer) => {
      // 严格解析头信息
      const dv = new DataView(arrayBuffer);
      dW = dv.getUint32(0, true);
      dH = dv.getUint32(4, true);
      const floatData = new Float32Array(arrayBuffer, 8);

      // 扫描高度极值 (跳过无效值)
      let min = 0,
        max = 3000;
      // for(let i=0; i<floatData.length; i+=500) {
      //     let v = floatData[i];
      //     if(v < -500 || v > 10000) continue;
      //     if(v < min) min = v; if(v > max) max = v;
      // }
      sMin = min;
      sMax = max;

      let data = {
        lon0: 121.63333333,
        lat0: 40.83333333,
        lon1: 131.31666667,
        lat1: 46.31666667,
      };
      // 初始化
      const zSlice = new MyPrimitive({
        viewer: viewer,
        // data: { lon0: 100, lat0: 20, lon1: 110, lat1: 30 },
        data: data,
        altitude: 1500,
        color: Cesium.Color.BLUE.withAlpha(0.3), // 半透明底面
        gridColor: Cesium.Color.YELLOW.withAlpha(0.9), // 网格线颜色
        gridWidth: 2, // 网格线宽
        showGrid: true, // 显示网格
      });

      // 动态控制
      // zSlice.setShowGrid(false); // 隐藏网格
      // zSlice.setShowGrid(true); // 显示网格
      zSlice.setAltitude(2000); // 修改高度
      zSlice.setdatas({
        data: floatData,
        dW: dW,
        dH: dH,
      }); // 修改高度

      //   const rectangle = Cesium.Rectangle.fromDegrees(
      //   100,   // 西 lon0
      //   20,    // 南 lat0
      //   110,   // 东 lon1
      //   30     // 北 lat1
      // );

      // 矩形：西, 南, 东, 北
      const rectangle = Cesium.Rectangle.fromDegrees(
        121.63333333,
        40.83333333,
        131.31666667,
        46.31666667,
      );

      // 飞行定位（平滑动画）
      viewer.camera.flyTo({
        destination: rectangle,
        duration: 1.5, // 动画时长（秒）
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-90), // 正俯视
          roll: 0.0,
        },
      });

      // debug.innerText = `${dW}x${dH}, 范围:${min.toFixed(0)}~${max.toFixed(0)}`;
    })
    .catch((e) => {
      // status.innerText = "❌ 失败: " + e.message;
      console.log(e);
    });

  // data: { lon0: 100, lat0: 20, lon1: 110, lat1: 30 },
};
