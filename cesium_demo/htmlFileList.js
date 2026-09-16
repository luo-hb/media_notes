/**
 * HTML文件列表生成器
 * 依赖 htmlFilesInfo.json 文件
 */
class HtmlFileListGenerator {
  constructor(options = {}) {
    // 默认配置
    this.config = {
      jsonPath: './htmlFilesInfo.json', // JSON文件路径
      container: document.body, // 容器元素
      title: 'HTML文件列表', // 页面标题
      ...options // 覆盖默认配置
    };
    
    // 初始化
    this.init();
  }

  /**
   * 初始化函数
   */
  async init() {
    try {
      // 注入样式
      this.injectStyles();
      
      // 创建核心DOM
      this.createCoreElements();
      
      // 加载并渲染数据
      await this.loadAndRenderFiles();
    } catch (err) {
      this.showError(err.message || '初始化失败');
    }
  }

  /**
   * 注入CSS样式
   */
  injectStyles() {
    const style = document.createElement('style');
    style.id = 'html-file-list-styles';
    style.textContent = `
      .html-file-list-container * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
        font-family: 'Microsoft YaHei', Arial, sans-serif;
      }
      .html-file-list-container {
        max-width: 1400px;
        margin: 0 auto;
        padding: 30px 20px;
        background-color: #f5f7fa;
      }
      .html-file-list-title {
        color: #2c3e50;
        border-bottom: 2px solid #3498db;
        padding-bottom: 10px;
        margin-bottom: 25px;
        font-size: 22px;
      }
      .html-file-list-loading, 
      .html-file-list-error {
        padding: 20px;
        border-radius: 6px;
        margin-bottom: 20px;
        text-align: center;
      }
      .html-file-list-loading {
        color: #666;
        background: #fff;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      }
      .html-file-list-error {
        color: #e74c3c;
        background: #fef0f0;
        border-left: 3px solid #e74c3c;
        display: none;
      }
      .html-file-list {
        display: flex;
        flex-wrap: wrap;
        gap: 15px;
        list-style: none;
        margin-top: 20px;
      }
      .html-file-item {
        flex: 1;
        min-width: 280px;
        max-width: calc(50% - 15px);
        background: #fff;
        padding: 15px;
        border-radius: 6px;
        box-shadow: 0 1px 2px rgba(0,0,0,0.08);
        transition: all 0.2s ease;
        cursor: pointer;
        position: relative;
        overflow: hidden;
      }
      @media (max-width: 768px) {
        .html-file-item {
          max-width: 100%;
          min-width: 100%;
        }
      }
      .html-file-item:hover {
        transform: translateY(-2px);
        box-shadow: 0 3px 8px rgba(0,0,0,0.12);
        border-left: 3px solid #3498db;
      }
      .html-file-link {
        text-decoration: none;
        color: #2c3e50;
        font-weight: 500;
        display: block;
        margin-bottom: 5px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        position: relative;
        z-index: 1;
      }
      .html-file-link:hover {
        color: #3498db;
        text-decoration: underline;
      }
      .html-file-path {
        color: #7f8c8d;
        font-size: 13px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        position: relative;
        z-index: 1;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * 创建核心DOM元素
   */
  createCoreElements() {
    // 创建容器
    this.container = document.createElement('div');
    this.container.className = 'html-file-list-container';
    this.config.container.appendChild(this.container);

    // 创建标题
    this.titleElement = document.createElement('h1');
    this.titleElement.className = 'html-file-list-title';
    this.titleElement.textContent = this.config.title;
    this.container.appendChild(this.titleElement);

    // 创建加载状态
    this.loadingElement = document.createElement('div');
    this.loadingElement.className = 'html-file-list-loading';
    this.loadingElement.textContent = '正在加载文件列表...';
    this.container.appendChild(this.loadingElement);

    // 创建错误提示
    this.errorElement = document.createElement('div');
    this.errorElement.className = 'html-file-list-error';
    this.container.appendChild(this.errorElement);

    // 创建文件列表容器
    this.listElement = document.createElement('ul');
    this.listElement.className = 'html-file-list';
    this.container.appendChild(this.listElement);
  }

  /**
   * 显示错误信息
   * @param {string} message - 错误信息
   */
  showError(message) {
    this.loadingElement.style.display = 'none';
    this.errorElement.textContent = message;
    this.errorElement.style.display = 'block';
  }

  /**
   * 加载并渲染文件列表
   */
  async loadAndRenderFiles() {
    try {
      const response = await fetch(this.config.jsonPath);
      if (!response.ok) {
        throw new Error(`加载失败：${response.status} ${response.statusText}`);
      }

      const htmlFiles = await response.json();
      this.loadingElement.style.display = 'none';

      if (Array.isArray(htmlFiles) && htmlFiles.length > 0) {
        // 排序
        htmlFiles.sort((a, b) => a.name.localeCompare(b.name));
        
        // 渲染列表
        htmlFiles.forEach(file => this.renderFileItem(file));
      } else {
        this.showError('未找到任何HTML文件信息');
      }
    } catch (err) {
      this.showError(err.message || '加载文件列表失败');
    }
  }

  /**
   * 渲染单个文件项
   * @param {Object} file - 文件信息 {name, url}
   */
  renderFileItem(file) {
    const item = document.createElement('li');
    item.className = 'html-file-item';
    item.addEventListener('click', () => {
      // window.open(file.url, '_blank');
      // 1. 获取当前域名+端口（如 http://localhost:3000 或 https://example.com）
      const currentOrigin = window.location.origin;
      // 2. 处理 file.url 的开头斜杠，避免拼接后出现 //（如 http://localhost:3000//docs）
      const cleanUrl = file.url.startsWith('/') ? file.url.slice(1) : file.url;
      // 3. 拼接完整URL：当前域名+端口 + 处理后的file.url
      const fullUrl = `${currentOrigin}/${cleanUrl}`;
      // 4. 打开新窗口
      window.open(fullUrl, '_blank');
    });

    // 链接
    // const link = document.createElement('a');
    const link = document.createElement('div');
    link.className = 'html-file-link';
    link.href = file.url;
    link.target = '_blank';
    link.textContent = file.name || '未命名文件';
    link.title = file.name || '未命名文件';

    // 路径
    const path = document.createElement('div');
    path.className = 'html-file-path';
    path.textContent = file.url;
    path.title = file.url;

    item.append(link, path);
    this.listElement.appendChild(item);
  }
}
export default HtmlFileListGenerator;
// // 页面加载完成后自动初始化（可注释掉，改为手动初始化）
// document.addEventListener('DOMContentLoaded', () => {
//   // 默认配置，可根据需要修改
//   new HtmlFileListGenerator({
//     // jsonPath: './custom-path/htmlFilesInfo.json', // 自定义JSON路径
//     // title: '我的HTML文件列表' // 自定义标题
//   });
// });