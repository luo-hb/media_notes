(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['leaflet', 'echarts'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('leaflet'), require('echarts'));
  } else if (root.L && root.echarts) {
    root.L.echartsLayer = factory(root.L, root.echarts);
  } else {
    throw new Error('Leaflet and ECharts must be loaded before leaflet-echarts.');
  }
}(this, function(L, echarts) {
  'use strict';

  var LAYER_BY_DOM = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  var SUPPORTED_SERIES = {
    scatter: true,
    effectScatter: true,
    lines: true,
    heatmap: true,
    custom: true
  };
  var COORD_SYS_NAME = 'leaflet';

  function registerLayer(dom, layer) {
    if (LAYER_BY_DOM) {
      LAYER_BY_DOM.set(dom, layer);
      return;
    }
    dom.__leafletEchartsLayer = layer;
  }

  function unregisterLayer(dom) {
    if (!dom) {
      return;
    }
    if (LAYER_BY_DOM) {
      LAYER_BY_DOM.delete(dom);
      return;
    }
    try {
      delete dom.__leafletEchartsLayer;
    } catch (e) {
      dom.__leafletEchartsLayer = null;
    }
  }

  function getLayerByDom(dom) {
    if (!dom) {
      return null;
    }
    return LAYER_BY_DOM ? (LAYER_BY_DOM.get(dom) || null) : (dom.__leafletEchartsLayer || null);
  }

  function shallowCloneOption(option) {
    var result = {};
    var key;
    for (key in option) {
      if (Object.prototype.hasOwnProperty.call(option, key)) {
        result[key] = option[key];
      }
    }
    return result;
  }

  function cloneSeriesList(series) {
    var i;
    var item;
    var cloned = [];

    for (i = 0; i < series.length; i++) {
      item = series[i] || {};
      cloned.push(L.extend({}, item));
    }

    return cloned;
  }

  function normalizeSetOptionOpts(setOptionOpts) {
    if (typeof setOptionOpts === 'boolean') {
      return { notMerge: setOptionOpts };
    }
    return setOptionOpts || {};
  }

  function inferCoordinateSystem(option) {
    var normalized = shallowCloneOption(option || {});
    var series = cloneSeriesList(normalized.series || []);
    var i;
    var item;

    for (i = 0; i < series.length; i++) {
      item = series[i];
      if (!item.coordinateSystem && SUPPORTED_SERIES[item.type]) {
        item.coordinateSystem = COORD_SYS_NAME;
      }
    }

    normalized.series = series;
    return normalized;
  }

  function dataToCoordSize(coordSys, dataSize, dataItem) {
    var halfSizeX = dataSize[0] / 2;
    var halfSizeY = dataSize[1] / 2;
    var p1 = coordSys.dataToPoint([dataItem[0] - halfSizeX, dataItem[1] - halfSizeY]);
    var p2 = coordSys.dataToPoint([dataItem[0] + halfSizeX, dataItem[1] + halfSizeY]);
    return [Math.abs(p2[0] - p1[0]), Math.abs(p2[1] - p1[1])];
  }

  function doConvert(methodName, ecModel, finder, value) {
    var seriesModel = finder.seriesModel;
    var coordSys = seriesModel ? seriesModel.coordinateSystem : null;
    return coordSys === this ? coordSys[methodName](value) : null;
  }

  function LeafletCoordSys(layer) {
    this._layer = layer;
    this.dimensions = ['lng', 'lat'];
  }

  LeafletCoordSys.prototype.dimensions = ['lng', 'lat'];
  LeafletCoordSys.dimensions = LeafletCoordSys.prototype.dimensions;

  LeafletCoordSys.prototype.dataToPoint = function(data) {
    return this._layer.latLngToPoint(data);
  };

  LeafletCoordSys.prototype.pointToData = function(point) {
    return this._layer.pointToLatLng(point);
  };

  LeafletCoordSys.prototype.getViewRect = function() {
    var size = this._layer.getPaddedSize();
    return new echarts.graphic.BoundingRect(0, 0, size.x, size.y);
  };

  LeafletCoordSys.prototype.getRoamTransform = function() {
    return [1, 0, 0, 1, 0, 0];
  };

  LeafletCoordSys.prototype.prepareCustoms = function() {
    var rect = this.getViewRect();
    var coordSys = this;
    return {
      coordSys: {
        type: COORD_SYS_NAME,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      },
      api: {
        coord: function(dataItem) {
          return coordSys.dataToPoint(dataItem);
        },
        size: function(dataSize, dataItem) {
          return dataToCoordSize(coordSys, dataSize, dataItem);
        }
      }
    };
  };

  LeafletCoordSys.prototype.convertToPixel = echarts.util.curry(doConvert, 'dataToPoint');
  LeafletCoordSys.prototype.convertFromPixel = echarts.util.curry(doConvert, 'pointToData');

  LeafletCoordSys.create = function(ecModel, api) {
    var layer = getLayerByDom(api.getDom());
    var coordSys;
    var hasSeries = false;

    if (!layer) {
      return [];
    }

    coordSys = new LeafletCoordSys(layer);

    ecModel.eachSeries(function(seriesModel) {
      if (seriesModel.get('coordinateSystem') === COORD_SYS_NAME) {
        seriesModel.coordinateSystem = coordSys;
        hasSeries = true;
      }
    });

    return hasSeries ? [coordSys] : [];
  };

  if (!echarts.__leafletOverlayRegistered) {
    echarts.registerCoordinateSystem(COORD_SYS_NAME, LeafletCoordSys);
    echarts.__leafletOverlayRegistered = true;
  }

  L.EChartsLayer = L.Class.extend({
    includes: L.Evented ? L.Evented.prototype : L.Mixin.Events,

    options: {
      pane: 'overlayPane',
      zIndex: 450,
      opacity: 1,
      padding: 256,
      renderOnMoving: false,
      renderOnZooming: false,
      pointerEvents: 'auto',
      forceRerenderOnMoveEnd: true,
      forceRerenderOnZoomEnd: true,
      echartsInitOpts: null
    },

    initialize: function(map, ec, options) {
      this._map = map;
      this._ecLib = ec || echarts;
      this._option = null;
      this._setOptionOpts = {};
      this._chart = null;
      this._moveing = false;
      L.setOptions(this, options);
      this._createContainer();
      this._initChart();
      this._bindEvents();
      this._reset();
    },

    _createContainer: function() {
      var size = this.getPaddedSize();
      var div = this._container = document.createElement('div');
      div.className = 'leaflet-echarts-layer';
      div.style.position = 'absolute';
      div.style.width = size.x + 'px';
      div.style.height = size.y + 'px';
      div.style.zIndex = String(this.options.zIndex);
      div.style.opacity = String(this.options.opacity);
      div.style.pointerEvents = this.options.pointerEvents;
      if (this._map.options.zoomAnimation && L.Browser.any3d) {
        L.DomUtil.addClass(div, 'leaflet-zoom-animated');
      } else {
        L.DomUtil.addClass(div, 'leaflet-zoom-hide');
      }
      this._map.getPane(this.options.pane).appendChild(div);
    },

    _initChart: function() {
      this._chart = this._ecLib.init(this._container, null, this.options.echartsInitOpts || undefined);
      registerLayer(this._container, this);
    },

    _bindEvents: function() {
      var map = this._map;
      var self = this;
      var zr = this._chart.getZr();

      this._moveHandler = function() {
        if (self._zooming && map.options.zoomAnimation && L.Browser.any3d) {
          return;
        }
        if (self.options.renderOnMoving) {
          self._refresh('move');
        }
      };

      this._moveEndHandler = function() {
        self._zooming = false;
        self._reset();
        if (self.options.forceRerenderOnMoveEnd) {
          self._refresh('moveend', true);
        }
      };

      this._zoomStartHandler = function() {
        self._zooming = true;
      };

      this._zoomHandler = function() {
        if (self._zooming && map.options.zoomAnimation && L.Browser.any3d) {
          return;
        }
        if (self.options.renderOnZooming) {
          self._refresh('zoom');
        }
      };

      this._zoomEndHandler = function() {
        self._zooming = false;
        self._reset();
        if (self.options.forceRerenderOnZoomEnd) {
          self._refresh('zoomend', true);
        }
      };

      this._zoomAnimHandler = function(event) {
        self._animateZoom(event);
      };

      this._resizeHandler = function() {
        self.resize();
      };

      this._chartMouseDownHandler = function(event) {
        if (event && event.target && map.dragging && map.dragging.enabled()) {
          self._draggingDisabled = true;
          map.dragging.disable();
        }
      };

      this._chartMouseUpHandler = function() {
        if (self._draggingDisabled && map.dragging) {
          map.dragging.enable();
          self._draggingDisabled = false;
        }
      };

      map.on('move', this._moveHandler);
      map.on('moveend', this._moveEndHandler);
      map.on('zoomstart', this._zoomStartHandler);
      map.on('zoom', this._zoomHandler);
      map.on('zoomend', this._zoomEndHandler);
      map.on('resize', this._resizeHandler);
      if (map.options.zoomAnimation && L.Browser.any3d) {
        map.on('zoomanim', this._zoomAnimHandler);
      }

      zr.on('mousedown', this._chartMouseDownHandler);
      zr.on('mouseup', this._chartMouseUpHandler);
      zr.on('globalout', this._chartMouseUpHandler);
    },

    _unbindEvents: function() {
      var map = this._map;
      var zr = this._chart ? this._chart.getZr() : null;

      if (!map) {
        return;
      }

      map.off('move', this._moveHandler);
      map.off('moveend', this._moveEndHandler);
      map.off('zoomstart', this._zoomStartHandler);
      map.off('zoom', this._zoomHandler);
      map.off('zoomend', this._zoomEndHandler);
      map.off('resize', this._resizeHandler);
      map.off('zoomanim', this._zoomAnimHandler);

      if (zr) {
        zr.off('mousedown', this._chartMouseDownHandler);
        zr.off('mouseup', this._chartMouseUpHandler);
        zr.off('globalout', this._chartMouseUpHandler);
      }
    },

    _getMapOffset: function() {
      return [0, 0];
    },

    _setTransform: function(offset, scale) {
      if (L.DomUtil.setTransform) {
        L.DomUtil.setTransform(this._container, L.point(offset[0], offset[1]), scale);
      } else {
        this._container.style.left = offset[0] + 'px';
        this._container.style.top = offset[1] + 'px';
      }
    },

    _resetPosition: function() {
      this._mapOffset = [0, 0];
      this._setTransform([-this.options.padding, -this.options.padding], 1);
    },

    _animateZoom: function(event) {
      var map = this._map;
      var scale = map.getZoomScale(event.zoom);
      var viewHalf = map.getSize().multiplyBy(0.5);
      var currentCenterPoint = map.project(map.getCenter(), event.zoom);
      var destCenterPoint = map.project(event.center, event.zoom);
      var centerOffset = destCenterPoint.subtract(currentCenterPoint);
      var topLeftOffset = viewHalf.multiplyBy(-scale).add(viewHalf).subtract(centerOffset);
      var padding = this.options.padding;

      this._setTransform([topLeftOffset.x - padding * scale, topLeftOffset.y - padding * scale], scale);
    },

    _resetSize: function() {
      var size = this.getPaddedSize();
      this._container.style.width = size.x + 'px';
      this._container.style.height = size.y + 'px';
    },

    _reset: function() {
      this._resetSize();
      this._resetPosition();
      if (this._chart) {
        this._chart.resize();
      }
    },

    _refresh: function(reason, forceClear) {
      if (!this._chart || !this._option) {
        return;
      }
      this.fire('refresh', { reason: reason });
      if (forceClear) {
        this._chart.clear();
      }
      this._chart.setOption(this._option, this._setOptionOpts);
    },

    getMap: function() {
      return this._map;
    },

    getEchartsContainer: function() {
      return this._container;
    },

    getECharts: function() {
      return this._chart;
    },

    getMapOffset: function() {
      return this._mapOffset || [0, 0];
    },

    getPaddedSize: function() {
      var size = this._map.getSize();
      var padding = this.options.padding || 0;
      return L.point(size.x + padding * 2, size.y + padding * 2);
    },

    latLngToPoint: function(data) {
      var point = this._map.latLngToLayerPoint([data[1], data[0]]);
      var padding = this.options.padding || 0;
      return [point.x + padding, point.y + padding];
    },

    pointToLatLng: function(point) {
      var padding = this.options.padding || 0;
      var latLng = this._map.layerPointToLatLng([point[0] - padding, point[1] - padding]);
      return [latLng.lng, latLng.lat];
    },

    setOption: function(option, setOptionOpts) {
      this._option = inferCoordinateSystem(option);
      this._setOptionOpts = normalizeSetOptionOpts(setOptionOpts);
      this._reset();
      this._chart.setOption(this._option, this._setOptionOpts);
      return this;
    },

    clear: function() {
      if (this._chart) {
        this._chart.clear();
      }
      return this;
    },

    resize: function() {
      this._reset();
      if (this._option) {
        this._refresh('resize', true);
      }
      return this;
    },

    remove: function() {
      this._unbindEvents();
      if (this._container && this._container.parentNode) {
        this._container.parentNode.removeChild(this._container);
      }
      unregisterLayer(this._container);
      if (this._chart) {
        this._chart.dispose();
        this._chart = null;
      }
      return this;
    }
  });

  L.echartsLayer = function(map, ec, options) {
    return new L.EChartsLayer(map, ec, options);
  };

  return L.echartsLayer;
}));
