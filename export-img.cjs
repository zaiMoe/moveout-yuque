const fs = require('fs');
const path = require('path');
const https = require('https');
const url = require('url');
const axios = require('axios');
const markdownFolder = process.env.MARKDOWN_DIR || path.join(__dirname, 'output');
const imageFolder = path.join(markdownFolder, 'images');

if (!fs.existsSync(markdownFolder)) {
  console.log(`MARKDOWN_DIR not set, and does not exist: ${markdownFolder}`);
  process.exit(1);
}

if (!fs.existsSync(imageFolder)) {
  fs.mkdirSync(imageFolder);
}

const downloadImage = process.env.DOWNLOAD_IMAGE || 'True';
const downloadImageFlag = downloadImage.toLowerCase() === 'true';

const updateImageURL = process.env.UPDATE_MDIMG_URL || 'True';
const updateImageURLFlag = updateImageURL.toLowerCase() === 'true';

const replaceImageHost = process.env.REPLACE_IMAGE_HOST || '';

const imgTagPattern = /!\[.*?\]\((.*?)\)/g;

async function downloadImageFile(imgUrl, imgPath) {
    try {
        const response = await axios.get(imgUrl, { responseType: 'stream' });
    
        if (response.status === 200) {
          const writer = fs.createWriteStream(imgPath);
    
          response.data.pipe(writer);
    
          return new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
          });
        } else {
          throw new Error(`Failed to download image from URL: ${imgUrl}`);
        }
      } catch (error) {
        throw error;
      }
}

function processMarkdownFile(mdFile) {
  let markdownContent = fs.readFileSync(mdFile, 'utf-8');
  let replaceImageURL = false;
  
  markdownContent.replace(imgTagPattern, (match, imgLink) => {
    const parsedUrl = url.parse(imgLink);

    if (!parsedUrl.protocol) {
      return match;
    }

    const imgFilename = path.basename(parsedUrl.pathname);

    const pathParts = parsedUrl.pathname.split('/');

    if (pathParts.length > 3) {
      const years = pathParts[3];

      if (!/^2\d{3}$/.test(years)) {
        console.log(`[Warning]: The markdown ${path.basename(mdFile)} file's image URL ${parsedUrl.pathname} format in markdown does not match the Yuque URL. There may be a problem with the parsing. Please pay attention.`);
        return match;
      }

      const downloadFolder = path.join(imageFolder, years);

      if (!fs.existsSync(downloadFolder)) {
        fs.mkdirSync(downloadFolder);
      }

      if (downloadImageFlag) {
        const imgUrl = imgLink.replace(parsedUrl.hash || '', '');
        const imgPath = path.join(downloadFolder, imgFilename);

        downloadImageFile(imgUrl, imgPath).catch((err) => {
          console.error(`Failed to download image: ${imgUrl} \n`);
          console.log(err)
        });
      }

      if (updateImageURLFlag) {
        let newImgLink;

        if (!replaceImageHost.trim()) {
          const relativePath = path.relative(path.dirname(mdFile), downloadFolder).replace(/\\/g, '/');
          newImgLink = `${relativePath}/${imgFilename}`;
        } else {
          const host = replaceImageHost.replace(/\/+$/, '');
          newImgLink = `${host}/${imgFilename}`;
        }

        markdownContent = markdownContent.replace(imgLink, newImgLink);
        markdownContent = markdownContent.replace(/!\[\]\(\.\/[^\)]+\)/g, '');
        replaceImageURL = true;
      }
    }

    return match;
  });

  if (replaceImageURL) {
    fs.writeFileSync(mdFile, markdownContent, 'utf-8');
    console.log(`Updated: ${path.basename(mdFile)}`);
  }
}

function processMarkdownFilesInFolder(folder) {
  const files = fs.readdirSync(folder);

  for (const file of files) {
    const filePath = path.join(folder, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      processMarkdownFilesInFolder(filePath);
    } else if (file.endsWith('.md')) {
      processMarkdownFile(filePath);
    }
  }
}

processMarkdownFilesInFolder(markdownFolder);
console.log('Image link replacement complete.');
