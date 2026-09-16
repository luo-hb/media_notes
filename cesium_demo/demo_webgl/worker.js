// worker.js
importScripts('https://cdn.jsdelivr.net/npm/geotiff');

self.onmessage = async (e) => {
    try {
        const tiff = await GeoTIFF.fromArrayBuffer(e.data.buffer);
        const image = await tiff.getImage();
        const width = image.getWidth();
        const height = image.getHeight();

        // 读取高程数据
        const rasters = await image.readRasters({ samples: [0] });
        const elevation = new Float32Array(rasters[0]);

        // 计算最大最小值
        let min = Infinity, max = -Infinity;
        for (let i = 0; i < elevation.length; i++) {
            if (elevation[i] < min) min = elevation[i];
            if (elevation[i] > max) max = elevation[i];
        }

        // 将结果发回主线程
        self.postMessage({
            data: elevation,
            width,
            height,
            min,
            max
        });
    } catch (err) {
        self.postMessage({ error: err.message });
    }
};