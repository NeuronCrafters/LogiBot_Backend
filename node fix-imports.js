const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

function updateImports(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');

  const updatedContent = content.replace(/(['"`])(\.\.\/)+src\/(.*?)\1/g, (match, quote, dots, rest) => {
    return `${quote}@/${rest}${quote}`;
  });

  if (content !== updatedContent) {
    console.log(`Refatorado: ${filePath}`);
    fs.writeFileSync(filePath, updatedContent, 'utf-8');
  }
}

function walk(dir) {
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (fullPath.endsWith('.ts')) {
      updateImports(fullPath);
    }
  });
}

walk(srcDir);
