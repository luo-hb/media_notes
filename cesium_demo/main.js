import HtmlFileListGenerator from './htmlFileList.js'; // 注意路径正确

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  new HtmlFileListGenerator({
    jsonPath: '/htmlFilesInfo.json',
    title: '模页面列表'
  });
});
 