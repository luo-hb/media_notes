import { UrlTemplateImageryProvider, Math } from "cesium";
import { CesiumTerrainProvider, ImageryLayer } from "cesium";
import { Viewer } from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import * as Cesium from "cesium";
class Map {
  constructor(id) {
    window.CESIUM_BASE_URL = "/node_modules/cesium/Build/Cesium/";

    this.mapId = id;

    const tiles_tdt_img =
      "http://t{s}.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=ee9895821c1f9a8588f0528762a8f02b";

    // 天地图-瓦片
    const maptiles_ter = new ImageryLayer(
      new UrlTemplateImageryProvider({
        url: tiles_tdt_img,
        subdomains: ["0", "1", "2", "3", "4", "5", "6", "7"],
        maximumLevel: 14,
        minimumLevel: 1,
      }),
    );

    this.viewer = new Viewer(this.mapId, {
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      baseLayerPicker: false,
      animation: false,
      credit: false,
      timeline: false,
      fullscreenButton: false,
      vrButton: false,
      baseLayer: maptiles_ter,
      infoBox: false,
      requestRenderMode: false,
      shouldAnimate: true,
    });

    this.viewer.cesiumWidget.creditContainer.style.display = "none";

    this.viewer.scene.globe.depthTestAgainstTerrain = true;

    this.viewer.resolutionScale = window.devicePixelRatio;
    this.viewer.scene.screenSpaceCameraController.minimumZoomDistance = 500;

    this.viewer.scene.fxaa = true;
    this.viewer.scene.postProcessStages.fxaa.enabled = true;
  }
}

export default Map;
