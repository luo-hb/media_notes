import * as Cesium from "cesium";

import {
  Texture,
  PixelFormat,
  PixelDatatype,
  Sampler,
  TextureWrap,
  TextureMinificationFilter,
  TextureMagnificationFilter,
} from "cesium";

/**
 * 创建Czm的材质对象
 * @param {*} viewer
 * @param {*} data
 * @param {*} nx
 * @param {*} ny
 * @param {*} pixelFormat
 * @param {*} pixelDatatype
 * @returns
 */
function CzmTexture2D(
  viewer,
  data,
  nx,
  ny,
  pixelFormat = PixelFormat.RGBA,
  pixelDatatype = PixelDatatype.UNSIGNED_BYTE,
) {
  var texture = new Texture({
    context: viewer.scene.context,
    width: nx,
    height: ny,
    pixelFormat: pixelFormat,
    pixelDatatype: pixelDatatype,
    source: {
      arrayBufferView: data,
    },
    sampler: new Sampler({
      wrapS: TextureWrap.CLAMP_TO_EDGE,
      wrapT: TextureWrap.CLAMP_TO_EDGE,
      minificationFilter: TextureMinificationFilter.NEAREST,
      magnificationFilter: TextureMagnificationFilter.NEAREST,
    }),
  });

  texture.type = "sampler2D";

  return texture;
}

class MyPrimitive {
  /**
   * 构造函数
   * @param {Object} options 配置
   * @param {Cesium.Viewer} options.viewer Cesium实例
   * @param {Object} [options.data] 数据 { lon0, lat0, lon1, lat1 }
   * @param {Number} [options.altitude=1000] 高度
   * @param {Cesium.Color} [options.color=红色半透明] 颜色
   */
  constructor(options) {
    this.viewer = options.viewer;
    this.data = options.data || {};

    // 基础配置
    this.altitude = options.altitude || 1000;
    this.color = options.color || Cesium.Color.RED.withAlpha(0.5);
    this.show = options.show ?? true;

    // 渲染对象
    this.primitive = null;
    this.texture2D = null;
  }

  setdatas(datas) {
    this.datas = datas;

    console.log(datas);
    if (!this.texture2D) {
      this.texture2D = CzmTexture2D(
        this.viewer,
        this.datas.data,
        this.datas.dW,
        this.datas.dH,
        // Cesium.PixelFormat.ALPHA,
        Cesium.PixelFormat.RED, // ✅ 必须传这个
        Cesium.PixelDatatype.FLOAT, // ✅ 必须传这个
      );
    }
    this.createRectangle();
  }
  /**
   * 设置显示/隐藏
   */
  setShow(show) {
    this.show = show;
    this.createRectangle();
  }

  /**
   * 设置数据（必须包含 lon0, lat0, lon1, lat1）
   */
  setVolumeData(data) {
    this.data = data;
    this.createRectangle();
  }

  /**
   * 设置高度
   */
  setAltitude(newAltitude) {
    if (typeof newAltitude === "number" && newAltitude >= 0) {
      this.altitude = newAltitude;
      // this.createRectangle();
    }
  }

  /**
   * 计算经纬度边界
   */
  calculateBounds() {
    const { lon0, lat0, lon1, lat1 } = this.data;
    const west = lon0;
    const south = lat0;
    const east = lon1;
    const north = lat1;

    return {
      west,
      south,
      east,
      north,
      bounds: Cesium.Rectangle.fromDegrees(west, south, east, north),
    };
  }

  /**
   * 创建切片面板（核心）
   */
  createRectangle() {
    // 先移除旧的
    this.remove();

    if (!this.show || !this.data?.lon0) return;

    const { bounds } = this.calculateBounds();

    // 简单材质
    let material = Cesium.Material.fromType("Color", {
      color: this.color,
    });

    const appearance = new Cesium.MaterialAppearance({
      vertexShaderSource: ` 
    in vec3 position3DHigh;
    in vec3 position3DLow;
    in vec3 normal;
    in vec2 st;
    in float batchId;

    out vec3 v_positionEC;
    out vec3 v_normalEC;
    out vec2 v_st;
    out vec3 v_position;

    // 🔴 统一名称 + 正确声明
    uniform sampler2D u_dataTexture;
    uniform vec2 u_textureSize;

 

    void main() {
        // 1. 获取原始位置
        vec4 p = czm_computePosition();
        vec3 positionMC = p.xyz;

        // 2. 世界坐标（绝对地心坐标）
        vec3 cameraPositionMC = czm_encodedCameraPositionMCHigh + czm_encodedCameraPositionMCLow;
        vec3 originMC = positionMC + cameraPositionMC;

        // 3. 计算球心法线
        vec3 ellipsoidNormal = normalize(originMC);

        // ==============================================
        // ✅ 正确：从纹理中读取高度（名称统一 + 坐标正确）
        // ==============================================
        // float rawH = texture(u_dataTexture, st).r;
         
        float h = texture(u_dataTexture, st).r;
        // 高度缩放（根据你的数据范围调整）
        // float height =   100000.0;
        // float height =    h * 100.0;
        // float normalizedH = h / 3000.0;  // 把 h 映射到 0~1
        float height = pow(h, 0.7) * 500.0;  // 柔和起伏
        // // if(st.x > 0.5){
        // // height =   200000.0;
        // // }
        // if(st.y > 0.5){
        // // height =   u_textureSize.x * 1000.0;
        // }

        // 沿球面法线抬升
        originMC = originMC + ellipsoidNormal * height;

        // 输出
        v_position = originMC;
        p.xyz = originMC - cameraPositionMC;

        v_positionEC = (czm_modelViewRelativeToEye * p).xyz;
        v_normalEC = czm_normal * normal;
        v_st = st;

        gl_Position = czm_modelViewProjectionRelativeToEye * p;
    }
`,

      fragmentShaderSource: `
    in vec3 v_positionEC;
    in vec3 v_normalEC;
    in vec2 v_st;
    in vec3 v_position;

        
    uniform sampler2D u_dataTexture;
    uniform vec2 u_textureSize;


    void main() {
      vec3 positionToEyeEC = -v_positionEC;
      vec3 normalEC = normalize(v_normalEC);

#ifdef FACE_FORWARD
      normalEC = faceforward(normalEC, vec3(0.0, 0.0, 1.0), -normalEC);
#endif

      float h = texture(u_dataTexture, v_st).r;
      out_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
      // out_FragColor = vec4(0.0, 1.0, 0.0, h);
    }`,

      materialCacheKey: "my-box-material-appearance",
      translucent: true,
      closed: false,
    });

    // appearance.uniforms = {
    //   u_dataTexture: function () {
    //     return this.texture2D;
    //   }.bind(this),
    //   u_textureSize: function () {
    //     return new Cesium.Cartesian2(this.datas.dW, this.datas.dH);
    //   }.bind(this),
    // };

    appearance.uniforms = {
      u_textureSize: new Cesium.Cartesian2(this.datas.dW, this.datas.dH),
      u_dataTexture: this.texture2D,
    };

    // appearance.primitiveType = Cesium.PrimitiveType.LINES; // 👈 就改这行
    // 几何体
    const geometry = Cesium.RectangleGeometry.createGeometry(
      new Cesium.RectangleGeometry({
        rectangle: bounds,
        height: this.altitude,
        vertexFormat: Cesium.VertexFormat.POSITION_AND_ST,
        granularity: Cesium.Math.toRadians(0.1),
        // primitiveType: Cesium.PrimitiveType.LINE_STRIP,
      }),
    );

    // geometry.primitiveType = Cesium.PrimitiveType.LINE_LOOP;
    // geometry.primitiveType = Cesium.PrimitiveType.LINES;
    geometry.primitiveType = Cesium.PrimitiveType.LINE_STRIP;
    const instance = new Cesium.GeometryInstance({
      geometry: geometry,
    });

    // 创建Primitive
    this.primitive = new Cesium.Primitive({
      geometryInstances: instance,
      appearance: appearance,
      asynchronous: false,
      // wireframe: true, // ✅ 只加这一行，直接变成线框
    });

    this.viewer.scene.primitives.add(this.primitive);
  }

  /**
   * 移除面板
   */
  remove() {
    if (this.primitive) {
      this.viewer.scene.primitives.remove(this.primitive);
      this.primitive = null;
    }
  }

  /**
   * 销毁资源
   */
  destroy() {
    this.remove();
    if (this.texture2D) {
      this.texture2D.destroy();
      this.texture2D = null;
    }
  }
}

export default MyPrimitive;
