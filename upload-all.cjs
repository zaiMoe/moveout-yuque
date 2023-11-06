const fs = require('fs');
const path = require('path');
const OSS = require('ali-oss');
const uuid = require('uuid'); 

// 阿里云OSS配置
const client = new OSS({
  accessKeyId: 'your_access_key_id',
  accessKeySecret: 'your_access_key_secret',
  region: 'your_oss_region',
  bucket: 'your_oss_bucket',
});

// 本地Markdown文件夹路径
const markdownFolderPath = './oputput';

// 上传目录
const remoteDir = ''

// 生成唯一文件名
function generateUniqueFileName(originalFileName) {
  const extension = path.extname(originalFileName);
  const uniqueIdentifier = uuid.v4().replace(/-/g, '');
  return `${Date.now()}-${uniqueIdentifier}${extension}`;
}

// 上传图片到OSS并替换Markdown中的链接
async function uploadImagesAndReplaceLinks(filePath) {
  const markdownContent = fs.readFileSync(filePath, 'utf8');
  const lines = markdownContent.split('\n');

  let isSuccess = true;
  for (let i = 0; i < lines.length; i++) {
    if (!isSuccess) {
      break;
    }

    const line = lines[i];
    const imageMatch = line.match(/\!\[.*\]\((.+)\)/);
    if (imageMatch) {
      const imageUrl = imageMatch[1];
      if (imageUrl.includes('http')) {
        break;

      }
      let fieln = imageUrl.split('#')[0];
      if (!fieln.startsWith('.')) {
        fieln = fieln.startsWith('/') ? `.${fieln}` :  `./${fieln}`;
      }
      const localImagePath = path.join(path.dirname(filePath), fieln);
      const fileContent = fs.readFileSync(localImagePath);
      const remoteFileName = generateUniqueFileName(path.basename(localImagePath));
      const remoteImagePath = `${remoteDir}/remoteFileName}`;

      try {
        const res = await client.put(remoteImagePath, fileContent);
        console.log(`Uploaded ${remoteFileName} to OSS as ${res.url}`);

        // 替换Markdown中的图片链接
        lines[i] = `![${imageMatch[0]}](${res.url})`;;
      } catch (err) {
        isSuccess = false;
        console.error(`Error uploading ${remoteFileName} to OSS: ${err.message}`);
      }
    }
  }

  // 更新Markdown文件
  if (isSuccess) {
    const str = lines.join('\n');
    fs.writeFileSync(filePath, str, 'utf-8');
  }
}

// 递归处理Markdown文件夹及其子文件夹
function processMarkdownFiles(folderPath) {
  const files = fs.readdirSync(folderPath);
  files.forEach(file => {
    if (['.git', '.obsidian'].some(item => file.includes(item))) {
      return
    }
    const filePath = path.join(folderPath, file);
    if (fs.statSync(filePath).isDirectory()) {
      processMarkdownFiles(filePath); // 如果是文件夹，递归处理子文件夹
    } else if (file.endsWith('.md')) {
      uploadImagesAndReplaceLinks(filePath);
    }
  });
}

processMarkdownFiles(path.join(markdownFolderPath))
