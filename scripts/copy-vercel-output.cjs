const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'dist', 'my-client', 'browser');
const dest = path.join(__dirname, '..', 'dist', 'my-client');

if (!fs.existsSync(src)) {
  console.error('Error: dist/my-client/browser not found');
  process.exit(1);
}

function copyRecursive(srcDir, destDir) {
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyRecursive(src, dest);
fs.rmSync(src, { recursive: true });
console.log('Vercel output copied to dist/my-client');
