import { defineConfig } from 'vite'
export default defineConfig({
  server: {
    port: 5173, // 端口（可替换为项目原有端口）
    host: '0.0.0.0', // 允许外部访问
    open: true, // 启动后自动打开浏览器
    cors: true, // 允许跨域
  },
})