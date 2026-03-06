/**
 * Vercel build script: tự động chọn my-client hoặc my-admin theo VERCEL_PROJECT_NAME.
 * - Project tên chứa "admin" (vd: aura-pc-admin) → build my-admin
 * - Project khác (vd: aurapc) → build my-client
 * Output luôn copy vào dist/vercel-output để vercel.json dùng chung.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectName = (process.env.VERCEL_PROJECT_NAME || '').toLowerCase();
const isAdmin = projectName.includes('admin');

const app = isAdmin ? 'my-admin' : 'my-client';
const srcDir = path.join(__dirname, '..', 'dist', app, isAdmin ? 'browser' : 'browser');
const destDir = path.join(__dirname, '..', 'dist', 'vercel-output');

console.log(`[Vercel] Project: ${process.env.VERCEL_PROJECT_NAME || 'unknown'} → Building ${app}`);

const build = spawnSync('npm', ['run', 'build', '--', app, '--configuration=production'], {
  stdio: 'inherit',
  shell: true,
});

if (build.status !== 0) process.exit(build.status || 1);

// Copy output to dist/vercel-output (vercel.json dùng outputDirectory cố định)
function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) {
    console.error('Error: source not found', src);
    process.exit(1);
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

fs.rmSync(destDir, { recursive: true, force: true });
copyRecursive(srcDir, destDir);
console.log('[Vercel] Output copied to dist/vercel-output');
