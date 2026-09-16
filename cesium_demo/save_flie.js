const fs = require("fs").promises;
const path = require("path");

/**
 * 原生提取HTML中的title
 * @param {string} htmlContent - HTML文件内容
 * @returns {string} - title内容（无title时返回空字符串）
 */
function extractTitle(htmlContent) {
  const lowerContent = htmlContent.toLowerCase();
  const startTag = '<title>';
  const endTag = '</title>';

  const startIndex = lowerContent.indexOf(startTag);
  if (startIndex === -1) return '';

  const contentStart = startIndex + startTag.length;
  const endIndex = lowerContent.indexOf(endTag, contentStart);
  if (endIndex === -1) return '';

  return htmlContent.substring(contentStart, endIndex).trim();
}

/**
 * 递归遍历目录下的所有HTML文件
 * @param {string} dir - 要遍历的目录路径
 * @param {string} rootDir - 项目根目录（用于计算相对路径）
 * @param {Array<string>} excludeDirs - 需要排除的目录名数组
 * @returns {Promise<Array<{name: string, url: string}>>} - HTML文件信息数组
 */
async function traverseHtmlFiles(dir, rootDir, excludeDirs = []) {
  let results = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!excludeDirs.includes(entry.name)) {
          const subDirFiles = await traverseHtmlFiles(fullPath, rootDir, excludeDirs);
          results = results.concat(subDirFiles);
        }
      } else {
        // 只处理.html结尾的文件
        if (path.extname(entry.name).toLowerCase() === '.html') {
          // 计算相对于根目录的路径，并转换为正斜杠
          const relativePath = path.relative(rootDir, fullPath)
            .split(path.sep)
            .join('/');

          // 🔥 跳过根目录下的 index.html
          if (relativePath === 'index.html') {
            continue;
          }

          const htmlContent = await fs.readFile(fullPath, 'utf8');
          const title = extractTitle(htmlContent);

          results.push({
            name: title || `未命名文件 (${entry.name})`,
            url: relativePath
          });
        }
      }
    }
    return results;
  } catch (err) {
    console.error("遍历目录出错：", err);
    throw err;
  }
}

/**
 * 遍历HTML文件并将结果输出为JSON
 * @param {Object} options - 配置选项
 */
async function traverseAndSaveHtmlInfo({
  rootDir = __dirname,
  excludeDirs = [],
  outputFile = "htmlFilesInfo.json"
}) {
  try {
    const htmlFilesInfo = await traverseHtmlFiles(rootDir, rootDir, excludeDirs);

    await fs.writeFile(
      path.join(rootDir, outputFile),
      JSON.stringify(htmlFilesInfo, null, 2),
      "utf8"
    );

    console.log(`HTML文件信息已保存至：${path.join(rootDir, outputFile)}`);
    console.log(`共找到 ${htmlFilesInfo.length} 个HTML文件`);
  } catch (err) {
    console.error("处理过程出错：", err);
  }
}

// 配置选项
const config = {
  rootDir: __dirname,
  excludeDirs: ["node_modules", ".git", "dist", "build"],
  outputFile: "htmlFilesInfo.json"
};

traverseAndSaveHtmlInfo(config);