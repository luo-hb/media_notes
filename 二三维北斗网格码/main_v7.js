import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";

window.CESIUM_BASE_URL = "/node_modules/cesium/Build/Cesium";

window.onload = async () => {
  const viewer = new Cesium.Viewer("mapContent", {
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    baseLayerPicker: false,
    animation: false,
    timeline: false,
    fullscreenButton: false,
    infoBox: false,
  });
  viewer.scene.globe.depthTestAgainstTerrain = true;

  // 天地图底图
  const tianditu = new Cesium.UrlTemplateImageryProvider({
    url: "http://t{s}.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILECOL={x}&TILEROW={y}&tk=449b5f7b07a460aceb643861b3bb144c",
    subdomains: ["0", "1", "2", "3", "4", "5", "6", "7"],
  });
  viewer.imageryLayers.removeAll();
  viewer.imageryLayers.addImageryProvider(tianditu);

  class StaticLinePrimitive {
    constructor(color = Cesium.Color.CYAN) {
      this._lineColor = color;
      this._vertexBuffer = null;
      this._vertexArray = null;
      this._shaderProgram = null;
      this._renderState = null;
      this._vertexData = new Float32Array(0);
      this._vertexCount = 0;
      this._needsBufferUpdate = false;
      this._pendingRecreate = false;
      this._resourcesToDestroy = [];

      this._vertexShader = `
        in vec3 position;
        void main() {
            gl_Position = czm_projection * czm_view * vec4(position, 1.0);
        }
        `;
      this._fragmentShader = `
        uniform vec3 u_color;
        void main(){
            out_FragColor = vec4(u_color, 1.0);
        }
        `;
      this._attributeLocations = { position: 0 };
    }

    isDestroyed() { return false; }

    setLines(lines) {
      const vertexCount = lines.length * 2;
      const floatCount = vertexCount * 3;
      if (this._vertexData.length < floatCount) {
        const newSize = Math.floor(floatCount * 1.2);
        this._vertexData = new Float32Array(newSize);
        this._pendingRecreate = true;
      }
      let idx = 0;
      for (const line of lines) {
        const s = line.start;
        const e = line.end;
        this._vertexData[idx++] = s.x;
        this._vertexData[idx++] = s.y;
        this._vertexData[idx++] = s.z;
        this._vertexData[idx++] = e.x;
        this._vertexData[idx++] = e.y;
        this._vertexData[idx++] = e.z;
      }
      this._vertexCount = vertexCount;
      this._needsBufferUpdate = true;
    }

    clearLines() {
      this._vertexCount = 0;
      this._needsBufferUpdate = true;
    }

    _initializeResources(context) {
      this._vertexBuffer = Cesium.Buffer.createVertexBuffer({
        usage: Cesium.BufferUsage.DYNAMIC_DRAW,
        typedArray: this._vertexData,
        context,
      });
      this._vertexArray = new Cesium.VertexArray({
        context,
        attributes: [
          {
            index: this._attributeLocations.position,
            vertexBuffer: this._vertexBuffer,
            componentsPerAttribute: 3,
            componentDatatype: Cesium.ComponentDatatype.FLOAT,
          },
        ],
      });
      this._shaderProgram = Cesium.ShaderProgram.fromCache({
        context,
        vertexShaderSource: this._vertexShader,
        fragmentShaderSource: this._fragmentShader,
        attributeLocations: this._attributeLocations,
      });
      this._renderState = Cesium.RenderState.fromCache({ depthTest: { enabled: true } });
    }

    update(frameState) {
      const context = frameState.context;
      while (this._resourcesToDestroy.length > 0) {
        const res = this._resourcesToDestroy.shift();
        if (res && !res.isDestroyed()) res.destroy();
      }
      if (this._vertexCount === 0) return;
      if (this._pendingRecreate) {
        if (this._vertexArray) this._resourcesToDestroy.push(this._vertexArray);
        if (this._vertexBuffer) this._resourcesToDestroy.push(this._vertexBuffer);
        this._vertexArray = null;
        this._vertexBuffer = null;
        this._shaderProgram = null;
        this._pendingRecreate = false;
      }
      if (!this._shaderProgram) this._initializeResources(context);
      if (this._needsBufferUpdate) {
        const uploadLen = this._vertexCount * 3;
        this._vertexBuffer.copyFromArrayView(this._vertexData, 0, uploadLen);
        this._needsBufferUpdate = false;
      }
      const uniformMap = { u_color: () => this._lineColor };
      const cmd = new Cesium.DrawCommand({
        vertexArray: this._vertexArray,
        shaderProgram: this._shaderProgram,
        uniformMap,
        renderState: this._renderState,
        pass: Cesium.Pass.OPAQUE,
        primitiveType: Cesium.PrimitiveType.LINES,
        count: this._vertexCount,
        pickable: false,
      });
      frameState.commandList.push(cmd);
    }

    destroy() {
      if (this._vertexArray) this._vertexArray.destroy();
      if (this._vertexBuffer) this._vertexBuffer.destroy();
      this._vertexArray = null;
      this._vertexBuffer = null;
      this._shaderProgram = null;
      return Cesium.destroyObject(this);
    }

    static gridToLines(points) {
      const lines = [];
      lines.push({ start: points[0], end: points[1] });
      lines.push({ start: points[1], end: points[2] });
      lines.push({ start: points[2], end: points[3] });
      lines.push({ start: points[3], end: points[0] });
      lines.push({ start: points[4], end: points[5] });
      lines.push({ start: points[5], end: points[6] });
      lines.push({ start: points[6], end: points[7] });
      lines.push({ start: points[7], end: points[4] });
      lines.push({ start: points[0], end: points[4] });
      lines.push({ start: points[1], end: points[5] });
      lines.push({ start: points[2], end: points[6] });
      lines.push({ start: points[3], end: points[7] });
      return lines;
    }
  }

  class Beidou3DGridManager {
    constructor(viewer, options = {}) {
      this.viewer = viewer;
      this.gridColor = options.color ?? Cesium.Color.CYAN;
      this.batchSize = options.batchSize ?? 20;
      this.globalMinHeight = 0;
      this.globalMaxHeight = 1000000;

      this.linePrimitive = new StaticLinePrimitive(this.gridColor);
      viewer.scene.primitives.add(this.linePrimitive);

      this._taskToken = 0;
      this.currentLevel = null;
      this.gridCache = new Set();
      this.totalLines = [];
      this._cameraDebounce = null;

      this.zoomToLevelMap = [
        { maxZoom: 4, level: 1 },
        { maxZoom: 7, level: 2 },
        { maxZoom: 12, level: 3 },
        { maxZoom: 16, level: 4 },
        { maxZoom: 99, level: 5 },
      ];

      this._bindCameraEvent();
    }

    // GB/T39409 网格跨度
    static getGridSpan(level) {
      const pow = Math.pow(8, level - 1);
      return {
        dlon: 6.0 / pow,
        dlat: 4.0 / pow,
        dh: 200000 / pow,
      };
    }

    // 经纬度 → 全局网格索引 x,y
    static lonLatToGridIndex(lon, lat, level) {
      const { dlon, dlat } = Beidou3DGridManager.getGridSpan(level);
      // 基准起点 Lon=-180 Lat=-90
      const x = Math.floor((lon - (-180)) / dlon);
      const y = Math.floor((lat - (-90)) / dlat);
      return { x, y };
    }

    // 网格索引 → 网格四角经纬度 [lon0,lat0,lon1,lat1]
    static gridIndexToLonLat(x, y, level) {
      const { dlon, dlat } = Beidou3DGridManager.getGridSpan(level);
      const lon0 = -180 + x * dlon;
      const lat0 = -90 + y * dlat;
      const lon1 = lon0 + dlon;
      const lat1 = lat0 + dlat;
      return { lon0, lat0, lon1, lat1 };
    }

    _cameraHeightToZoom(cameraHeight) {
      if (cameraHeight > 1000000) return 2;
      if (cameraHeight > 500000) return 4;
      if (cameraHeight > 200000) return 6;
      if (cameraHeight > 80000) return 8;
      if (cameraHeight > 30000) return 10;
      if (cameraHeight > 10000) return 12;
      if (cameraHeight > 3000) return 14;
      return 16;
    }

    _getBeidouLevelByZoom(zoom) {
      for (const item of this.zoomToLevelMap) {
        if (zoom <= item.maxZoom) return item.level;
      }
      return 5;
    }

    _getViewInfo() {
      const camera = this.viewer.camera;
      const rect = this.viewer.camera.computeViewRectangle();
      if (!rect) return null;

      const centerCart = camera.positionCartographic;
      const centerLon = Cesium.Math.toDegrees(centerCart.longitude);
      const centerLat = Cesium.Math.toDegrees(centerCart.latitude);
      const camHeight = centerCart.height;

      return {
        rect,
        centerLon,
        centerLat,
        camHeight,
        zoom: this._cameraHeightToZoom(camHeight)
      };
    }

    _bindCameraEvent() {
      this.viewer.camera.changed.addEventListener(() => {
        clearTimeout(this._cameraDebounce);
        this._cameraDebounce = setTimeout(() => {
          this._onViewChange();
        }, 300);
      });
    }

    async _onViewChange() {
      const viewInfo = this._getViewInfo();
      if (!viewInfo) return;
      const targetLevel = this._getBeidouLevelByZoom(viewInfo.zoom);

      if (this.currentLevel !== targetLevel) {
        console.log(`Level切换 ${this.currentLevel} → ${targetLevel}`);
        this.currentLevel = targetLevel;
        this._taskToken++;
        this.gridCache.clear();
        this.totalLines.length = 0;
        this.linePrimitive.clearLines();
        await this._generateGridsInView(viewInfo, targetLevel);
      } else {
        await this._generateGridsInView(viewInfo, targetLevel);
      }
    }

    async _generateGridsInView(viewInfo, level) {
      const currentToken = this._taskToken + 1;
      this._taskToken = currentToken;
      const { rect } = viewInfo;
      const { dh } = Beidou3DGridManager.getGridSpan(level);

      // 视口地理范围
      let west = Cesium.Math.toDegrees(rect.west);
      let east = Cesium.Math.toDegrees(rect.east);
      let south = Cesium.Math.toDegrees(rect.south);
      let north = Cesium.Math.toDegrees(rect.north);

      const hMin = this.globalMinHeight;
      const hMax = this.globalMaxHeight;
      const countZ = Math.ceil((hMax - hMin) / dh);

      // 获取视口四角对应的网格索引
      const idxSW = Beidou3DGridManager.lonLatToGridIndex(west, south, level);
      const idxNE = Beidou3DGridManager.lonLatToGridIndex(east, north, level);

      let xStart = idxSW.x;
      let xEnd = idxNE.x;
      let yStart = idxSW.y;
      let yEnd = idxNE.y;

      // 兼容跨±180经度场景（简易处理，如需完美环球网格可扩展）
      if (xEnd < xStart) xEnd += 1;

      let batchLines = [];

      // 遍历【全局网格索引】，不再遍历经纬度！！！
      for (let x = xStart; x <= xEnd; x++) {
        if (this._taskToken !== currentToken) return;
        for (let y = yStart; y <= yEnd; y++) {
          if (this._taskToken !== currentToken) return;

          const gridGeo = Beidou3DGridManager.gridIndexToLonLat(x, y, level);

          for (let z = 0; z < countZ; z++) {
            if (this._taskToken !== currentToken) return;
            const gridId = `${level}_${x}_${y}_${z}`;
            if (this.gridCache.has(gridId)) continue;

            const height0 = hMin + z * dh;
            const height1 = Math.min(hMin + (z + 1) * dh, hMax);

            const p0 = Cesium.Cartesian3.fromDegrees(gridGeo.lon0, gridGeo.lat0, height0);
            const p1 = Cesium.Cartesian3.fromDegrees(gridGeo.lon1, gridGeo.lat0, height0);
            const p2 = Cesium.Cartesian3.fromDegrees(gridGeo.lon1, gridGeo.lat1, height0);
            const p3 = Cesium.Cartesian3.fromDegrees(gridGeo.lon0, gridGeo.lat1, height0);
            const p4 = Cesium.Cartesian3.fromDegrees(gridGeo.lon0, gridGeo.lat0, height1);
            const p5 = Cesium.Cartesian3.fromDegrees(gridGeo.lon1, gridGeo.lat0, height1);
            const p6 = Cesium.Cartesian3.fromDegrees(gridGeo.lon1, gridGeo.lat1, height1);
            const p7 = Cesium.Cartesian3.fromDegrees(gridGeo.lon0, gridGeo.lat1, height1);

            const cellLines = StaticLinePrimitive.gridToLines([p0, p1, p2, p3, p4, p5, p6, p7]);
            this.totalLines.push(...cellLines);
            batchLines.push(...cellLines);
            this.gridCache.add(gridId);

            if (batchLines.length >= this.batchSize * 12) {
              this.linePrimitive.setLines(this.totalLines);
              batchLines.length = 0;
              await new Promise(resolve => requestAnimationFrame(resolve));
            }
          }
        }
      }
      if (batchLines.length > 0 && this._taskToken === currentToken) {
        this.linePrimitive.setLines(this.totalLines);
      }
    }

    clear() {
      this._taskToken++;
      this.gridCache.clear();
      this.totalLines.length = 0;
      this.linePrimitive.clearLines();
    }

    destroy() {
      clearTimeout(this._cameraDebounce);
      this.clear();
      this.linePrimitive.destroy();
    }
  }

  const gridManager = new Beidou3DGridManager(viewer, {
    color: Cesium.Color.CYAN,
    batchSize: 1000,
  });

  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(102.7, 25, 1200000),
  });
};