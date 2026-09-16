import rasterio
import numpy as np
import struct

def tif_to_header_bin(tif_path, out_bin_path):
    print(f"正在读取: {tif_path}")
    with rasterio.open(tif_path) as src:
        # 读取第一波段
        data = src.read(1)
        
        # 处理无效值 (将常见的 -9999 或极小值设为 0)
        data = np.where(data < -500, 0, data)
        
        # 转换为 Float32
        data_f32 = data.astype(np.float32)
        width = src.width
        height = src.height

        print(f"解析成功: {width}x{height}, 数据格式: {data.dtype}")

        # 写入文件
        with open(out_bin_path, 'wb') as f:
            # 头部信息：4字节宽度 + 4字节高度 (Little Endian)
            header = struct.pack('<II', width, height)
            f.write(header)
            # 原始数据
            f.write(data_f32.tobytes())
            
    print(f"转换完成！输出文件: {out_bin_path} (大小: {len(data_f32.tobytes())/1024/1024:.2f} MB)")

if __name__ == "__main__":
    # 请确保文件名匹配
    tif_to_header_bin('1000.tif', 'dem_data_100.bin')